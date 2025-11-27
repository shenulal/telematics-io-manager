'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { Button, Card, DataTable, Modal, Input, Column, ImportExportBar } from '@/components/ui';
import { Vendor, VendorCreate } from '@/types/models';
import { buildQueryString, fetchApi, createItem, updateItem, deleteItem } from '@/hooks/useApi';
import { exportToExcel, exportToPDF, downloadTemplate, parseExcelFile, ExportColumn } from '@/utils/exportImport';

// Validation errors type
interface ValidationErrors {
  VendorName?: string;
}

// Export columns configuration
const exportColumns: ExportColumn[] = [
  { key: 'VendorName', header: 'Vendor Name', width: 25 },
  { key: 'Country', header: 'Country', width: 20 },
  { key: 'Website', header: 'Website', width: 35 },
];

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [formData, setFormData] = useState<VendorCreate>({ VendorName: '', Country: '', Website: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const pageSize = 10;

  const fetchVendors = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = buildQueryString({ page: currentPage, pageSize, search });
      const response = await fetchApi<Vendor[]>(`/api/vendors${query}`);
      if (response.success && response.data) {
        setVendors(response.data);
        setTotalPages((response as unknown as { totalPages: number }).totalPages || 1);
        setTotalItems((response as unknown as { total: number }).total || 0);
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, search]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchVendors();
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};

    if (!formData.VendorName || formData.VendorName.trim() === '') {
      errors.VendorName = 'Vendor Name is required';
    } else if (formData.VendorName.length > 50) {
      errors.VendorName = 'Vendor Name cannot exceed 50 characters';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openCreateModal = () => {
    setEditingVendor(null);
    setFormData({ VendorName: '', Country: '', Website: '' });
    setValidationErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      VendorName: vendor.VendorName,
      Country: vendor.Country || '',
      Website: vendor.Website || '',
    });
    setValidationErrors({});
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      if (editingVendor) {
        await updateItem<Vendor, VendorCreate>(`/api/vendors/${editingVendor.VendorID}`, formData);
      } else {
        await createItem<Vendor, VendorCreate>('/api/vendors', formData);
      }
      setIsModalOpen(false);
      fetchVendors();
    } catch (error) {
      console.error('Error saving vendor:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (vendor: Vendor) => {
    if (!confirm(`Are you sure you want to delete "${vendor.VendorName}"?`)) return;
    try {
      await deleteItem(`/api/vendors/${vendor.VendorID}`);
      fetchVendors();
    } catch (error) {
      console.error('Error deleting vendor:', error);
    }
  };

  // Export/Import handlers
  const handleExportExcel = () => exportToExcel(vendors, exportColumns, 'vendors');
  const handleExportPDF = () => exportToPDF(vendors, exportColumns, 'vendors', 'Vendors List');
  const handleDownloadTemplate = () => downloadTemplate(exportColumns, 'vendors', [
    { VendorName: 'Sample Vendor', Country: 'USA', Website: 'https://example.com' }
  ]);

  const handleImport = async (file: File) => {
    const { data, errors } = await parseExcelFile<VendorCreate>(file, exportColumns);
    if (errors.length > 0) throw new Error(errors.join(', '));

    let successCount = 0;
    for (const vendor of data) {
      if (vendor.VendorName) {
        try {
          await createItem<Vendor, VendorCreate>('/api/vendors', vendor as VendorCreate);
          successCount++;
        } catch (e) { console.error('Error importing vendor:', e); }
      }
    }
    if (successCount > 0) fetchVendors();
    if (successCount < data.length) {
      throw new Error(`Imported ${successCount} of ${data.length} vendors. Some entries failed.`);
    }
  };

  const columns: Column<Vendor>[] = [
    { key: 'VendorName', header: 'Vendor Name' },
    { key: 'Country', header: 'Country' },
    { key: 'Website', header: 'Website', render: (v) => v.Website ? (
      <a href={v.Website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
        {v.Website}
      </a>
    ) : '-' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
        <Button onClick={openCreateModal}><Plus className="w-4 h-4 mr-2" />Add Vendor</Button>
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <form onSubmit={handleSearch} className="flex gap-4 flex-1">
            <div className="flex-1">
              <Input placeholder="Search vendors..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button type="submit"><Search className="w-4 h-4 mr-2" />Search</Button>
          </form>
        </div>

        <ImportExportBar
          onExportExcel={handleExportExcel}
          onExportPDF={handleExportPDF}
          onDownloadTemplate={handleDownloadTemplate}
          onImport={handleImport}
          entityName="Vendors"
          isLoading={isLoading}
        />

        <DataTable
          columns={columns}
          data={vendors}
          keyField="VendorID"
          isLoading={isLoading}
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          actions={(vendor) => (
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => openEditModal(vendor)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(vendor)}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          )}
        />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingVendor ? 'Edit Vendor' : 'Add Vendor'}>
        <div className="space-y-4">
          <Input
            label="Vendor Name *"
            value={formData.VendorName}
            onChange={(e) => setFormData({ ...formData, VendorName: e.target.value })}
            error={validationErrors.VendorName}
            maxLength={50}
          />
          <Input label="Country" value={formData.Country || ''} onChange={(e) => setFormData({ ...formData, Country: e.target.value })} maxLength={100} />
          <Input label="Website" value={formData.Website || ''} onChange={(e) => setFormData({ ...formData, Website: e.target.value })} type="url" maxLength={255} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} isLoading={isSaving}>{editingVendor ? 'Update' : 'Create'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
