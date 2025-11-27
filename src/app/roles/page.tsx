'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, Shield, Users } from 'lucide-react';
import { Button, Card, DataTable, Modal, Input, Column, TextArea } from '@/components/ui';
import { Role, RoleCreate, Permission } from '@/types/models';
import { buildQueryString, fetchApi, createItem, updateItem, deleteItem } from '@/hooks/useApi';

interface ValidationErrors {
  RoleName?: string;
}

interface GroupedPermissions {
  [module: string]: Permission[];
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [groupedPerms, setGroupedPerms] = useState<GroupedPermissions>({});
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState<RoleCreate>({ RoleName: '', Description: '', PermissionIds: [] });
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const pageSize = 10;

  const fetchPermissions = useCallback(async () => {
    try {
      const response = await fetchApi<Permission[]>('/api/permissions');
      if (response.success && response.data) {
        setPermissions(response.data);
        // Group by module
        const grouped = response.data.reduce((acc: GroupedPermissions, perm) => {
          if (!acc[perm.Module]) acc[perm.Module] = [];
          acc[perm.Module].push(perm);
          return acc;
        }, {});
        setGroupedPerms(grouped);
      }
    } catch (error) { console.error('Error fetching permissions:', error); }
  }, []);

  const fetchRoles = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = buildQueryString({ page: currentPage, pageSize, search });
      const response = await fetchApi<Role[]>(`/api/roles${query}`);
      if (response.success && response.data) {
        setRoles(response.data);
        setTotalPages(response.totalPages || 1);
        setTotalItems(response.total || 0);
      }
    } catch (error) { console.error('Error fetching roles:', error); }
    finally { setIsLoading(false); }
  }, [currentPage, search]);

  useEffect(() => { fetchPermissions(); }, [fetchPermissions]);
  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setCurrentPage(1); fetchRoles(); };

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};
    if (!formData.RoleName?.trim()) errors.RoleName = 'Role name is required';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openCreateModal = () => {
    setEditingRole(null);
    setFormData({ RoleName: '', Description: '', PermissionIds: [] });
    setValidationErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = async (role: Role) => {
    setEditingRole(role);
    try {
      const response = await fetchApi<Role & { PermissionIds: number[] }>(`/api/roles/${role.RoleID}`);
      if (response.success && response.data) {
        setFormData({
          RoleName: response.data.RoleName,
          Description: response.data.Description || '',
          PermissionIds: response.data.PermissionIds || [],
        });
      }
    } catch (error) { console.error('Error fetching role details:', error); }
    setValidationErrors({});
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setIsSaving(true);
    try {
      if (editingRole) {
        await updateItem(`/api/roles/${editingRole.RoleID}`, formData);
      } else {
        await createItem<Role, RoleCreate>('/api/roles', formData);
      }
      setIsModalOpen(false);
      fetchRoles();
    } catch (error) { console.error('Error saving role:', error); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async (role: Role) => {
    if (role.IsSystem) { alert('Cannot delete system roles'); return; }
    if (!confirm(`Are you sure you want to delete role "${role.RoleName}"?`)) return;
    try { await deleteItem(`/api/roles/${role.RoleID}`); fetchRoles(); }
    catch (error) { console.error('Error deleting role:', error); }
  };

  const toggleModulePermissions = (module: string, checked: boolean) => {
    const modulePermIds = groupedPerms[module]?.map(p => p.PermissionID) || [];
    const currentIds = formData.PermissionIds || [];
    if (checked) {
      setFormData({ ...formData, PermissionIds: [...new Set([...currentIds, ...modulePermIds])] });
    } else {
      setFormData({ ...formData, PermissionIds: currentIds.filter(id => !modulePermIds.includes(id)) });
    }
  };

  const columns: Column<Role>[] = [
    { key: 'RoleName', header: 'Role Name', render: (role) => (
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-blue-500" />
        <span className="font-medium">{role.RoleName}</span>
        {role.IsSystem && <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">System</span>}
      </div>
    )},
    { key: 'Description', header: 'Description' },
    { key: 'UserCount', header: 'Users', render: (role) => (
      <div className="flex items-center gap-1 text-gray-600">
        <Users className="w-4 h-4" />{role.UserCount || 0}
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Roles</h1>
        <Button onClick={openCreateModal}><Plus className="w-4 h-4 mr-2" />Add Role</Button>
      </div>

      <Card>
        <form onSubmit={handleSearch} className="flex gap-4 mb-6">
          <div className="flex-1"><Input placeholder="Search roles..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <Button type="submit"><Search className="w-4 h-4 mr-2" />Search</Button>
        </form>

        <DataTable columns={columns} data={roles} keyField="RoleID" isLoading={isLoading}
          currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage}
          actions={(role) => (
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => openEditModal(role)}><Pencil className="w-4 h-4" /></Button>
              {!role.IsSystem && <Button variant="ghost" size="sm" onClick={() => handleDelete(role)}><Trash2 className="w-4 h-4 text-red-500" /></Button>}
            </div>
          )}
        />
      </Card>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingRole ? 'Edit Role' : 'Add Role'} size="lg">
        <div className="space-y-4">
          <Input label="Role Name *" value={formData.RoleName || ''} onChange={(e) => setFormData({ ...formData, RoleName: e.target.value })} error={validationErrors.RoleName} disabled={editingRole?.IsSystem} />
          <TextArea label="Description" value={formData.Description || ''} onChange={(e) => setFormData({ ...formData, Description: e.target.value })} rows={2} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Permissions</label>
            <div className="space-y-4 max-h-96 overflow-y-auto border rounded-lg p-4">
              {Object.entries(groupedPerms).map(([module, perms]) => {
                const modulePermIds = perms.map(p => p.PermissionID);
                const allChecked = modulePermIds.every(id => formData.PermissionIds?.includes(id));
                const someChecked = modulePermIds.some(id => formData.PermissionIds?.includes(id));
                return (
                  <div key={module} className="border-b pb-3 last:border-b-0">
                    <label className="flex items-center gap-2 font-medium text-gray-800 mb-2">
                      <input type="checkbox" checked={allChecked} ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                        onChange={(e) => toggleModulePermissions(module, e.target.checked)} className="w-4 h-4" />
                      {module}
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 ml-6">
                      {perms.map(perm => (
                        <label key={perm.PermissionID} className="flex items-center gap-2 text-sm text-gray-600">
                          <input type="checkbox" checked={formData.PermissionIds?.includes(perm.PermissionID) || false}
                            onChange={(e) => {
                              const ids = formData.PermissionIds || [];
                              setFormData({ ...formData, PermissionIds: e.target.checked ? [...ids, perm.PermissionID] : ids.filter(id => id !== perm.PermissionID) });
                            }} className="w-4 h-4" />
                          {perm.Action}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button>
        </div>
      </Modal>
    </div>
  );
}

