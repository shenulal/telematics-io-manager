'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { Button, Card, DataTable, Modal, Input, TextArea, SearchableSelect, Column, ImportExportBar } from '@/components/ui';
import { IOUniversal, IOUniversalCreate } from '@/types/models';
import { buildQueryString, fetchApi, createItem, updateItem, deleteItem } from '@/hooks/useApi';
import { exportToExcel, exportToPDF, downloadTemplate, parseExcelFile, ExportColumn } from '@/utils/exportImport';

// Category options
const categoryOptions = [
  { value: 'Analog', label: 'Analog' },
  { value: 'Digital', label: 'Digital' },
];

// SQL Server data types
const dataTypeOptions = [
  { value: 'bigint', label: 'bigint' },
  { value: 'binary', label: 'binary' },
  { value: 'bit', label: 'bit' },
  { value: 'char', label: 'char' },
  { value: 'date', label: 'date' },
  { value: 'datetime', label: 'datetime' },
  { value: 'datetime2', label: 'datetime2' },
  { value: 'datetimeoffset', label: 'datetimeoffset' },
  { value: 'decimal', label: 'decimal' },
  { value: 'float', label: 'float' },
  { value: 'geography', label: 'geography' },
  { value: 'geometry', label: 'geometry' },
  { value: 'hierarchyid', label: 'hierarchyid' },
  { value: 'image', label: 'image' },
  { value: 'int', label: 'int' },
  { value: 'money', label: 'money' },
  { value: 'nchar', label: 'nchar' },
  { value: 'ntext', label: 'ntext' },
  { value: 'numeric', label: 'numeric' },
  { value: 'nvarchar', label: 'nvarchar' },
  { value: 'real', label: 'real' },
  { value: 'smalldatetime', label: 'smalldatetime' },
  { value: 'smallint', label: 'smallint' },
  { value: 'smallmoney', label: 'smallmoney' },
  { value: 'sql_variant', label: 'sql_variant' },
  { value: 'text', label: 'text' },
  { value: 'time', label: 'time' },
  { value: 'timestamp', label: 'timestamp' },
  { value: 'tinyint', label: 'tinyint' },
  { value: 'uniqueidentifier', label: 'uniqueidentifier' },
  { value: 'varbinary', label: 'varbinary' },
  { value: 'varchar', label: 'varchar' },
  { value: 'xml', label: 'xml' },
];

// Validation errors type
interface ValidationErrors {
  IOID?: string;
  IOName?: string;
  IOCategory?: string;
  DataType?: string;
}

