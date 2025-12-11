'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { Button, Card, DataTable, Modal, Input, SearchableSelect, TextArea, Column, ImportExportBar } from '@/components/ui';
import { Product, ProductCreate, Vendor } from '@/types/models';
import { buildQueryString, fetchApi, createItem, updateItem, deleteItem } from '@/hooks/useApi';
import { exportToExcel, exportToPDF, downloadTemplate, parseExcelFile, ExportColumn } from '@/utils/exportImport';

// Validation errors type
interface ValidationErrors {
  VendorID?: string;
  ProductName?: string;
}

// Export columns configuration
const exportColumns: ExportColumn[] = [
  { key: 'ProductName', header: 'Product Name', width: 25 },
  { key: 'VendorName', header: 'Vendor', width: 25 },
  { key: 'TempTypeId', header: 'Type ID', width: 12 },
  { key: 'Description', header: 'Description', width: 40 },
];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductCreate>({ VendorID: 0, ProductName: '', Description: '', TempTypeId: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const pageSize = 10;

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = buildQueryString({ page: currentPage, pageSize, search, vendorId: filterVendor || undefined });
      const response = await fetchApi<Product[]>(`/api/products${query}`);
      if (response.success && response.data) {
        setProducts(response.data);
        setTotalPages((response as unknown as { totalPages: number }).totalPages || 1);
        setTotalItems((response as unknown as { total: number }).total || 0);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, search, filterVendor]);

  const fetchVendors = useCallback(async () => {
    try {
      const response = await fetchApi<Vendor[]>('/api/vendors?pageSize=1000');
      if (response.success && response.data) {
        setVendors(response.data);
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  }, []);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchProducts();
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};

    if (!formData.VendorID || formData.VendorID === 0) {
      errors.VendorID = 'Vendor is required';
    }

    if (!formData.ProductName || formData.ProductName.trim() === '') {
      errors.ProductName = 'Product Name is required';
    } else if (formData.ProductName.length > 50) {
      errors.ProductName = 'Product Name cannot exceed 50 characters';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData({ VendorID: 0, ProductName: '', Description: '', TempTypeId: 0 });
    setValidationErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      VendorID: product.VendorID,
      ProductName: product.ProductName,
      Description: product.Description || '',
      TempTypeId: product.TempTypeId,
    });
    setValidationErrors({});
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      if (editingProduct) {
        await updateItem<Product, ProductCreate>(`/api/products/${editingProduct.ProductID}`, formData);
      } else {
        await createItem<Product, ProductCreate>('/api/products', formData);
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (error) {
      console.error('Error saving product:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Are you sure you want to delete "${product.ProductName}"?`)) return;
    try {
      await deleteItem(`/api/products/${product.ProductID}`);
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  // Export/Import handlers
  const handleExportExcel = () => exportToExcel(products, exportColumns, 'products');
  const handleExportPDF = () => exportToPDF(products, exportColumns, 'products', 'Products List');
  const handleDownloadTemplate = () => downloadTemplate(
    [{ key: 'ProductName', header: 'Product Name', width: 25 }, { key: 'VendorName', header: 'Vendor', width: 25 }, { key: 'TempTypeId', header: 'Type ID', width: 12 }, { key: 'Description', header: 'Description', width: 40 }],
    'products',
    [{ ProductName: 'Sample Product', VendorName: 'Vendor Name (must exist)', TempTypeId: 1, Description: 'Product description' }]
  );

  const handleImport = async (file: File) => {
    const { data, errors } = await parseExcelFile<ProductCreate & { VendorName?: string }>(file, exportColumns);
    if (errors.length > 0) throw new Error(errors.join(', '));

    let successCount = 0;
    for (const product of data) {
      if (product.ProductName) {
        // Find vendor by name
        const vendor = vendors.find(v => v.VendorName.toLowerCase() === (product.VendorName || '').toLowerCase());
        if (vendor) {
          try {
            await createItem<Product, ProductCreate>('/api/products', {
              VendorID: vendor.VendorID,
              ProductName: product.ProductName || '',
              Description: product.Description || '',
              TempTypeId: product.TempTypeId || 0
            });
            successCount++;
          } catch (e) { console.error('Error importing product:', e); }
        }
      }
    }
    if (successCount > 0) fetchProducts();
    if (successCount < data.length) {
      throw new Error(`Imported ${successCount} of ${data.length} products. Some entries failed (check vendor names).`);
    }
  };

  const columns: Column<Product>[] = [
    { key: 'ProductName', header: 'Product Name' },
    { key: 'VendorName', header: 'Vendor' },
    { key: 'TempTypeId', header: 'Type ID', className: 'w-24' },
    { key: 'Description', header: 'Description', render: (p) => (
      <span className="truncate max-w-xs block">{p.Description || '-'}</span>
    )},
  ];

  const vendorOptions = vendors.map(v => ({ value: v.VendorID, label: v.VendorName }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Products</h1>
        <Button onClick={openCreateModal}><Plus className="w-4 h-4 mr-2" />Add Product</Button>
      </div>

      <Card>
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex-1"><Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div className="w-full sm:w-56">
            <SearchableSelect options={vendorOptions} value={filterVendor} onChange={(value) => { setFilterVendor(value); setCurrentPage(1); }} placeholder="All Vendors" />
          </div>
          <Button type="submit"><Search className="w-4 h-4 mr-2" />Search</Button>
        </form>

        <ImportExportBar
          onExportExcel={handleExportExcel}
          onExportPDF={handleExportPDF}
          onDownloadTemplate={handleDownloadTemplate}
          onImport={handleImport}
          entityName="Products"
          isLoading={isLoading}
        />

        <DataTable columns={columns} data={products} keyField="ProductID" isLoading={isLoading}
          currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage}
          actions={(product) => (
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => openEditModal(product)}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(product)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
            </div>
          )}
        />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingProduct ? 'Edit Product' : 'Add Product'}>
        <div className="space-y-4">
          <div>
            <SearchableSelect
              label="Vendor *"
              options={vendorOptions}
              value={formData.VendorID}
              onChange={(value) => setFormData({ ...formData, VendorID: parseInt(value) || 0 })}
              placeholder="Select Vendor"
            />
            {validationErrors.VendorID && (
              <p className="text-sm text-red-600 mt-1">{validationErrors.VendorID}</p>
            )}
          </div>
          <Input
            label="Product Name *"
            value={formData.ProductName}
            onChange={(e) => setFormData({ ...formData, ProductName: e.target.value })}
            error={validationErrors.ProductName}
            maxLength={50}
          />
          <Input label="Type ID" type="number" value={formData.TempTypeId} onChange={(e) => setFormData({ ...formData, TempTypeId: parseInt(e.target.value) || 0 })} />
          <TextArea label="Description" value={formData.Description || ''} onChange={(e) => setFormData({ ...formData, Description: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} isLoading={isSaving}>{editingProduct ? 'Update' : 'Create'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
