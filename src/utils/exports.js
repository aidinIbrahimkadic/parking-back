// // import ExcelJS from "exceljs";
// // import { create } from "xmlbuilder2";

// // export function toCSV(rows) {
// //   if (!rows?.length) return "";
// //   const headers = Object.keys(rows[0]);
// //   const esc = (v) => {
// //     if (v == null) return "";
// //     const s = String(v);
// //     return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
// //   };
// //   const out = [headers.join(",")];
// //   for (const r of rows) out.push(headers.map((h) => esc(r[h])).join(","));
// //   return out.join("\n");
// // }

// // export async function toXLSX(rows, sheetName = "data") {
// //   const wb = new ExcelJS.Workbook();
// //   const ws = wb.addWorksheet(sheetName);
// //   if (rows?.length) {
// //     ws.columns = Object.keys(rows[0]).map((k) => ({ header: k, key: k }));
// //     rows.forEach((r) => ws.addRow(r));
// //     ws.getRow(1).font = { bold: true };
// //   }
// //   const buf = await wb.xlsx.writeBuffer();
// //   return Buffer.from(buf);
// // }

// // export function toXML(rows, rootName = "rows", rowName = "row") {
// //   const root = { [rootName]: rows.map((r) => ({ [rowName]: r })) };
// //   return create(root).end({ prettyPrint: true });
// // }

// // src/utils/exports.js
// import * as XLSX from "xlsx";

// /** Escape za CSV ćelije */
// function csvEscape(v) {
//   const s = String(v ?? "");
//   if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
//   return s;
// }

// /** Gruba provjera da li vrijednost izgleda kao datum */
// function isDateLike(v) {
//   if (v instanceof Date) return true;
//   if (typeof v === "number") return !Number.isNaN(new Date(v).getTime());
//   if (typeof v === "string") {
//     // ISO ili "yyyy-mm-dd hh:mm:ss"
//     return /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}:\d{2})?/.test(v);
//   }
//   return false;
// }

// /** Format: 2025-08-26 14:32:10 (lokalno vrijeme servera) */
// function fmtDateTime(value) {
//   const d = new Date(value);
//   if (!isFinite(+d)) return String(value ?? "");
//   const pad = (n) => String(n).padStart(2, "0");
//   const Y = d.getFullYear();
//   const M = pad(d.getMonth() + 1);
//   const D = pad(d.getDate());
//   const h = pad(d.getHours());
//   const m = pad(d.getMinutes());
//   const s = pad(d.getSeconds());
//   return `${Y}-${M}-${D} ${h}:${m}:${s}`;
// }

// /** Normalizuj red prije exporta (datumi → string sa vremenom) */
// function normalizeRow(row) {
//   const out = {};
//   for (const [k, v] of Object.entries(row ?? {})) {
//     if (v === null || v === undefined) {
//       out[k] = "";
//     } else if (isDateLike(v) || /At$/.test(k)) {
//       out[k] = fmtDateTime(v);
//     } else if (typeof v === "object") {
//       out[k] = JSON.stringify(v);
//     } else {
//       out[k] = v;
//     }
//   }
//   return out;
// }

// /** Heuristika zaglavlja: unija svih ključeva (stabilan poredak) */
// function headersFromRows(rows = []) {
//   const set = new Set();
//   rows.forEach((r) => Object.keys(r || {}).forEach((k) => set.add(k)));
//   return Array.from(set);
// }

// /* =============== CSV =============== */
// export function toCSV(rows = []) {
//   const norm = rows.map(normalizeRow);
//   const headers = headersFromRows(norm);
//   const headLine = headers.map(csvEscape).join(",");
//   const body = norm
//     .map((r) => headers.map((h) => csvEscape(r[h] ?? "")).join(","))
//     .join("\n");
//   return `${headLine}\n${body}`;
// }

// /* =============== XLSX =============== */
// export async function toXLSX(rows = [], sheetName = "data") {
//   const norm = rows.map(normalizeRow);
//   const headers = headersFromRows(norm);
//   const aoa = [headers, ...norm.map((r) => headers.map((h) => r[h] ?? ""))];

//   const ws = XLSX.utils.aoa_to_sheet(aoa);

//   // Auto-širina kolona (gruba)
//   const colWidths = headers.map((_, ci) => {
//     const maxLen = aoa.reduce((m, row) => {
//       const val = row[ci] == null ? "" : String(row[ci]);
//       return Math.max(m, val.length);
//     }, 0);
//     return { wch: Math.min(60, Math.max(10, maxLen + 2)) };
//   });
//   ws["!cols"] = colWidths;

//   const wb = XLSX.utils.book_new();
//   XLSX.utils.book_append_sheet(wb, ws, sheetName);
//   // Node buffer
//   const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
//   return buf;
// }

