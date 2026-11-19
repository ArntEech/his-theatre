/**
 * CSV export that opens cleanly in Excel and Google Sheets.
 *
 * Security: a cell that starts with = + - @ (or a tab / carriage return) is run as a formula
 * by spreadsheet apps. Member names and notes are typed by people, so every such cell is
 * prefixed with an apostrophe to keep it as plain text ("CSV injection").
 */
export type Cell = string | number | null | undefined;

export function safeCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Cell[][]): string {
  return rows.map((r) => r.map(safeCell).join(",")).join("\r\n");
}

/** Downloads rows as a .csv file. The leading BOM makes Excel read "GH₵" correctly. */
export function downloadCsv(filename: string, rows: Cell[][]) {
  const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Pesewas as a plain number of cedis for spreadsheets (1250 → 12.5). */
export function cedis(pesewas: number): number {
  return Math.round(pesewas) / 100;
}
