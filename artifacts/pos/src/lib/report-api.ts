import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const BASE = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
const API = `${BASE}/api`;

function getToken(): string {
  return localStorage.getItem("pos_token") ?? "";
}

export async function fetchReport<T>(
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(API + path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

export async function postReport<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

export function formatRp(n: number): string {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

export function formatPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function exportToExcel(
  rows: Record<string, unknown>[],
  filename: string,
  sheetName = "Report"
): void {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToPDF(
  title: string,
  subtitle: string,
  head: string[],
  rows: (string | number)[][],
  filename: string
): void {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(subtitle, 14, 26);
  doc.text(`Generated: ${new Date().toLocaleString("id-ID")}`, 14, 32);

  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    head: [head],
    body: rows,
    startY: 38,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  doc.save(`${filename}.pdf`);
}

export const PRESET_RANGES = [
  { label: "Today", getValue: () => { const t = new Date().toISOString().split("T")[0]; return { startDate: t, endDate: t }; } },
  { label: "Yesterday", getValue: () => { const d = new Date(); d.setDate(d.getDate() - 1); const t = d.toISOString().split("T")[0]; return { startDate: t, endDate: t }; } },
  { label: "This Week", getValue: () => { const now = new Date(); const start = new Date(now); start.setDate(now.getDate() - now.getDay()); return { startDate: start.toISOString().split("T")[0], endDate: now.toISOString().split("T")[0] }; } },
  { label: "Last 7 Days", getValue: () => { const end = new Date(); const start = new Date(); start.setDate(end.getDate() - 6); return { startDate: start.toISOString().split("T")[0], endDate: end.toISOString().split("T")[0] }; } },
  { label: "This Month", getValue: () => { const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), 1); return { startDate: start.toISOString().split("T")[0], endDate: now.toISOString().split("T")[0] }; } },
  { label: "Last Month", getValue: () => { const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth() - 1, 1); const end = new Date(now.getFullYear(), now.getMonth(), 0); return { startDate: start.toISOString().split("T")[0], endDate: end.toISOString().split("T")[0] }; } },
];
