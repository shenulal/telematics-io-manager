'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Eye, Clock, User, Activity } from 'lucide-react';
import { Button, Card, DataTable, Modal, Input, Column, SearchableSelect } from '@/components/ui';
import { AuditLog } from '@/types/models';
import { buildQueryString, fetchApi } from '@/hooks/useApi';

const MODULES = ['Vendors', 'Products', 'IOUniversal', 'IOMapping', 'Users', 'Roles', 'Auth', 'Audit'];
const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'EXPORT', 'IMPORT'];

interface UserOption {
  UserID: number;
  Username: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewingLog, setViewingLog] = useState<AuditLog | null>(null);
  const pageSize = 25;

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = buildQueryString({
        page: currentPage, pageSize, search,
        module: moduleFilter, action: actionFilter,
        userId: userFilter,
        dateFrom, dateTo
      });
      const response = await fetchApi<AuditLog[]>(`/api/audit-logs${query}`);
      if (response.success && response.data) {
        setLogs(response.data);
        setTotalPages(response.totalPages || 1);
        setTotalItems(response.total || 0);
      }
    } catch (error) { console.error('Error fetching audit logs:', error); }
    finally { setIsLoading(false); }
  }, [currentPage, search, moduleFilter, actionFilter, userFilter, dateFrom, dateTo]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetchApi<UserOption[]>(`/api/users?pageSize=1000`);
      if (response.success && response.data) {
        setUsers(response.data);
      }
    } catch (error) { console.error('Error fetching users:', error); }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setCurrentPage(1); fetchLogs(); };
  const clearFilters = () => { setSearch(''); setModuleFilter(''); setActionFilter(''); setUserFilter(''); setDateFrom(''); setDateTo(''); setCurrentPage(1); };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-700';
      case 'UPDATE': return 'bg-blue-100 text-blue-700';
      case 'DELETE': return 'bg-red-100 text-red-700';
      case 'LOGIN': return 'bg-purple-100 text-purple-700';
      case 'LOGOUT': return 'bg-gray-100 text-gray-700';
      case 'LOGIN_FAILED': return 'bg-orange-100 text-orange-700';
      case 'EXPORT': return 'bg-cyan-100 text-cyan-700';
      case 'IMPORT': return 'bg-indigo-100 text-indigo-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const columns: Column<AuditLog>[] = [
    { key: 'Timestamp', header: 'Time', render: (log) => (
      <div className="flex items-center gap-1 text-sm text-gray-600">
        <Clock className="w-3 h-3" />{formatDate(log.Timestamp)}
      </div>
    )},
    { key: 'Username', header: 'User', render: (log) => (
      <div className="flex items-center gap-1">
        <User className="w-3 h-3 text-gray-400" />{log.Username || 'System'}
      </div>
    )},
    { key: 'Action', header: 'Action', render: (log) => (
      <span className={`px-2 py-1 text-xs rounded-full ${getActionColor(log.Action)}`}>{log.Action}</span>
    )},
    { key: 'Module', header: 'Module' },
    { key: 'RecordDescription', header: 'Description', render: (log) => (
      <span className="text-sm text-gray-600 truncate max-w-xs block">{log.RecordDescription || '-'}</span>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Activity className="w-6 h-6" />Audit Logs
        </h1>
      </div>

      <Card>
        <form onSubmit={handleSearch} className="space-y-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <SearchableSelect label="" value={moduleFilter} onChange={setModuleFilter} options={[{ value: '', label: 'All Modules' }, ...MODULES.map(m => ({ value: m, label: m }))]} />
            <SearchableSelect label="" value={actionFilter} onChange={setActionFilter} options={[{ value: '', label: 'All Actions' }, ...ACTIONS.map(a => ({ value: a, label: a }))]} />
            <SearchableSelect label="" value={userFilter} onChange={setUserFilter} options={[{ value: '', label: 'All Users' }, ...users.map(u => ({ value: u.UserID.toString(), label: u.Username }))]} />
            <div className="flex gap-2">
              <Button type="submit"><Search className="w-4 h-4" /></Button>
              <Button type="button" variant="secondary" onClick={clearFilters}><Filter className="w-4 h-4" /></Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Input type="date" label="Date From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input type="date" label="Date To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </form>

        <DataTable columns={columns} data={logs} keyField="AuditLogID" isLoading={isLoading}
          currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage}
          actions={(log) => (
            <Button variant="ghost" size="sm" onClick={() => setViewingLog(log)}><Eye className="w-4 h-4" /></Button>
          )}
        />
      </Card>

      <Modal isOpen={!!viewingLog} onClose={() => setViewingLog(null)} title="Audit Log Details" size="lg">
        {viewingLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm text-gray-500">Time</label><p className="font-medium">{formatDate(viewingLog.Timestamp)}</p></div>
              <div><label className="text-sm text-gray-500">User</label><p className="font-medium">{viewingLog.Username || 'System'}</p></div>
              <div><label className="text-sm text-gray-500">Action</label><p><span className={`px-2 py-1 text-xs rounded-full ${getActionColor(viewingLog.Action)}`}>{viewingLog.Action}</span></p></div>
              <div><label className="text-sm text-gray-500">Module</label><p className="font-medium">{viewingLog.Module}</p></div>
              <div><label className="text-sm text-gray-500">Record ID</label><p className="font-medium">{viewingLog.RecordID || '-'}</p></div>
              <div><label className="text-sm text-gray-500">IP Address</label><p className="font-medium font-mono text-sm">{viewingLog.IPAddress || '-'}</p></div>
            </div>
            <div><label className="text-sm text-gray-500">Description</label><p className="font-medium">{viewingLog.RecordDescription || '-'}</p></div>
            {viewingLog.OldValue && (
              <div><label className="text-sm text-gray-500">Old Value</label><pre className="mt-1 p-3 bg-red-50 rounded text-xs overflow-auto max-h-40">{viewingLog.OldValue}</pre></div>
            )}
            {viewingLog.NewValue && (
              <div><label className="text-sm text-gray-500">New Value</label><pre className="mt-1 p-3 bg-green-50 rounded text-xs overflow-auto max-h-40">{viewingLog.NewValue}</pre></div>
            )}
            {viewingLog.UserAgent && (
              <div><label className="text-sm text-gray-500">User Agent</label><p className="text-xs text-gray-600 break-all">{viewingLog.UserAgent}</p></div>
            )}
          </div>
        )}
        <div className="flex justify-end mt-6"><Button variant="secondary" onClick={() => setViewingLog(null)}>Close</Button></div>
      </Modal>
    </div>
  );
}

