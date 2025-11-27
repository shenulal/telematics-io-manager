import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Column definition for export
export interface ExportColumn {
  key: string;
  header: string;
  width?: number;
}

// Export data to Excel
export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn[],
  filename: string
): void {
  // Map data to only include specified columns with proper headers
  const exportData = data.map(row => {
    const exportRow: Record<string, unknown> = {};
    columns.forEach(col => {
      exportRow[col.header] = row[col.key] ?? '';
    });
    return exportRow;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  
  // Set column widths
  const colWidths = columns.map(col => ({ wch: col.width || 15 }));
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${filename}.xlsx`);
}

// Export data to PDF
export function exportToPDF<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn[],
  filename: string,
  title: string
): void {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  
  // Add title
  doc.setFontSize(16);
  doc.text(title, 14, 15);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);

  // Prepare table data
  const headers = columns.map(col => col.header);
  const rows = data.map(row => columns.map(col => {
    const value = row[col.key];
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  }));

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 28,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  doc.save(`${filename}.pdf`);
}

// Download Excel template for import
export function downloadTemplate(
  columns: ExportColumn[],
  filename: string,
  sampleData?: Record<string, unknown>[]
): void {
  const headers = columns.map(col => col.header);
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);
  
  // Add sample data if provided
  if (sampleData && sampleData.length > 0) {
    const dataRows = sampleData.map(row => 
      columns.map(col => row[col.key] ?? '')
    );
    XLSX.utils.sheet_add_aoa(worksheet, dataRows, { origin: 'A2' });
  }

  // Set column widths
  worksheet['!cols'] = columns.map(col => ({ wch: col.width || 15 }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
  
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${filename}_template.xlsx`);
}

// Parse Excel file for import
export async function parseExcelFile<T>(
  file: File,
  columns: ExportColumn[]
): Promise<{ data: Partial<T>[]; errors: string[] }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
        
        // Map headers back to keys
        const headerToKey: Record<string, string> = {};
        columns.forEach(col => { headerToKey[col.header] = col.key; });
        
        const mappedData: Partial<T>[] = jsonData.map(row => {
          const mappedRow: Record<string, unknown> = {};
          Object.entries(row).forEach(([header, value]) => {
            const key = headerToKey[header];
            if (key) mappedRow[key] = value;
          });
          return mappedRow as Partial<T>;
        });
        
        resolve({ data: mappedData, errors: [] });
      } catch (error) {
        resolve({ data: [], errors: [`Failed to parse Excel file: ${error}`] });
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

