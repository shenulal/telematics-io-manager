'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Eye, ChevronDown, ChevronRight, X } from 'lucide-react';
import { Button, Card, Modal, Input, SearchableSelect, TextArea, ImportExportBar } from '@/components/ui';
import { IOMapping, IOMappingCreate, Vendor, Product, IOUniversal } from '@/types/models';
import { buildQueryString, fetchApi, createItem, updateItem, deleteItem } from '@/hooks/useApi';
import { exportToExcel, exportToPDF, downloadTemplate, parseExcelFile, ExportColumn } from '@/utils/exportImport';

// Mapping level type
type MappingLevel = 'vendor' | 'product';

// Raw value entry type
interface RawValueEntry {
  value: number | string;
  label: string;
  description: string;
}

// Validation errors type
interface ValidationErrors {
  IOID?: string;
  VendorID?: string;
  ProductID?: string;
  IOCode?: string;
  IOName?: string;
  Bytes?: string;
  Multiplier?: string;
  Offset?: string;
  MinValue?: string;
  MaxValue?: string;
}

// Grouped mapping type for tree view
interface GroupedMapping {
  ioId: number;
  ioName: string;
  ioCategory: string | null;
  dataType: string | null;
  mappings: IOMapping[];
  isExpanded: boolean;
}

export default function IOMappingsPage() {
  const [mappings, setMappings] = useState<IOMapping[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [ioUniversal, setIOUniversal] = useState<IOUniversal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<IOMapping | null>(null);
  const [viewingMapping, setViewingMapping] = useState<IOMapping | null>(null);
  const [formData, setFormData] = useState<IOMappingCreate>({ IOID: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [mappingLevel, setMappingLevel] = useState<MappingLevel>('vendor');
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [rawValues, setRawValues] = useState<RawValueEntry[]>([]);

  // Fetch all mappings (no pagination for tree view)
  const fetchMappings = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = buildQueryString({ pageSize: 10000, search, vendorId: filterVendor || undefined, productId: filterProduct || undefined });
      const response = await fetchApi<IOMapping[]>(`/api/io-mappings${query}`);
      if (response.success && response.data) {
        setMappings(response.data);
      }
    } catch (error) { console.error('Error fetching mappings:', error); }
    finally { setIsLoading(false); }
  }, [search, filterVendor, filterProduct]);

  const fetchDropdowns = useCallback(async () => {
    try {
      const [vendorsRes, productsRes, ioRes] = await Promise.all([
        fetchApi<Vendor[]>('/api/vendors?pageSize=1000'),
        fetchApi<Product[]>('/api/products?pageSize=1000'),
        fetchApi<IOUniversal[]>('/api/io-universal?pageSize=1000'),
      ]);
      if (vendorsRes.success && vendorsRes.data) setVendors(vendorsRes.data);
      if (productsRes.success && productsRes.data) setProducts(productsRes.data);
      if (ioRes.success && ioRes.data) setIOUniversal(ioRes.data);
    } catch (error) { console.error('Error fetching dropdowns:', error); }
  }, []);

  useEffect(() => { fetchDropdowns(); }, [fetchDropdowns]);
  useEffect(() => { fetchMappings(); }, [fetchMappings]);

  // Group mappings by IO Universal ID for tree view
  const groupedMappings = useMemo((): GroupedMapping[] => {
    const groups: Map<number, GroupedMapping> = new Map();

    mappings.forEach(mapping => {
      const io = ioUniversal.find(i => i.IOID === mapping.IOID);
      if (!groups.has(mapping.IOID)) {
        groups.set(mapping.IOID, {
          ioId: mapping.IOID,
          ioName: io?.IOName || mapping.UniversalIOName || `IO ${mapping.IOID}`,
          ioCategory: io?.IOCategory || null,
          dataType: io?.DataType || null,
          mappings: [],
          isExpanded: expandedGroups.has(mapping.IOID),
        });
      }
      groups.get(mapping.IOID)!.mappings.push(mapping);
    });

    return Array.from(groups.values()).sort((a, b) => a.ioId - b.ioId);
  }, [mappings, ioUniversal, expandedGroups]);

  // Get selected IO Universal data type
  const getSelectedIODataType = useCallback((): string | null => {
    const io = ioUniversal.find(i => i.IOID === formData.IOID);
    return io?.DataType || null;
  }, [ioUniversal, formData.IOID]);

  // Validate input based on data type
  const validateField = useCallback((field: string, value: unknown, dataType: string | null): string => {
    if (value === undefined || value === null || value === '') return '';

    const numericTypes = ['int', 'bigint', 'smallint', 'tinyint', 'numeric', 'decimal', 'money', 'smallmoney'];
    const floatTypes = ['float', 'real', 'decimal', 'numeric'];
    const intTypes = ['int', 'bigint', 'smallint', 'tinyint'];

    const normalizedType = dataType?.toLowerCase() || '';

    if (field === 'Bytes') {
      const num = Number(value);
      if (isNaN(num) || num < 0) return 'Bytes must be a positive number';
      if (!Number.isInteger(num)) return 'Bytes must be a whole number';
      if (num > 255) return 'Bytes cannot exceed 255';
    }

    if (field === 'Multiplier' || field === 'Offset') {
      const num = Number(value);
      if (isNaN(num)) return `${field} must be a valid number`;

      if (intTypes.some(t => normalizedType.includes(t)) && !floatTypes.some(t => normalizedType.includes(t))) {
        // For integer data types, multiplier/offset should result in integer values
        // This is a soft validation - we allow decimals but warn
      }
    }

    if (field === 'MinValue' || field === 'MaxValue') {
      if (numericTypes.some(t => normalizedType.includes(t))) {
        const num = Number(value);
        if (isNaN(num)) return `${field} must be a valid number for ${dataType} data type`;
      }
    }

    return '';
  }, []);

  // Validate all fields
  const validateForm = useCallback((): boolean => {
    const dataType = getSelectedIODataType();
    const errors: ValidationErrors = {};

    // Mandatory field validations
    if (!formData.IOID || formData.IOID === 0) {
      errors.IOID = 'IO Universal is required';
    }

    if (!formData.VendorID || formData.VendorID === 0) {
      errors.VendorID = 'Vendor is required';
    }

    if (mappingLevel === 'product' && (!formData.ProductID || formData.ProductID === 0)) {
      errors.ProductID = 'Product is required when mapping at Product level';
    }

    if (!formData.IOCode || formData.IOCode.trim() === '') {
      errors.IOCode = 'IO Code is required';
    } else if (formData.IOCode.length > 5) {
      errors.IOCode = 'IO Code cannot exceed 5 characters';
    }

    if (!formData.IOName || formData.IOName.trim() === '') {
      errors.IOName = 'IO Name is required';
    } else if (formData.IOName.length > 255) {
      errors.IOName = 'IO Name cannot exceed 255 characters';
    }

    // Data type based validations
    const bytesError = validateField('Bytes', formData.Bytes, dataType);
    if (bytesError) errors.Bytes = bytesError;

    const multiplierError = validateField('Multiplier', formData.Multiplier, dataType);
    if (multiplierError) errors.Multiplier = multiplierError;

    const offsetError = validateField('Offset', formData.Offset, dataType);
    if (offsetError) errors.Offset = offsetError;

    const minValueError = validateField('MinValue', formData.MinValue, dataType);
    if (minValueError) errors.MinValue = minValueError;

    const maxValueError = validateField('MaxValue', formData.MaxValue, dataType);
    if (maxValueError) errors.MaxValue = maxValueError;

    setValidationErrors(errors);
    return Object.values(errors).every(e => !e);
  }, [formData, getSelectedIODataType, validateField, mappingLevel]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); fetchMappings(); };

  const toggleGroup = (ioId: number) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(ioId)) next.delete(ioId);
      else next.add(ioId);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedGroups(new Set(groupedMappings.map(g => g.ioId)));
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

  // Parse RawValueJson to array
  const parseRawValueJson = (json: string | null | undefined): RawValueEntry[] => {
    if (!json) return [];
    try {
      const parsed = JSON.parse(json);
      return parsed.data || [];
    } catch {
      return [];
    }
  };

  // Convert rawValues array to JSON string
  const rawValuesToJson = (entries: RawValueEntry[]): string | undefined => {
    if (entries.length === 0) return undefined;
    return JSON.stringify({ data: entries });
  };

  const openCreateModal = () => {
    setEditingMapping(null);
    setMappingLevel('vendor');
    setValidationErrors({});
    setRawValues([]);
    setFormData({
      IOID: ioUniversal[0]?.IOID || 0, VendorID: undefined, ProductID: undefined, IOCode: '', IOName: '', Bytes: undefined,
      Multiplier: undefined, Offset: undefined, Unit: '', MinValue: undefined, MaxValue: undefined,
      ErrorValues: '', ConversionFormula: '', Averaging: '', EventOnChange: false, EventOnHysterisis: false,
      ParameterGroup: '', Description: '', RawValueJson: undefined
    });
    setIsModalOpen(true);
  };

  const openEditModal = (mapping: IOMapping) => {
    setEditingMapping(mapping);
    setMappingLevel(mapping.ProductID ? 'product' : 'vendor');
    setValidationErrors({});
    setRawValues(parseRawValueJson(mapping.RawValueJson));
    setFormData({
      IOID: mapping.IOID, VendorID: mapping.VendorID || undefined, ProductID: mapping.ProductID || undefined,
      IOCode: mapping.IOCode || '', IOName: mapping.IOName || '', Bytes: mapping.Bytes || undefined,
      MinValue: mapping.MinValue || undefined, MaxValue: mapping.MaxValue || undefined,
      Multiplier: mapping.Multiplier || undefined, Offset: mapping.Offset || undefined, Unit: mapping.Unit || '',
      ErrorValues: mapping.ErrorValues || '', ConversionFormula: mapping.ConversionFormula || '', Averaging: mapping.Averaging || '',
      EventOnChange: mapping.EventOnChange || false, EventOnHysterisis: mapping.EventOnHysterisis || false,
      ParameterGroup: mapping.ParameterGroup || '', Description: mapping.Description || '', RawValueJson: mapping.RawValueJson || undefined,
    });
    setIsModalOpen(true);
  };

  const openViewModal = (mapping: IOMapping) => { setViewingMapping(mapping); setIsViewModalOpen(true); };

  const handleSave = async () => {
    if (!formData.IOID) return;
    if (!validateForm()) return;

    // Clear product if vendor level and add RawValueJson
    const dataToSave = { ...formData, RawValueJson: rawValuesToJson(rawValues) };
    if (mappingLevel === 'vendor') {
      dataToSave.ProductID = undefined;
    }

    setIsSaving(true);
    try {
      if (editingMapping) { await updateItem<IOMapping, IOMappingCreate>(`/api/io-mappings/${editingMapping.MappingID}`, dataToSave); }
      else { await createItem<IOMapping, IOMappingCreate>('/api/io-mappings', dataToSave); }
      setIsModalOpen(false);
      fetchMappings();
    } catch (error) { console.error('Error saving mapping:', error); }
    finally { setIsSaving(false); }
  };

  // Raw Value handlers
  const addRawValue = () => {
    setRawValues([...rawValues, { value: rawValues.length, label: '', description: '' }]);
  };

  const updateRawValue = (index: number, field: keyof RawValueEntry, value: string | number) => {
    const updated = [...rawValues];
    updated[index] = { ...updated[index], [field]: value };
    setRawValues(updated);
  };

  const removeRawValue = (index: number) => {
    setRawValues(rawValues.filter((_, i) => i !== index));
  };

  const handleDelete = async (mapping: IOMapping) => {
    if (!confirm(`Are you sure you want to delete mapping "${mapping.IOName || mapping.MappingID}"?`)) return;
    try { await deleteItem(`/api/io-mappings/${mapping.MappingID}`); fetchMappings(); }
    catch (error) { console.error('Error deleting mapping:', error); }
  };

  // Export columns configuration - all fields
  const exportColumns: ExportColumn[] = [
    { key: 'IOID', header: 'IO ID', width: 8 },
    { key: 'UniversalIOName', header: 'Universal IO Name', width: 20 },
    { key: 'VendorName', header: 'Vendor', width: 18 },
    { key: 'ProductName', header: 'Product', width: 18 },
    { key: 'IOCode', header: 'IO Code', width: 8 },
    { key: 'IOName', header: 'IO Name', width: 25 },
    { key: 'Bytes', header: 'Bytes', width: 8 },
    { key: 'MinValue', header: 'Min Value', width: 12 },
    { key: 'MaxValue', header: 'Max Value', width: 12 },
    { key: 'Multiplier', header: 'Multiplier', width: 12 },
    { key: 'Offset', header: 'Offset', width: 10 },
    { key: 'Unit', header: 'Unit', width: 10 },
    { key: 'ErrorValues', header: 'Error Values', width: 20 },
    { key: 'ConversionFormula', header: 'Conversion Formula', width: 25 },
    { key: 'Averaging', header: 'Averaging', width: 12 },
    { key: 'EventOnChange', header: 'Event On Change', width: 15 },
    { key: 'EventOnHysterisis', header: 'Event On Hysterisis', width: 18 },
    { key: 'ParameterGroup', header: 'Parameter Group', width: 20 },
    { key: 'Description', header: 'Description', width: 30 },
    { key: 'RawValueJson', header: 'Raw Values (JSON)', width: 40 },
  ];

  // Template columns for import
  const templateColumns: ExportColumn[] = [
    { key: 'IOID', header: 'IO ID', width: 8 },
    { key: 'VendorName', header: 'Vendor', width: 18 },
    { key: 'ProductName', header: 'Product (optional)', width: 18 },
    { key: 'IOCode', header: 'IO Code', width: 8 },
    { key: 'IOName', header: 'IO Name', width: 25 },
    { key: 'Bytes', header: 'Bytes', width: 8 },
    { key: 'MinValue', header: 'Min Value', width: 12 },
    { key: 'MaxValue', header: 'Max Value', width: 12 },
    { key: 'Multiplier', header: 'Multiplier', width: 12 },
    { key: 'Offset', header: 'Offset', width: 10 },
    { key: 'Unit', header: 'Unit', width: 10 },
    { key: 'ErrorValues', header: 'Error Values', width: 20 },
    { key: 'ConversionFormula', header: 'Conversion Formula', width: 25 },
    { key: 'Averaging', header: 'Averaging', width: 12 },
    { key: 'EventOnChange', header: 'Event On Change (true/false)', width: 20 },
    { key: 'EventOnHysterisis', header: 'Event On Hysterisis (true/false)', width: 22 },
    { key: 'ParameterGroup', header: 'Parameter Group', width: 20 },
    { key: 'Description', header: 'Description', width: 30 },
    { key: 'RawValueJson', header: 'Raw Values (JSON format)', width: 50 },
  ];

  // Export/Import handlers
  const handleExportExcel = () => exportToExcel(mappings, exportColumns, 'io_mappings');
  const handleExportPDF = () => exportToPDF(mappings, exportColumns, 'io_mappings', 'IO Mappings List');
  const handleDownloadTemplate = () => downloadTemplate(
    templateColumns,
    'io_mappings',
    [{
      IOID: 1,
      VendorName: 'Vendor Name (must exist)',
      ProductName: '',
      IOCode: 'A1',
      IOName: 'Sample IO Name',
      Bytes: 4,
      MinValue: 0,
      MaxValue: 100,
      Multiplier: 1,
      Offset: 0,
      Unit: 'V',
      ErrorValues: '',
      ConversionFormula: '',
      Averaging: '',
      EventOnChange: false,
      EventOnHysterisis: false,
      ParameterGroup: '',
      Description: 'Sample description',
      RawValueJson: '{"data":[{"value":0,"label":"Off","description":""},{"value":1,"label":"On","description":""}]}'
    }]
  );

  const handleImport = async (file: File) => {
    const { data, errors } = await parseExcelFile<IOMappingCreate & { VendorName?: string; ProductName?: string }>(file, templateColumns);
    if (errors.length > 0) throw new Error(errors.join(', '));

    let successCount = 0;
    const failedRows: string[] = [];

    for (let i = 0; i < data.length; i++) {
      const mapping = data[i];
      if (mapping.IOID && mapping.IOCode) {
        const vendor = vendors.find(v => v.VendorName.toLowerCase() === (mapping.VendorName || '').toLowerCase());
        const product = mapping.ProductName ? products.find(p => p.ProductName.toLowerCase() === (mapping.ProductName || '').toLowerCase()) : undefined;

        if (vendor) {
          try {
            // Parse boolean values from string if needed
            const eventOnChangeVal = mapping.EventOnChange;
            const eventOnChange = typeof eventOnChangeVal === 'string'
              ? (eventOnChangeVal as string).toLowerCase() === 'true'
              : Boolean(eventOnChangeVal);
            const eventOnHysterisisVal = mapping.EventOnHysterisis;
            const eventOnHysterisis = typeof eventOnHysterisisVal === 'string'
              ? (eventOnHysterisisVal as string).toLowerCase() === 'true'
              : Boolean(eventOnHysterisisVal);

            await createItem<IOMapping, IOMappingCreate>('/api/io-mappings', {
              IOID: mapping.IOID,
              VendorID: vendor.VendorID,
              ProductID: product?.ProductID,
              IOCode: mapping.IOCode || '',
              IOName: mapping.IOName || '',
              Bytes: mapping.Bytes,
              MinValue: mapping.MinValue,
              MaxValue: mapping.MaxValue,
              Multiplier: mapping.Multiplier,
              Offset: mapping.Offset,
              Unit: mapping.Unit || '',
              ErrorValues: mapping.ErrorValues || '',
              ConversionFormula: mapping.ConversionFormula || '',
              Averaging: mapping.Averaging || '',
              EventOnChange: eventOnChange,
              EventOnHysterisis: eventOnHysterisis,
              ParameterGroup: mapping.ParameterGroup || '',
              Description: mapping.Description || '',
              RawValueJson: mapping.RawValueJson || undefined,
            });
            successCount++;
          } catch (e) {
            console.error('Error importing mapping:', e);
            failedRows.push(`Row ${i + 2}: ${mapping.IOCode}`);
          }
        } else {
          failedRows.push(`Row ${i + 2}: Vendor "${mapping.VendorName}" not found`);
        }
      } else {
        failedRows.push(`Row ${i + 2}: Missing IO ID or IO Code`);
      }
    }
    if (successCount > 0) fetchMappings();
    if (failedRows.length > 0) {
      throw new Error(`Imported ${successCount} of ${data.length} mappings. Failed: ${failedRows.slice(0, 5).join(', ')}${failedRows.length > 5 ? '...' : ''}`);
    }
  };

  // Handle mapping level change
  const handleLevelChange = (level: MappingLevel) => {
    setMappingLevel(level);
    if (level === 'vendor') {
      setFormData(prev => ({ ...prev, ProductID: undefined }));
    }
  };

  const vendorOptions = vendors.map(v => ({ value: v.VendorID, label: v.VendorName }));
  const productOptions = products.filter(p => !formData.VendorID || p.VendorID === formData.VendorID).map(p => ({ value: p.ProductID, label: p.ProductName }));
  const ioOptions = ioUniversal.map(io => ({ value: io.IOID, label: `${io.IOID} - ${io.IOName || 'Unnamed'}` }));

  // Get data type badge color
  const getDataTypeBadge = (dataType: string | null) => {
    if (!dataType) return 'bg-gray-100 text-gray-600';
    const type = dataType.toLowerCase();
    if (type.includes('int') || type.includes('numeric') || type.includes('decimal')) return 'bg-blue-100 text-blue-700';
    if (type.includes('float') || type.includes('real')) return 'bg-purple-100 text-purple-700';
    if (type.includes('char') || type.includes('text')) return 'bg-green-100 text-green-700';
    if (type.includes('date') || type.includes('time')) return 'bg-orange-100 text-orange-700';
    if (type.includes('bit') || type.includes('bool')) return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">IO Mappings</h1>
        <Button onClick={openCreateModal}><Plus className="w-4 h-4 mr-2" />Add Mapping</Button>
      </div>

      <Card>
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex-1"><Input placeholder="Search mappings..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div className="w-full sm:w-48"><SearchableSelect options={vendorOptions} value={filterVendor} onChange={(value) => { setFilterVendor(value); setFilterProduct(''); }} placeholder="All Vendors" /></div>
          <div className="w-full sm:w-48"><SearchableSelect options={products.filter(p => !filterVendor || p.VendorID === parseInt(filterVendor)).map(p => ({ value: p.ProductID, label: p.ProductName }))} value={filterProduct} onChange={(value) => { setFilterProduct(value); }} placeholder="All Products" /></div>
          <Button type="submit"><Search className="w-4 h-4 mr-2" />Search</Button>
        </form>

        <ImportExportBar
          onExportExcel={handleExportExcel}
          onExportPDF={handleExportPDF}
          onDownloadTemplate={handleDownloadTemplate}
          onImport={handleImport}
          entityName="IO Mappings"
          isLoading={isLoading}
        />

        {/* Expand/Collapse buttons */}
        <div className="flex gap-2 mb-4 mt-4">
          <button onClick={expandAll} className="text-sm text-blue-600 hover:text-blue-800">Expand All</button>
          <span className="text-gray-300">|</span>
          <button onClick={collapseAll} className="text-sm text-blue-600 hover:text-blue-800">Collapse All</button>
          <span className="ml-auto text-sm text-gray-500">{groupedMappings.length} IO Groups, {mappings.length} Mappings</span>
        </div>

        {/* Tree View */}
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : groupedMappings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No mappings found</div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            {groupedMappings.map((group) => (
              <div key={group.ioId} className="border-b last:border-b-0">
                {/* Group Header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleGroup(group.ioId)}
                >
                  {expandedGroups.has(group.ioId) ? (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  )}
                  <span className="font-medium text-gray-700">IO {group.ioId}</span>
                  <span className="text-gray-900">{group.ioName}</span>
                  {group.ioCategory && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700">{group.ioCategory}</span>
                  )}
                  {group.dataType && (
                    <span className={`px-2 py-0.5 text-xs rounded-full ${getDataTypeBadge(group.dataType)}`}>{group.dataType}</span>
                  )}
                  <span className="ml-auto text-sm text-gray-500">{group.mappings.length} mapping{group.mappings.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Expanded Mappings */}
                {expandedGroups.has(group.ioId) && (
                  <div className="bg-white">
                    <table className="w-full">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                        <tr>
                          <th className="px-4 py-2 text-left w-12"></th>
                          <th className="px-4 py-2 text-left">Level</th>
                          <th className="px-4 py-2 text-left">Vendor / Product</th>
                          <th className="px-4 py-2 text-left">IO Code</th>
                          <th className="px-4 py-2 text-left">IO Name</th>
                          <th className="px-4 py-2 text-left">Unit</th>
                          <th className="px-4 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.mappings.map((mapping) => (
                          <tr key={mapping.MappingID} className="border-t hover:bg-gray-50">
                            <td className="px-4 py-2"></td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-0.5 text-xs rounded-full ${mapping.ProductID ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                {mapping.ProductID ? 'Product' : 'Vendor'}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-gray-900">
                              {mapping.ProductID ? (
                                <span>{mapping.VendorName} / {mapping.ProductName}</span>
                              ) : (
                                <span>{mapping.VendorName || '-'}</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-gray-600">{mapping.IOCode || '-'}</td>
                            <td className="px-4 py-2 text-gray-900">{mapping.IOName || '-'}</td>
                            <td className="px-4 py-2 text-gray-600">{mapping.Unit || '-'}</td>
                            <td className="px-4 py-2">
                              <div className="flex gap-1 justify-end">
                                <Button variant="ghost" size="sm" onClick={() => openViewModal(mapping)}><Eye className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="sm" onClick={() => openEditModal(mapping)}><Pencil className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDelete(mapping)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingMapping ? 'Edit IO Mapping' : 'Add IO Mapping'} size="xl">
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {/* IO Universal Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <SearchableSelect
                label="IO Universal *"
                options={ioOptions}
                value={formData.IOID}
                onChange={(value) => setFormData({ ...formData, IOID: parseInt(value) || 0 })}
                placeholder="Select IO"
              />
              {validationErrors.IOID && (
                <p className="text-sm text-red-600 mt-1">{validationErrors.IOID}</p>
              )}
            </div>
            {/* Show selected IO data type */}
            {getSelectedIODataType() && (
              <div className="flex items-end pb-2">
                <span className="text-sm text-gray-600">Data Type: </span>
                <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${getDataTypeBadge(getSelectedIODataType())}`}>
                  {getSelectedIODataType()}
                </span>
              </div>
            )}
          </div>

          {/* Mapping Level Radio Buttons */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <label className="block text-sm font-medium text-gray-700 mb-3">Mapping Level *</label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mappingLevel"
                  value="vendor"
                  checked={mappingLevel === 'vendor'}
                  onChange={() => handleLevelChange('vendor')}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Vendor</span>
                <span className="text-xs text-gray-500">(Applies to all products of a vendor)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mappingLevel"
                  value="product"
                  checked={mappingLevel === 'product'}
                  onChange={() => handleLevelChange('product')}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Product</span>
                <span className="text-xs text-gray-500">(Specific to a product)</span>
              </label>
            </div>
          </div>

          {/* Vendor / Product Selection based on level */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <SearchableSelect
                label="Vendor *"
                options={vendorOptions}
                value={formData.VendorID || ''}
                onChange={(value) => setFormData({ ...formData, VendorID: parseInt(value) || undefined, ProductID: undefined })}
                placeholder="Select Vendor"
              />
              {validationErrors.VendorID && (
                <p className="text-sm text-red-600 mt-1">{validationErrors.VendorID}</p>
              )}
            </div>
            {mappingLevel === 'product' && (
              <div>
                <SearchableSelect
                  label="Product *"
                  options={productOptions}
                  value={formData.ProductID || ''}
                  onChange={(value) => setFormData({ ...formData, ProductID: parseInt(value) || undefined })}
                  placeholder="Select Product"
                  disabled={!formData.VendorID}
                />
                {validationErrors.ProductID && (
                  <p className="text-sm text-red-600 mt-1">{validationErrors.ProductID}</p>
                )}
              </div>
            )}
          </div>

          {/* IO Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="IO Code *"
              value={formData.IOCode || ''}
              onChange={(e) => setFormData({ ...formData, IOCode: e.target.value })}
              error={validationErrors.IOCode}
              maxLength={5}
            />
            <Input
              label="IO Name *"
              value={formData.IOName || ''}
              onChange={(e) => setFormData({ ...formData, IOName: e.target.value })}
              error={validationErrors.IOName}
              maxLength={255}
            />
            <div>
              <Input
                label="Bytes"
                type="number"
                value={formData.Bytes || ''}
                onChange={(e) => setFormData({ ...formData, Bytes: parseInt(e.target.value) || undefined })}
                error={validationErrors.Bytes}
              />
            </div>
          </div>

          {/* Numeric fields */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Input
                label="Multiplier"
                type="number"
                step="any"
                value={formData.Multiplier ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData({ ...formData, Multiplier: val === '' ? undefined : parseFloat(val) });
                }}
                error={validationErrors.Multiplier}
              />
            </div>
            <div>
              <Input
                label="Offset"
                type="number"
                step="any"
                value={formData.Offset ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData({ ...formData, Offset: val === '' ? undefined : parseFloat(val) });
                }}
                error={validationErrors.Offset}
              />
            </div>
            <Input label="Unit" value={formData.Unit || ''} onChange={(e) => setFormData({ ...formData, Unit: e.target.value })} maxLength={10} />
            <Input label="Parameter Group" value={formData.ParameterGroup || ''} onChange={(e) => setFormData({ ...formData, ParameterGroup: e.target.value })} maxLength={255} />
          </div>

          {/* Min/Max values */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input
                label="Min Value"
                value={formData.MinValue?.toString() || ''}
                onChange={(e) => setFormData({ ...formData, MinValue: e.target.value || undefined })}
                error={validationErrors.MinValue}
              />
            </div>
            <div>
              <Input
                label="Max Value"
                value={formData.MaxValue?.toString() || ''}
                onChange={(e) => setFormData({ ...formData, MaxValue: e.target.value || undefined })}
                error={validationErrors.MaxValue}
              />
            </div>
          </div>

          {/* Error Values and Conversion */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Error Values" value={formData.ErrorValues || ''} onChange={(e) => setFormData({ ...formData, ErrorValues: e.target.value })} maxLength={255} />
            <Input label="Conversion Formula" value={formData.ConversionFormula || ''} onChange={(e) => setFormData({ ...formData, ConversionFormula: e.target.value })} maxLength={255} />
          </div>

          {/* Averaging and Checkboxes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <Input label="Averaging" value={formData.Averaging || ''} onChange={(e) => setFormData({ ...formData, Averaging: e.target.value })} maxLength={20} />
            <div className="flex items-center gap-4 pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.EventOnChange || false}
                  onChange={(e) => setFormData({ ...formData, EventOnChange: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Event On Change</span>
              </label>
            </div>
            <div className="flex items-center gap-4 pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.EventOnHysterisis || false}
                  onChange={(e) => setFormData({ ...formData, EventOnHysterisis: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Event On Hysterisis</span>
              </label>
            </div>
          </div>

          <TextArea label="Description" value={formData.Description || ''} onChange={(e) => setFormData({ ...formData, Description: e.target.value })} rows={2} />

          {/* Raw Value JSON Editor */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">Raw Value Mappings</label>
              <Button type="button" variant="secondary" size="sm" onClick={addRawValue}>
                <Plus className="w-3 h-3 mr-1" /> Add Value
              </Button>
            </div>
            {rawValues.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No raw value mappings defined. Click &quot;Add Value&quot; to add one.</p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
                  <div className="col-span-2">Value</div>
                  <div className="col-span-4">Label</div>
                  <div className="col-span-5">Description</div>
                  <div className="col-span-1"></div>
                </div>
                {rawValues.map((entry, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={entry.value}
                        onChange={(e) => updateRawValue(index, 'value', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-4">
                      <input
                        type="text"
                        value={entry.label}
                        onChange={(e) => updateRawValue(index, 'label', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Label"
                      />
                    </div>
                    <div className="col-span-5">
                      <input
                        type="text"
                        value={entry.description}
                        onChange={(e) => updateRawValue(index, 'description', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Description (optional)"
                      />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button
                        type="button"
                        onClick={() => removeRawValue(index)}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t mt-4">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} isLoading={isSaving}>{editingMapping ? 'Update' : 'Create'}</Button>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="IO Mapping Details" size="xl">
        {viewingMapping && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div><span className="font-medium text-gray-500">IO Universal:</span> {viewingMapping.UniversalIOName || viewingMapping.IOID}</div>
              <div>
                <span className="font-medium text-gray-500">Level:</span>{' '}
                <span className={`px-2 py-0.5 text-xs rounded-full ${viewingMapping.ProductID ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {viewingMapping.ProductID ? 'Product' : 'Vendor'}
                </span>
              </div>
              <div><span className="font-medium text-gray-500">IO Code:</span> {viewingMapping.IOCode || '-'}</div>
              <div><span className="font-medium text-gray-500">IO Name:</span> {viewingMapping.IOName || '-'}</div>
              <div><span className="font-medium text-gray-500">Vendor:</span> {viewingMapping.VendorName || '-'}</div>
              <div><span className="font-medium text-gray-500">Product:</span> {viewingMapping.ProductName || '-'}</div>
              <div><span className="font-medium text-gray-500">Bytes:</span> {viewingMapping.Bytes ?? '-'}</div>
              <div><span className="font-medium text-gray-500">Unit:</span> {viewingMapping.Unit || '-'}</div>
              <div><span className="font-medium text-gray-500">Multiplier:</span> {viewingMapping.Multiplier ?? '-'}</div>
              <div><span className="font-medium text-gray-500">Offset:</span> {viewingMapping.Offset ?? '-'}</div>
              <div><span className="font-medium text-gray-500">Min Value:</span> {viewingMapping.MinValue?.toString() || '-'}</div>
              <div><span className="font-medium text-gray-500">Max Value:</span> {viewingMapping.MaxValue?.toString() || '-'}</div>
              <div><span className="font-medium text-gray-500">Error Values:</span> {viewingMapping.ErrorValues || '-'}</div>
              <div><span className="font-medium text-gray-500">Conversion Formula:</span> {viewingMapping.ConversionFormula || '-'}</div>
              <div><span className="font-medium text-gray-500">Averaging:</span> {viewingMapping.Averaging || '-'}</div>
              <div><span className="font-medium text-gray-500">Parameter Group:</span> {viewingMapping.ParameterGroup || '-'}</div>
              <div><span className="font-medium text-gray-500">Event On Change:</span> {viewingMapping.EventOnChange ? 'Yes' : 'No'}</div>
              <div><span className="font-medium text-gray-500">Event On Hysterisis:</span> {viewingMapping.EventOnHysterisis ? 'Yes' : 'No'}</div>
            </div>
            <div className="text-sm">
              <span className="font-medium text-gray-500">Description:</span>
              <p className="mt-1">{viewingMapping.Description || '-'}</p>
            </div>
            {/* Raw Value Display */}
            {viewingMapping.RawValueJson && parseRawValueJson(viewingMapping.RawValueJson).length > 0 && (
              <div className="border-t pt-4">
                <span className="font-medium text-gray-500 text-sm">Raw Value Mappings:</span>
                <div className="mt-2 border rounded overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Value</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Label</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {parseRawValueJson(viewingMapping.RawValueJson).map((entry, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 py-2">{entry.value}</td>
                          <td className="px-3 py-2">{entry.label}</td>
                          <td className="px-3 py-2">{entry.description || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
