// CSV files that open cleanly in Excel and Google Sheets (Phase 9, exports): UTF-8 with a byte-order mark (so Excel keeps
// ā, ṛ, ṣ and every Indian script as typed), CRLF line ends, every cell quoted when it needs to be. A cell that starts
// with = + - @ is prefixed with ' so a spreadsheet never runs it as a formula (CSV injection).
const cell = (v) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (columns, rows) => '﻿' + [columns, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';

/** A safe file name: letters, digits and dashes. */
export const fileName = (...parts) => parts.filter(Boolean).join('-').replace(/[^A-Za-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') + '.csv';

/** Saves the text as a file: the share sheet where the phone offers files (an installed iPhone app), else a download. */
export async function saveCsv(name, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  try {
    const file = new File([blob], name, { type: 'text/csv' });
    if (navigator.canShare?.({ files: [file] }) && matchMedia('(display-mode: standalone)').matches && /iPhone|iPad/.test(navigator.userAgent)) {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    }
  } catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  const url = URL.createObjectURL(blob), a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'downloaded';
}
