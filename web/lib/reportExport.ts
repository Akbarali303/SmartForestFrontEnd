/**
 * Report export (PDF, Excel) using mock data. No backend.
 */

import * as XLSX from 'xlsx';

export type ReportData = {
  date: string;
  totalEvents: number;
  resolvedEvents: number;
  activeEvents: number;
  patrolsCompleted: number;
  unattendedAreas: number;
};

const REPORT_ROW_LABELS: Record<keyof Omit<ReportData, 'date'>, string> = {
  totalEvents: 'Jami hodisalar',
  resolvedEvents: 'Hal qilingan hodisalar',
  activeEvents: 'Faol hodisalar',
  patrolsCompleted: 'Patrullar bajarildi',
  unattendedAreas: 'Nazoratsiz hududlar',
};

function getReportRows(data: ReportData): [string, string | number][] {
  return [
    ['Sana', data.date],
    [REPORT_ROW_LABELS.totalEvents, data.totalEvents],
    [REPORT_ROW_LABELS.resolvedEvents, data.resolvedEvents],
    [REPORT_ROW_LABELS.activeEvents, data.activeEvents],
    [REPORT_ROW_LABELS.patrolsCompleted, data.patrolsCompleted],
    [REPORT_ROW_LABELS.unattendedAreas, data.unattendedAreas],
  ];
}

export function exportReportToExcel(data: ReportData, filename?: string): void {
  const rows = [['Operativ hisobot'], [], ['Ko\'rsatkich', 'Qiymat'], ...getReportRows(data).map(([label, value]) => [label, value])];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const colWidths = [{ wch: 28 }, { wch: 12 }];
  ws['!cols'] = colWidths;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hisobot');
  const name = filename || `hisobot_${data.date.replace(/\D/g, '')}.xlsx`;
  XLSX.writeFile(wb, name);
}

export async function exportReportToPdf(data: ReportData, filename?: string): Promise<void> {
  try {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210; // A4 portrait width (mm)
    let y = 20;

    doc.setFontSize(18);
    doc.text('Operativ hisobot', pageW / 2, y, { align: 'center' });
    y += 14;

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Sana: ${data.date}`, 20, y);
    y += 12;

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('Ko\'rsatkich', 20, y);
    doc.text('Qiymat', 120, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    const rows = getReportRows(data);
    rows.forEach(([label, value]) => {
      doc.text(String(label), 20, y);
      doc.text(String(value), 120, y);
      y += 8;
    });

    const name = filename || `hisobot_${data.date.replace(/\D/g, '')}.pdf`;
    doc.save(name);
  } catch (e) {
    console.error('PDF export failed:', e);
    throw new Error('PDF yuklab olish amalga oshmadi. jspdf o\'rnatilganligini tekshiring.');
  }
}
