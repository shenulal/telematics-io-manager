'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, UserCheck, UserX } from 'lucide-react';
import { Button, Card, DataTable, Modal, Input, Column, SearchableSelect } from '@/components/ui';
import { User, UserCreate, Role } from '@/types/models';
import { buildQueryString, fetchApi, createItem, updateItem, deleteItem } from '@/hooks/useApi';

interface ValidationErrors {
  Username?: string;
  Email?: string;
  Password?: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserCreate>({ Username: '', Email: '', Password: '', FirstName: '', LastName: '', IsActive: true, RoleIds: [] });
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const pageSize = 10;

  const fetchRoles = useCallback(async () => {
    try {
      const response = await fetchApi<Role[]>('/api/roles?pageSize=100');
      if (response.success && response.data) setRoles(response.data);
    } catch (error) { console.error('Error fetching roles:', error); }
  }, []);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = buildQueryString({ page: currentPage, pageSize, search });
      const response = await fetchApi<User[]>(`/api/users${query}`);
      if (response.success && response.data) {
        setUsers(response.data);
        setTotalPages(response.totalPages || 1);
        setTotalItems(response.total || 0);
      }
    } catch (error) { console.error('Error fetching users:', error); }
    finally { setIsLoading(false); }
  }, [currentPage, search]);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setCurrentPage(1); fetchUsers(); };

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};
    if (!formData.Username?.trim()) errors.Username = 'Username is required';
    if (!formData.Email?.trim()) errors.Email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.Email)) errors.Email = 'Invalid email format';
    if (!editingUser && !formData.Password?.trim()) errors.Password = 'Password is required';
    else if (formData.Password && formData.Password.length < 6) errors.Password = 'Password must be at least 6 characters';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({ Username: '', Email: '', Password: '', FirstName: '', LastName: '', IsActive: true, RoleIds: [] });
    setValidationErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = async (user: User) => {
    setEditingUser(user);
    // Fetch user details with roles
    try {
      const response = await fetchApi<User & { Roles: Role[] }>(`/api/users/${user.UserID}`);
      if (response.success && response.data) {
        const userData = response.data;
        setFormData({
          Username: userData.Username,
          Email: userData.Email,
          Password: '',
          FirstName: userData.FirstName || '',
          LastName: userData.LastName || '',
          IsActive: userData.IsActive,
          RoleIds: userData.Roles?.map((r: Role) => r.RoleID) || [],
        });
      }
    } catch (error) { console.error('Error fetching user details:', error); }
    setValidationErrors({});
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setIsSaving(true);
    try {
      if (editingUser) {
        const updateData: Record<string, unknown> = { ...formData };
        if (!updateData.Password) delete updateData.Password;
        await updateItem(`/api/users/${editingUser.UserID}`, updateData);
      } else {
        await createItem<User, UserCreate>('/api/users', formData);
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (error) { console.error('Error saving user:', error); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Are you sure you want to delete user "${user.Username}"?`)) return;
    try { await deleteItem(`/api/users/${user.UserID}`); fetchUsers(); }
    catch (error) { console.error('Error deleting user:', error); }
  };

  const toggleUserStatus = async (user: User) => {
    try {
      await updateItem(`/api/users/${user.UserID}`, { IsActive: !user.IsActive });
      fetchUsers();
    } catch (error) { console.error('Error toggling user status:', error); }
  };

  const roleOptions = roles.map(r => ({ value: r.RoleID, label: r.RoleName }));

  const columns: Column<User>[] = [
    { key: 'Username', header: 'Username' },
    { key: 'Email', header: 'Email' },
    { key: 'FirstName', header: 'First Name' },
    { key: 'LastName', header: 'Last Name' },
    { key: 'RoleNames', header: 'Roles' },
    { key: 'IsActive', header: 'Status', render: (user) => (
      <span className={`px-2 py-1 text-xs rounded-full ${user.IsActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
        {user.IsActive ? 'Active' : 'Inactive'}
      </span>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <Button onClick={openCreateModal}><Plus className="w-4 h-4 mr-2" />Add User</Button>
      </div>

      <Card>
        <form onSubmit={handleSearch} className="flex gap-4 mb-6">
          <div className="flex-1"><Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <Button type="submit"><Search className="w-4 h-4 mr-2" />Search</Button>
        </form>

        <DataTable columns={columns} data={users} keyField="UserID" isLoading={isLoading}
          currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage}
          actions={(user) => (
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => toggleUserStatus(user)} title={user.IsActive ? 'Deactivate' : 'Activate'}>
                {user.IsActive ? <UserX className="w-4 h-4 text-orange-500" /> : <UserCheck className="w-4 h-4 text-green-500" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => openEditModal(user)}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(user)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
            </div>
          )}
        />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingUser ? 'Edit User' : 'Add User'} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Username *" value={formData.Username || ''} onChange={(e) => setFormData({ ...formData, Username: e.target.value })} error={validationErrors.Username} disabled={!!editingUser} />
          <Input label="Email *" type="email" value={formData.Email || ''} onChange={(e) => setFormData({ ...formData, Email: e.target.value })} error={validationErrors.Email} />
          <Input label={editingUser ? 'New Password (leave blank to keep)' : 'Password *'} type="password" value={formData.Password || ''} onChange={(e) => setFormData({ ...formData, Password: e.target.value })} error={validationErrors.Password} />
          <Input label="First Name" value={formData.FirstName || ''} onChange={(e) => setFormData({ ...formData, FirstName: e.target.value })} />
          <Input label="Last Name" value={formData.LastName || ''} onChange={(e) => setFormData({ ...formData, LastName: e.target.value })} />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" checked={formData.IsActive} onChange={(e) => setFormData({ ...formData, IsActive: e.target.checked })} className="w-4 h-4" />
            <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Roles</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {roles.map(role => (
              <label key={role.RoleID} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={formData.RoleIds?.includes(role.RoleID) || false}
                  onChange={(e) => {
                    const ids = formData.RoleIds || [];
                    setFormData({ ...formData, RoleIds: e.target.checked ? [...ids, role.RoleID] : ids.filter(id => id !== role.RoleID) });
                  }} className="w-4 h-4" />
                {role.RoleName}
              </label>
            ))}
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