// /* =============== XML =============== */
// function xmlEscape(s) {
//   return String(s ?? "")
//     .replace(/&/g, "&amp;")
//     .replace(/</g, "&lt;")
//     .replace(/>/g, "&gt;")
//     .replace(/"/g, "&quot;")
//     .replace(/'/g, "&apos;");
// }

// export function toXML(rows = [], rootName = "rows", itemName = "row") {
//   const norm = rows.map(normalizeRow);
//   const headers = headersFromRows(norm);
//   const items = norm
//     .map(
//       (r) =>
//         `<${itemName}>` +
//         headers.map((h) => `<${h}>${xmlEscape(r[h] ?? "")}</${h}>`).join("") +
//         `</${itemName}>`
//     )
//     .join("");
//   return `<?xml version="1.0" encoding="UTF-8"?>\n<${rootName}>${items}</${rootName}>`;
// }

// src/utils/exports.js

/** -------- Helpers -------- */

const DATE_KEY_RX =
  /(createdat|updatedat|publishedat|created_at|updated_at|published_at|date$|_date$|time$|_time$)/i;

function isIsoDateString(s) {
  // "2025-08-26", "2025-08-26T14:15:00Z", "2025-08-26 14:15:00"
  return (
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+\-]\d{2}:\d{2})?)?$/.test(
      s
    )
  );
}

/** Format: 2025-08-26 14:32:10 (lokalno vrijeme) */
function fmtDateTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (!isFinite(+d)) return String(value ?? "");
  const pad = (n) => String(n).padStart(2, "0");
  const Y = d.getFullYear();
  const M = pad(d.getMonth() + 1);
  const D = pad(d.getDate());
  const h = pad(d.getHours());
  const m = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}

/** Odredi da li je polje datum:
 * - ključ izgleda kao datum (createdAt, *_date, *_time...)
 * - ili je vrijednost string u ISO formatu (ne i broj!)
 */
function isDateField(key, val) {
  if (val instanceof Date) return true;
  if (DATE_KEY_RX.test(String(key))) return true;
  if (typeof val === "string" && isIsoDateString(val)) return true;
  return false;
}

/** Escape za CSV ćelije */
function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Heuristika zaglavlja: unija svih ključeva (stabilan poredak) */
function headersFromRows(rows = []) {
  const set = new Set();
  rows.forEach((r) => Object.keys(r || {}).forEach((k) => set.add(k)));
  return Array.from(set);
}

/** Normalizuj red za export:
 * - datumi → "YYYY-MM-DD HH:mm:ss"
 * - objekti → JSON string
 * - ostalo ostaje kako jeste (brojevi ostaju brojevi!)
 */
function normalizeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row ?? {})) {
    if (v == null) out[k] = "";
    else if (isDateField(k, v)) out[k] = fmtDateTime(v);
    else if (typeof v === "object") out[k] = JSON.stringify(v);
    else out[k] = v; // broj ostaje broj
  }
  return out;
}

/** -------- CSV -------- */
export function toCSV(rows = []) {
  const norm = rows.map(normalizeRow);
  const headers = headersFromRows(norm);
  const headLine = headers.map(csvEscape).join(",");
  const body = norm
    .map((r) => headers.map((h) => csvEscape(r[h] ?? "")).join(","))
    .join("\n");
  return `${headLine}\n${body}`;
}

/** -------- XLSX (lenjo učitavanje) -------- */
async function loadXLSX() {
  try {
    const mod = await import("xlsx");
    return mod?.default ?? mod;
  } catch (e) {
    const err = new Error(
      'XLSX export zahtijeva paket "xlsx". Instaliraj: npm i xlsx'
    );
    err.cause = e;
    throw err;
  }
}

export async function toXLSX(rows = [], sheetName = "parkings") {
  const XLSX = await loadXLSX();

  const norm = rows.map(normalizeRow); // zadrži brojeve kao brojeve
  const headers = headersFromRows(norm);
  const aoa = [headers, ...norm.map((r) => headers.map((h) => r[h] ?? ""))];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Auto širina kolona (gruba procjena)
  const colWidths = headers.map((_, ci) => {
    const maxLen = aoa.reduce((m, row) => {
      const val = row[ci] == null ? "" : String(row[ci]);
      return Math.max(m, val.length);
    }, 0);
    return { wch: Math.min(60, Math.max(10, maxLen + 2)) };
  });
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  return XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
}

/** -------- XML -------- */
function xmlEscape(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function toXML(rows = [], rootName = "parkings", itemName = "parking") {
  const norm = rows.map(normalizeRow);
  const headers = headersFromRows(norm);
  const items = norm
    .map(
      (r) =>
        `<${itemName}>` +
        headers.map((h) => `<${h}>${xmlEscape(r[h] ?? "")}</${h}>`).join("") +
        `</${itemName}>`
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<${rootName}>${items}</${rootName}>`;
}
