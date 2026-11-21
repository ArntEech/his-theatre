/**
 * Spreadsheet-safe CSV. Text that starts with = + - @ could run as a formula in Excel or
 * Google Sheets, so it gets a leading apostrophe. Plain numbers, like -12.50, are left alone.
 */
export function csvCell(raw: string): string {
  const v = /^[=+\-@\t\r]/.test(raw) && !/^-?\d+(\.\d+)?$/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** Saves text as a file on this device (Downloads on phones). */
export function downloadText(filename: string, text: string, type = "text/csv") {
  // The BOM makes Excel read names with accents correctly.
  const blob = new Blob(["﻿", text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