export default function IOUniversalPage() {
  const [ioList, setIOList] = useState<IOUniversal[]>([]);
  const [allIOIds, setAllIOIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIO, setEditingIO] = useState<IOUniversal | null>(null);
  const [formData, setFormData] = useState<IOUniversalCreate>({ IOID: 0, IOName: '', IOCategory: '', DataType: '', Unit: '', Description: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const pageSize = 10;

  // Fetch all IO IDs for validation
  const fetchAllIOIds = useCallback(async () => {
    try {
      const response = await fetchApi<IOUniversal[]>(`/api/io-universal?pageSize=10000`);
      if (response.success && response.data) {
        setAllIOIds(response.data.map(io => io.IOID));
      }
    } catch (error) {
      console.error('Error fetching IO IDs:', error);
    }
  }, []);

  const fetchIOList = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = buildQueryString({ page: currentPage, pageSize, search });
      const response = await fetchApi<IOUniversal[]>(`/api/io-universal${query}`);
      if (response.success && response.data) {
        setIOList(response.data);
        setTotalPages((response as unknown as { totalPages: number }).totalPages || 1);
        setTotalItems((response as unknown as { total: number }).total || 0);
      }
    } catch (error) {
      console.error('Error fetching IO Universal:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, search]);

  useEffect(() => {
    fetchIOList();
    fetchAllIOIds();
  }, [fetchIOList, fetchAllIOIds]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchIOList();
  };

  // Calculate next available IO ID
  const getNextIOId = (): number => {
    if (allIOIds.length === 0) return 1;
    return Math.max(...allIOIds) + 1;
  };

  // Validate IO ID
  const validateIOId = (id: number): string => {
    if (!id || id <= 0) return 'IO ID is required and must be greater than 0';
    if (allIOIds.includes(id)) return `IO ID ${id} already exists. Please choose a different ID.`;
    return '';
  };

  // Validate entire form
  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};

    if (!formData.IOID || formData.IOID <= 0) {
      errors.IOID = 'IO ID is required and must be greater than 0';
    } else if (!editingIO && allIOIds.includes(formData.IOID)) {
      errors.IOID = `IO ID ${formData.IOID} already exists. Please choose a different ID.`;
    }

    if (!formData.IOName || formData.IOName.trim() === '') {
      errors.IOName = 'IO Name is required';
    } else if (formData.IOName.length > 50) {
      errors.IOName = 'IO Name cannot exceed 50 characters';
    }

    if (!formData.IOCategory || formData.IOCategory.trim() === '') {
      errors.IOCategory = 'Category is required';
    }

    if (!formData.DataType || formData.DataType.trim() === '') {
      errors.DataType = 'Data Type is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleIOIdChange = (value: number) => {
    setFormData({ ...formData, IOID: value });
    // Clear validation error when user types
    if (validationErrors.IOID) {
      setValidationErrors({ ...validationErrors, IOID: undefined });
    }
  };

  const openCreateModal = () => {
    setEditingIO(null);
    const nextId = getNextIOId();
    setFormData({ IOID: nextId, IOName: '', IOCategory: '', DataType: '', Unit: '', Description: '' });
    setValidationErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (io: IOUniversal) => {
    setEditingIO(io);
    setFormData({
      IOID: io.IOID,
      IOName: io.IOName || '',
      IOCategory: io.IOCategory || '',
      DataType: io.DataType || '',
      Unit: io.Unit || '',
      Description: io.Description || '',
    });
    setValidationErrors({});
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      if (editingIO) {
        await updateItem<IOUniversal, IOUniversalCreate>(`/api/io-universal/${editingIO.IOID}`, formData);
      } else {
        await createItem<IOUniversal, IOUniversalCreate>('/api/io-universal', formData);
      }
      setIsModalOpen(false);
      fetchIOList();
      fetchAllIOIds(); // Refresh the list of IDs for validation
    } catch (error) {
      console.error('Error saving IO Universal:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (io: IOUniversal) => {
    if (!confirm(`Are you sure you want to delete IO "${io.IOName || io.IOID}"?`)) return;
    try {
      await deleteItem(`/api/io-universal/${io.IOID}`);
      fetchIOList();
      fetchAllIOIds(); // Refresh the list of IDs for validation
    } catch (error) {
      console.error('Error deleting IO Universal:', error);
    }
  };

  // Export columns configuration
  const exportColumns: ExportColumn[] = [
    { key: 'IOID', header: 'IO ID', width: 10 },
    { key: 'IOName', header: 'IO Name', width: 25 },
    { key: 'IOCategory', header: 'Category', width: 15 },
    { key: 'DataType', header: 'Data Type', width: 15 },
    { key: 'Unit', header: 'Unit', width: 12 },
    { key: 'Description', header: 'Description', width: 40 },
  ];

  // Export/Import handlers
  const handleExportExcel = () => exportToExcel(ioList, exportColumns, 'io_universal');
  const handleExportPDF = () => exportToPDF(ioList, exportColumns, 'io_universal', 'IO Universal List');
  const handleDownloadTemplate = () => downloadTemplate(exportColumns, 'io_universal', [
    { IOID: 1, IOName: 'Sample IO', IOCategory: 'Analog', DataType: 'float', Unit: 'V', Description: 'Sample description' }
  ]);

  const handleImport = async (file: File) => {
    const { data, errors } = await parseExcelFile<IOUniversalCreate>(file, exportColumns);
    if (errors.length > 0) throw new Error(errors.join(', '));

    let successCount = 0;
    for (const io of data) {
      if (io.IOID && io.IOName) {
        try {
          await createItem<IOUniversal, IOUniversalCreate>('/api/io-universal', {
            IOID: io.IOID,
            IOName: io.IOName || '',
            IOCategory: io.IOCategory || '',
            DataType: io.DataType || '',
            Unit: io.Unit || '',
            Description: io.Description || ''
          });
          successCount++;
        } catch (e) { console.error('Error importing IO:', e); }
      }
    }
    if (successCount > 0) { fetchIOList(); fetchAllIOIds(); }
    if (successCount < data.length) {
      throw new Error(`Imported ${successCount} of ${data.length} IO entries. Some entries failed (check for duplicate IDs).`);
    }
  };

  const columns: Column<IOUniversal>[] = [
    { key: 'IOID', header: 'IO ID', className: 'w-24' },
    { key: 'IOName', header: 'IO Name' },
    { key: 'IOCategory', header: 'Category' },
    { key: 'DataType', header: 'Data Type', className: 'w-32' },
    { key: 'Unit', header: 'Unit', className: 'w-24' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">IO Universal</h1>
        <Button onClick={openCreateModal}><Plus className="w-4 h-4 mr-2" />Add IO</Button>
      </div>

      <Card>
        <form onSubmit={handleSearch} className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder="Search IO..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <Button type="submit"><Search className="w-4 h-4 mr-2" />Search</Button>
        </form>

        <ImportExportBar
          onExportExcel={handleExportExcel}
          onExportPDF={handleExportPDF}
          onDownloadTemplate={handleDownloadTemplate}
          onImport={handleImport}
          entityName="IO Universal"
          isLoading={isLoading}
        />

        <DataTable columns={columns} data={ioList} keyField="IOID" isLoading={isLoading}
          currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage}
          actions={(io) => (
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => openEditModal(io)}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(io)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
            </div>
          )}
        />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingIO ? 'Edit IO Universal' : 'Add IO Universal'} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="IO ID *"
            type="number"
            value={formData.IOID}
            onChange={(e) => handleIOIdChange(parseInt(e.target.value) || 0)}
            disabled={!!editingIO}
            error={validationErrors.IOID}
          />
          <Input
            label="IO Name *"
            value={formData.IOName || ''}
            onChange={(e) => setFormData({ ...formData, IOName: e.target.value })}
            error={validationErrors.IOName}
            maxLength={50}
          />
          <div>
            <SearchableSelect
              label="Category *"
              options={categoryOptions}
              value={formData.IOCategory || ''}
              onChange={(value) => setFormData({ ...formData, IOCategory: value })}
              placeholder="Select Category"
            />
            {validationErrors.IOCategory && (
              <p className="text-sm text-red-600 mt-1">{validationErrors.IOCategory}</p>
            )}
          </div>
          <div>
            <SearchableSelect
              label="Data Type *"
              options={dataTypeOptions}
              value={formData.DataType || ''}
              onChange={(value) => setFormData({ ...formData, DataType: value })}
              placeholder="Select Data Type"
            />
            {validationErrors.DataType && (
              <p className="text-sm text-red-600 mt-1">{validationErrors.DataType}</p>
            )}
          </div>
          <Input label="Unit" value={formData.Unit || ''} onChange={(e) => setFormData({ ...formData, Unit: e.target.value })} maxLength={50} />
          <div className="md:col-span-2">
            <TextArea label="Description" value={formData.Description || ''} onChange={(e) => setFormData({ ...formData, Description: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} isLoading={isSaving}>{editingIO ? 'Update' : 'Create'}</Button>
        </div>
      </Modal>
    </div>
  );
}
