'use client';

import { useRef, useState } from 'react';
import { Download, Upload, FileSpreadsheet, FileText, X } from 'lucide-react';
import Button from './Button';

interface ImportExportBarProps {
  onExportExcel: () => void;
  onExportPDF: () => void;
  onDownloadTemplate: () => void;
  onImport: (file: File) => Promise<void>;
  entityName: string;
  isLoading?: boolean;
}

export function ImportExportBar({
  onExportExcel,
  onExportPDF,
  onDownloadTemplate,
  onImport,
  entityName,
  isLoading = false,
}: ImportExportBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    setImportStatus(null);
    
    try {
      await onImport(file);
      setImportStatus({ type: 'success', message: `${entityName} imported successfully!` });
    } catch (error) {
      setImportStatus({ type: 'error', message: error instanceof Error ? error.message : 'Import failed' });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const clearStatus = () => setImportStatus(null);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Export Buttons */}
        <div className="flex items-center gap-1 border-r pr-3 mr-1">
          <span className="text-xs text-gray-500 mr-1">Export:</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={onExportExcel}
            disabled={isLoading}
            title="Export to Excel"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1" />
            Excel
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onExportPDF}
            disabled={isLoading}
            title="Export to PDF"
          >
            <FileText className="w-4 h-4 mr-1" />
            PDF
          </Button>
        </div>

        {/* Import Section */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 mr-1">Import:</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={onDownloadTemplate}
            title="Download import template"
          >
            <Download className="w-4 h-4 mr-1" />
            Template
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".xlsx,.xls"
            className="hidden"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            title="Import from Excel"
          >
            <Upload className="w-4 h-4 mr-1" />
            {isImporting ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </div>

      {/* Import Status Message */}
      {importStatus && (
        <div
          className={`flex items-center justify-between px-3 py-2 rounded text-sm ${
            importStatus.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          <span>{importStatus.message}</span>
          <button onClick={clearStatus} className="ml-2 hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

