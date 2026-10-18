/**
 * printPdfExport.js
 *
 * Two export modes for JobbyHop Admin PDF exports:
 *  1. exportRecordsToPrintPdf     - compact TABLE layout (legacy, kept for compatibility)
 *  2. exportDetailedRecordsToPdf  - rich CARD layout: one card per record with
 *     labelled sections and key-value pairs (complete details mode)
 */

function _openPrintWindow() {
  const win = window.open('', '_blank', 'width=960,height=750');
  if (!win) {
    alert('Please allow popups for JobbyHop to print or save PDF.');
    return null;
  }
  return win;
}

function _generatedDate() {
  return new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const SHARED_CSS = `
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
                 'Helvetica Neue', Arial, sans-serif;
    margin: 0; padding: 20px; color: #0f172a; background: #fff;
    font-size: 11px; line-height: 1.5;
  }
  .actions-bar { margin-bottom: 16px; display: flex; gap: 8px; }
  .btn {
    padding: 8px 16px; border-radius: 8px; font-size: 12px;
    font-weight: 700; cursor: pointer; border: none;
  }
  .btn-print { background: #8b5cf6; color: #fff; }
  .btn-close  { background: #e2e8f0; color: #334155; }
  .doc-header {
    display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 3px solid #8b5cf6; padding-bottom: 12px; margin-bottom: 14px;
  }
  .brand { font-size: 22px; font-weight: 900; color: #0f172a; margin: 0 0 4px; }
  .brand-badge {
    display: inline-block; font-size: 10px; background: #8b5cf6; color: #fff;
    padding: 2px 8px; border-radius: 6px; font-weight: 700;
    letter-spacing: .05em; vertical-align: middle; margin-left: 8px;
  }
  .brand-sub { font-size: 11px; color: #64748b; margin: 0; }
  .meta-box { text-align: right; font-size: 11px; color: #64748b; line-height: 1.6; }
  .meta-box strong { color: #0f172a; }
  .summary-pill {
    display: inline-block; margin-bottom: 12px; padding: 5px 12px;
    border-radius: 8px; background: #f1f5f9; border: 1px solid #cbd5e1;
    font-size: 11px; font-weight: 700; color: #334155;
  }
  .doc-footer {
    margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 6px;
    display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8;
  }
`;

export function resolveAssetUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  const origin = (typeof window !== 'undefined' && window.location?.origin)
    ? window.location.origin
    : '';
  if (trimmed.startsWith('/')) {
    return `${origin}${trimmed}`;
  }
  return `${origin}/${trimmed}`;
}

/**
 * isRealUploadedImage — returns true ONLY when `url` is a genuine uploaded
 * profile photo (i.e. a path in /uploads/, a data:image/ base64, or an
 * external http(s) URL that is NOT a known placeholder/avatar service).
 *
 * Returns false for:
 *  - null / undefined / empty string
 *  - strings containing: default, placeholder, avatar, dicebear, initials,
 *    fallback, generic, dummy, unknown, gravatar
 */
export function isRealUploadedImage(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Reject any URL that looks like a placeholder / avatar generator
  const lc = trimmed.toLowerCase();
  const FAKE_PATTERNS = [
    'default', 'placeholder', 'avatar', 'dicebear', 'initials',
    'fallback', 'generic', 'dummy', 'unknown', 'gravatar',
    'ui-avatar', 'boring-avatar', 'robohash', 'adorable',
  ];
  if (FAKE_PATTERNS.some((p) => lc.includes(p))) return false;

  // Accept real uploads: /uploads/... or uploads/...
  if (lc.startsWith('/uploads/') || lc.startsWith('uploads/')) return true;

  // Accept base64 data URIs for images
  if (lc.startsWith('data:image/')) return true;

  // Accept external http(s) URLs that passed the fake-pattern check above
  if (lc.startsWith('http://') || lc.startsWith('https://')) return true;

  return false;
}

/* ── CARD-SPECIFIC CSS ── */
const CARD_CSS = `
  .record-card {
    border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;
    margin-bottom: 20px; background: #fff; page-break-inside: avoid;
  }
  .page-break-after { page-break-after: always; }
  .record-number {
    font-size: 9px; font-weight: 800; text-transform: uppercase;
    letter-spacing: .08em; color: #94a3b8;
    margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px dashed #e2e8f0;
  }
  .section { margin-bottom: 12px; }
  .section-heading {
    font-size: 9px; font-weight: 800; text-transform: uppercase;
    letter-spacing: .08em; padding: 3px 8px; margin-bottom: 6px;
    background: #f8fafc; border-radius: 0 4px 4px 0;
  }
  .kv-table { width: 100%; border-collapse: collapse; }
  .kv-label {
    width: 38%; padding: 4px 8px 4px 4px; font-size: 10px; font-weight: 600;
    color: #64748b; vertical-align: top; border-bottom: 1px solid #f1f5f9;
  }
  .kv-value {
    padding: 4px 4px 4px 8px; font-size: 10px; color: #0f172a;
    vertical-align: top; border-bottom: 1px solid #f1f5f9; word-break: break-word;
  }
  .section-with-photo {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }
  .photo-container {
    flex-shrink: 0;
    width: 68px;
    height: 68px;
  }
  .worker-profile-photo {
    width: 68px;
    height: 68px;
    max-width: 68px;
    max-height: 68px;
    object-fit: cover;
    border-radius: 8px;
    border: 2px solid #8b5cf6;
    display: block;
    background: #f8fafc;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  @media print {
    .worker-profile-photo {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
`;

/* ─────────────────────────────────────────────────────────────────────────────
   Helper: build the full HTML document string
───────────────────────────────────────────────────────────────────────────── */
function _buildHtmlDoc({ title, subtitle, bodyHtml, genDate, recordCount, landscape, extraCss, filename }) {
  const pageSize = landscape ? 'landscape' : 'portrait';
  const margins  = landscape ? '10mm 14mm' : '12mm 12mm';
  const safeDocTitle = filename ? filename.replace(/\.pdf$/i, '') : `JobbyHop_${title.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;
  const origin = (typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : '';
  const baseTag = origin ? `<base href="${origin}/" />` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  ${baseTag}
  <title>${safeDocTitle}</title>
  <style>
    @page { size: A4 ${pageSize}; margin: ${margins}; }
    ${SHARED_CSS}
    ${extraCss || ''}
  </style>
</head>
<body>
  <div class="actions-bar no-print">
    <button class="btn btn-print" onclick="window.print()">Print / Save as PDF</button>
    <button class="btn btn-close" onclick="window.close()">Close</button>
  </div>
  <div class="doc-header">
    <div>
      <h1 class="brand">JOBBYHOP <span class="brand-badge">${title}</span></h1>
      <p class="brand-sub">${subtitle || 'Exported Records Report'}</p>
    </div>
    <div class="meta-box">
      <div>Generated: <strong>${genDate}</strong></div>
      <div>Selected Records: <strong>${recordCount}</strong></div>
    </div>
  </div>
  ${bodyHtml}
  <div class="doc-footer">
    <span>JobbyHop On-Demand Event Staffing Platform</span>
    <span>Confidential Administrative Record</span>
  </div>
  <script>
    (function() {
      function syncAndPrint() {
        var images = Array.from(document.querySelectorAll('img'));
        
        function syncOneImage(img) {
          return new Promise(function(resolve) {
            if (img.complete && img.naturalWidth > 0) {
              if (typeof img.decode === 'function') {
                img.decode().then(resolve).catch(function() { resolve(); });
              } else {
                resolve();
              }
              return;
            }
            if (img.complete && img.naturalWidth === 0) {
              resolve();
              return;
            }

            var timer = setTimeout(function() {
              resolve();
            }, 6000);

            function onDone() {
              clearTimeout(timer);
              img.removeEventListener('load', onLoad);
              img.removeEventListener('error', onError);
              if (typeof img.decode === 'function') {
                img.decode().then(resolve).catch(function() { resolve(); });
              } else {
                resolve();
              }
            }

            function onLoad() { onDone(); }
            function onError() {
              clearTimeout(timer);
              img.removeEventListener('load', onLoad);
              img.removeEventListener('error', onError);
              resolve();
            }

            img.addEventListener('load', onLoad);
            img.addEventListener('error', onError);
          });
        }

        var fontPromise = (document.fonts && document.fonts.ready)
          ? document.fonts.ready.catch(function() {})
          : Promise.resolve();

        Promise.all([fontPromise].concat(images.map(syncOneImage))).then(function() {
          requestAnimationFrame(function() {
            requestAnimationFrame(function() {
              setTimeout(function() {
                window.print();
              }, 150);
            });
          });
        });
      }

      if (document.readyState === 'complete') {
        syncAndPrint();
      } else {
        window.addEventListener('load', syncAndPrint, { once: true });
      }
    })();
  </script>
</body>
</html>`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   1. TABLE layout (legacy - preserved for backward compatibility)
───────────────────────────────────────────────────────────────────────────── */
export function exportRecordsToPrintPdf({
  title = 'JobbyHop Report',
  subtitle = '',
  columns = [],
  data = [],
  landscape = false,
  filename = '',
}) {
  if (!data || data.length === 0) return;
  const win = _openPrintWindow();
  if (!win) return;
  const genDate = _generatedDate();

  const headers = columns.map((col) =>
    `<th style="text-align:${col.align || 'left'};padding:8px 12px;background:#0f172a;color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #334155;">${col.header}</th>`
  ).join('');

  const rows = data.map((row, idx) => {
    const bg = idx % 2 === 0 ? '#fff' : '#f8fafc';
    const cells = columns.map((col) => {
      let v = col.accessor ? col.accessor(row) : (row[col.key] ?? '—');
      if (v === undefined || v === null || v === '') v = '—';
      return `<td style="text-align:${col.align || 'left'};padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:10px;color:#1e293b;vertical-align:top;">${v}</td>`;
    }).join('');
    return `<tr style="background:${bg};">${cells}</tr>`;
  }).join('');

  const tableCss = `table{width:100%;border-collapse:collapse;page-break-inside:auto;}tr{page-break-inside:avoid;page-break-after:auto;}`;

  const bodyHtml = `
    <div class="summary-pill">Showing ${data.length} selected record${data.length !== 1 ? 's' : ''} from ${title}.</div>
    <table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;

  const html = _buildHtmlDoc({ title, subtitle, bodyHtml, genDate, recordCount: data.length, landscape, extraCss: tableCss });
  win.document.open();
  win.document.write(html);
  win.document.close();
}

/* ─────────────────────────────────────────────────────────────────────────────
   2. DETAILED CARD layout — complete record details

   buildCard(record, index) must return an array of Section objects:
   {
     heading: string,          // e.g. 'EVENT INFORMATION'
     color:   string,          // accent hex colour (optional, default purple)
     photo:   string,          // optional profile photo URL/base64
     rows:    [string, any][], // array of [label, value] pairs
   }
───────────────────────────────────────────────────────────────────────────── */
export function exportDetailedRecordsToPdf({
  title = 'JobbyHop Report',
  subtitle = '',
  records = [],
  buildCard,
  landscape = false,
  filename = '',
}) {
  if (!records || records.length === 0) return;
  if (typeof buildCard !== 'function') {
    console.error('exportDetailedRecordsToPdf: buildCard(record, index) function is required');
    return;
  }
  const win = _openPrintWindow();
  if (!win) return;
  const genDate = _generatedDate();

  const escHtml = (str) => String(str ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const cardsHtml = records.map((rec, recIdx) => {
    const sections = buildCard(rec, recIdx) || [];

    const sectionsHtml = sections.map((sec) => {
      if (!sec || !sec.rows || sec.rows.length === 0) return '';
      const accent = sec.color || '#8b5cf6';

      const rowsHtml = sec.rows
        .filter((r) => {
          if (!r || !Array.isArray(r)) return false;
          const val = r[1];
          return val !== null && val !== undefined && String(val).trim() !== '' && val !== '—';
        })
        .map(([label, val]) => `
          <tr>
            <td class="kv-label">${escHtml(label)}</td>
            <td class="kv-value">${escHtml(val)}</td>
          </tr>`)
        .join('');

      if (!rowsHtml.trim()) return '';

      // Determine photo: only use sec.photo / sec.image when it is a REAL
      // uploaded image — never fall back to a default / generated avatar.
      const rawPhoto = sec.photo || sec.image || null;
      const isReal = isRealUploadedImage(rawPhoto);
      const photoUrl = isReal ? resolveAssetUrl(rawPhoto) : null;

      let sectionContent = `<table class="kv-table"><tbody>${rowsHtml}</tbody></table>`;
      if (photoUrl) {
        sectionContent = `
          <div class="section-with-photo">
            <div class="photo-container">
              <img src="${escHtml(photoUrl)}" alt="Profile Photo" class="worker-profile-photo" onerror="this.onerror=null;this.parentElement.style.display='none';" />
            </div>
            <table class="kv-table" style="flex:1;"><tbody>${rowsHtml}</tbody></table>
          </div>`;
      }

      return `
        <div class="section">
          <div class="section-heading" style="border-left:3px solid ${accent};color:${accent};">
            ${escHtml(sec.heading || '')}
          </div>
          ${sectionContent}
        </div>`;
    }).join('');

    const isLast = recIdx === records.length - 1;
    return `
      <div class="record-card${isLast ? '' : ' page-break-after'}">
        <div class="record-number">Record ${recIdx + 1} of ${records.length}</div>
        ${sectionsHtml}
      </div>`;
  }).join('');

  const bodyHtml = `
    <div class="summary-pill">
      Exporting complete details for ${records.length} selected record${records.length !== 1 ? 's' : ''} from ${title}.
    </div>
    ${cardsHtml}`;

  const html = _buildHtmlDoc({ title, subtitle, bodyHtml, genDate, recordCount: records.length, landscape, extraCss: CARD_CSS, filename });
  win.document.open();
  win.document.write(html);
  win.document.close();
}

/* ─────────────────────────────────────────────────────────────────────────────
   3. STRICT 2-PAGE WORKER REPORT (ADMIN WORKER OFFICIAL DOSSIER)
   Page 1: Worker Profile, Personal Info, Activity Summary, Applications History
   Page 2: Attendance History, Events & Completion, Payment History, Recruiter/Event Details, Account Info
───────────────────────────────────────────────────────────────────────────── */

const WORKER_REPORT_CSS = `
  @page {
    size: A4 portrait;
    margin: 5mm 6mm;
  }
  @media print {
    body {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .report-page-1 {
      page-break-after: always !important;
      break-after: page !important;
    }
    .report-page-2 {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    .no-print {
      display: none !important;
    }
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: #0f172a;
    background: #fff;
    margin: 0;
    padding: 0;
    font-size: 7.5px;
    line-height: 1.25;
  }
  .report-page-container {
    width: 100%;
    max-width: 198mm;
    margin: 0 auto;
  }
  .report-page {
    position: relative;
    box-sizing: border-box;
    width: 100%;
    max-height: 287mm;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    padding: 0;
    margin: 0;
  }
  .report-page-break {
    page-break-after: always !important;
    break-after: page !important;
  }
  .page-header-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1.5px solid #8b5cf6;
    padding-bottom: 2px;
    margin-bottom: 3px;
  }
  .page-header-bar .brand-title {
    font-size: 11px;
    font-weight: 900;
    color: #0f172a;
    letter-spacing: -0.02em;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .page-header-bar .brand-pill {
    background: #8b5cf6;
    color: #fff;
    font-size: 6.5px;
    font-weight: 800;
    padding: 1px 5px;
    border-radius: 3px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .page-header-bar .page-meta {
    text-align: right;
    font-size: 6.8px;
    color: #64748b;
    line-height: 1.2;
  }
  .page-header-bar .page-meta strong {
    color: #0f172a;
  }
  .page-footer-bar {
    border-top: 1px solid #cbd5e1;
    padding-top: 2px;
    margin-top: 3px;
    display: flex;
    justify-content: space-between;
    font-size: 6.5px;
    color: #94a3b8;
  }
  .sec-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #f8fafc;
    border-left: 2.5px solid #8b5cf6;
    border-radius: 0 3px 3px 0;
    padding: 1.5px 5px;
    font-size: 7.5px;
    font-weight: 800;
    color: #0f172a;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-top: 2.5px;
    margin-bottom: 2px;
  }
  .sec-heading .badge-count {
    background: #ede9fe;
    color: #6d28d9;
    padding: 0.5px 4px;
    border-radius: 9999px;
    font-size: 6.5px;
    font-weight: 700;
  }
  .profile-grid {
    display: flex;
    gap: 6px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 3px 5px;
    margin-bottom: 3px;
  }
  .profile-photo-box {
    width: 52px;
    height: 52px;
    border-radius: 4px;
    border: 1.5px solid #8b5cf6;
    overflow: hidden;
    background: #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .profile-photo-box img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .profile-photo-placeholder {
    font-size: 6.5px;
    font-weight: 700;
    color: #64748b;
    text-align: center;
    padding: 2px;
    line-height: 1.15;
  }
  .kv-table {
    width: 100%;
    border-collapse: collapse;
  }
  .kv-table td {
    padding: 1px 2px;
    border: none;
    font-size: 7px;
    vertical-align: top;
    line-height: 1.18;
  }
  .kv-table .lbl {
    color: #64748b;
    font-weight: 600;
    width: 38%;
  }
  .kv-table .val {
    color: #0f172a;
    font-weight: 600;
    width: 62%;
    overflow-wrap: break-word;
    word-break: normal;
  }
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 3px;
    margin-bottom: 2.5px;
  }
  .metric-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 2px 3.5px;
  }
  .metric-card .m-lbl {
    font-size: 6px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    color: #64748b;
    line-height: 1.1;
  }
  .metric-card .m-val {
    font-size: 10px;
    font-weight: 900;
    color: #0f172a;
    margin-top: 1px;
    line-height: 1.1;
  }
  .metric-card.accent-emerald { border-left: 2.5px solid #10b981; }
  .metric-card.accent-purple { border-left: 2.5px solid #8b5cf6; }
  .metric-card.accent-amber { border-left: 2.5px solid #f59e0b; }
  .metric-card.accent-rose { border-left: 2.5px solid #ef4444; }
  .metric-card.accent-cyan { border-left: 2.5px solid #06b6d4; }
  .report-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 6.8px;
    margin-bottom: 2.5px;
    table-layout: auto;
  }
  .report-table thead {
    display: table-header-group;
  }
  .report-table tr {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .report-table th {
    background: #0f172a;
    color: #f8fafc;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    padding: 1.8px 3px;
    border: 1px solid #334155;
    text-align: left;
    font-size: 6.5px;
    line-height: 1.15;
    vertical-align: middle;
  }
  .report-table td {
    padding: 1.5px 3px;
    border: 1px solid #e2e8f0;
    color: #1e293b;
    vertical-align: top;
    font-size: 6.8px;
    line-height: 1.18;
    overflow-wrap: break-word;
    word-break: normal;
  }
  .report-table tbody tr:nth-child(even) td {
    background: #f8fafc;
  }
  .empty-msg {
    text-align: center;
    padding: 4px;
    color: #94a3b8;
    font-style: italic;
    background: #f8fafc;
    border: 1px dashed #cbd5e1;
    border-radius: 4px;
    margin-bottom: 3px;
    font-size: 6.8px;
  }
  .badge {
    display: inline-block;
    padding: 0.5px 3.5px;
    border-radius: 2.5px;
    font-size: 6px;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    white-space: nowrap;
    line-height: 1.15;
  }
  .banner-box {
    display: flex;
    justify-content: space-around;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    padding: 2.5px 5px;
    margin-bottom: 2.5px;
  }
  .banner-item {
    text-align: center;
  }
  .banner-item .b-lbl {
    font-size: 6px;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
  }
  .banner-item .b-val {
    font-size: 10px;
    font-weight: 900;
    color: #0f172a;
    margin-top: 0.5px;
  }
  .audit-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 2.5px 5px;
    margin-top: 1.5px;
  }
`;

export function exportWorker2PageReportPdf({
  workers = [],
  filename = '',
}) {
  if (!workers || workers.length === 0) return;
  const win = _openPrintWindow();
  if (!win) return;
  const genDate = _generatedDate();

  const esc = (str) => {
    if (str === null || str === undefined || str === '') return '—';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  const formatDate = (d) => {
    if (!d) return '—';
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
    } catch (e) {
      return '—';
    }
  };

  const formatDateTime = (d) => {
    if (!d) return '—';
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch (e) {
      return '—';
    }
  };

  const getLocationString = (loc) => {
    if (!loc) return 'Not Available';
    if (typeof loc === 'string') {
      const trimmed = loc.trim();
      return trimmed ? trimmed : 'Not Available';
    }
    if (typeof loc === 'object') {
      if (loc.address && typeof loc.address === 'string' && loc.address.trim()) {
        return loc.address.trim();
      }
      const parts = [loc.street, loc.city, loc.state, loc.pincode].filter(Boolean);
      if (parts.length > 0) return parts.join(', ');
      return 'Not Available';
    }
    return String(loc);
  };

  const renderBadge = (status, customColor) => {
    const raw = String(status || '—').trim();
    const s = raw.toUpperCase();
    let bg = '#f1f5f9';
    let color = '#475569';
    let border = '#cbd5e1';

    if (customColor) {
      bg = `${customColor}15`;
      color = customColor;
      border = `${customColor}40`;
    } else if (['ACTIVE', 'APPROVED', 'ACCEPTED', 'PRESENT', 'PAID', 'COMPLETED', 'VERIFIED'].includes(s)) {
      bg = '#ecfdf5'; color = '#065f46'; border = '#a7f3d0';
    } else if (['PENDING', 'APPLIED', 'PROCESSING', 'ASSIGNED', 'CONFIRMED', 'IN PROGRESS'].includes(s)) {
      bg = '#fffbeb'; color = '#92400e'; border = '#fde68a';
    } else if (['REJECTED', 'ABSENT', 'CANCELLED', 'FAILED', 'BLOCKED', 'SUSPENDED', 'DELETED', 'DEACTIVATED', 'NOT COMPLETED'].includes(s)) {
      bg = '#fef2f2'; color = '#991b1b'; border = '#fecaca';
    }

    return `<span class="badge" style="background:${bg};color:${color};border:1px solid ${border};">${esc(s)}</span>`;
  };

  const fullReportsHtml = workers.map((worker, workerIdx) => {
    const profile = worker.profile || {};
    const fullName = profile.fullName || worker.fullName || 'Worker';
    const workerId = worker.id || worker._id || worker.userId?._id || profile.userId || '—';
    const email = worker.email || profile.email || worker.userId?.email || '—';
    const phone = profile.phone || worker.phone || worker.userId?.phone || '—';
    const location = getLocationString(profile.location || worker.location);
    const dob = formatDate(profile.dob || worker.dob);
    const skills = (Array.isArray(profile.skills) && profile.skills.length > 0)
      ? profile.skills.join(', ')
      : (typeof profile.skills === 'string' && profile.skills.trim() ? profile.skills.trim() : 'Not Available');

    // Account status
    const accountStatus = (worker.isDeleted || worker.userId?.isDeleted)
      ? 'DELETED'
      : (worker.status || worker.userId?.status || 'ACTIVE');

    // Profile photo check
    const rawPhoto = profile.profilePhoto || worker.profilePhoto || worker.userId?.profilePhoto || null;
    const isRealPhoto = isRealUploadedImage(rawPhoto);
    const photoUrl = isRealPhoto ? resolveAssetUrl(rawPhoto) : null;

    // Experience format
    let experienceHtml = '<span style="color:#64748b;font-style:italic;">Not Available</span>';
    if (Array.isArray(profile.experience) && profile.experience.length > 0) {
      experienceHtml = profile.experience.map((e) => `
        <div style="margin-bottom:1px;">
          <strong style="color:#0f172a;">${esc(e.title || 'Role')}</strong>
          ${e.eventType ? `<span style="color:#8b5cf6;">(${esc(e.eventType)})</span>` : ''}
          ${e.duration ? `• <span style="color:#64748b;">${esc(e.duration)}</span>` : ''}
          ${e.description ? `— <span style="color:#334155;">${esc(e.description)}</span>` : ''}
        </div>
      `).join('');
    } else if (typeof profile.experience === 'string' && profile.experience.trim()) {
      experienceHtml = esc(profile.experience);
    }

    // Availability format
    let availabilityText = 'Flexible';
    if (profile.availability) {
      const isAvail = profile.availability.isAvailable !== false;
      const slots = profile.availability.availableTimeSlots?.length ? profile.availability.availableTimeSlots.join(', ') : '';
      const types = profile.availability.preferredEventTypes?.length ? profile.availability.preferredEventTypes.join(', ') : '';
      availabilityText = `${isAvail ? '✓ Available for Shifts' : '✗ Unavailable'}${slots ? ` • Slots: ${slots}` : ''}${types ? ` • Preferred: ${types}` : ''}`;
    }

    const applications = worker.applications || [];
    const assignments = worker.assignments || [];
    const attendance = worker.attendance || [];
    const payments = worker.payments || [];

    // ── SECTION 2 CALCULATIONS (Strict Single Source of Truth from DB records) ──
    const totalApps = applications.length;
    const acceptedApps = applications.filter((a) => a.status === 'APPROVED' || a.status === 'ACCEPTED').length;
    const rejectedApps = applications.filter((a) => a.status === 'REJECTED').length;
    const pendingApps = applications.filter((a) => a.status === 'APPLIED' || a.status === 'PENDING').length;
    const cancelledApps = applications.filter((a) => a.status === 'CANCELLED' || a.status === 'WITHDRAWN').length;

    const totalAssigned = assignments.length;
    // Consistent single counting rule: Worker assignment records with status 'COMPLETED'
    const completedEvents = assignments.filter((a) => a.status === 'COMPLETED').length;

    // Strict verified present events calculation:
    // Only unique events whose attendance is verified and marked PRESENT by Admin count as attended
    const verifiedPresentJobIds = new Set();
    attendance.forEach((att) => {
      if (att.status === 'PRESENT' && att.verifiedByAdminId && !att.isDeleted) {
        const jId = (att.jobId?._id || att.jobId)?.toString();
        if (jId) verifiedPresentJobIds.add(jId);
      }
    });
    const verifiedPresentCount = verifiedPresentJobIds.size;

    const absentEventsCount = attendance.filter((a) => a.status === 'ABSENT' && !a.isDeleted).length;
    const upcomingEventsCount = assignments.filter((a) =>
      (a.status === 'ASSIGNED' || a.status === 'CONFIRMED') &&
      (a.jobId?.eventDate ? new Date(a.jobId.eventDate) >= new Date() : true)
    ).length;
    const cancelledAssignmentsCount = assignments.filter((a) =>
      a.status === 'CANCELLED' || a.jobId?.status === 'CANCELLED'
    ).length;

    // Helper to resolve recruiter name and contact safely
    const getRecruiterInfo = (j) => {
      if (!j) return { name: 'Not Available', email: 'Not Available', phone: 'Not Available' };
      const rp = j.recruiterProfile || {};
      const rId = j.recruiterId || {};
      const name = rp.companyName || rp.fullName || (typeof rId === 'object' ? rId.fullName || rId.name : null) || (typeof rId === 'object' && rId.email ? rId.email : null) || 'Not Available';
      const email = (typeof rId === 'object' ? rId.email : null) || rp.email || 'Not Available';
      const phone = rp.phone || (typeof rId === 'object' ? rId.phone : null) || 'Not Available';
      return { name, email, phone };
    };

    // ── SECTION 3: APPLICATIONS ROWS ───────────────────────────────────────
    const appRowsHtml = applications.length === 0
      ? `<tr><td colspan="8" class="empty-msg">No job applications recorded for this worker.</td></tr>`
      : applications.map((app, i) => {
        const j = app.jobId || {};
        const rec = getRecruiterInfo(j);
        const appliedDate = formatDate(app.appliedAt || app.createdAt);
        const eventDate = formatDate(j.eventDate);
        const decisionDate = formatDate(app.reviewedAt || app.updatedAt);
        const eventTitle = esc(j.title || 'Event');
        const loc = getLocationString(j.location);
        return `
          <tr>
            <td style="text-align:center;">${i + 1}</td>
            <td style="font-family:monospace;font-size:6.5px;">${esc(app._id?.toString() || '—')}</td>
            <td><strong>${eventTitle}</strong><div style="color:#64748b;font-size:6.5px;margin-top:0.5px;">${esc(loc)}</div></td>
            <td><strong>${esc(rec.name)}</strong></td>
            <td style="white-space:nowrap;">${appliedDate}</td>
            <td style="white-space:nowrap;">${eventDate}</td>
            <td>${renderBadge(app.status)}</td>
            <td style="white-space:nowrap;">${decisionDate}</td>
          </tr>
        `;
      }).join('');

    // ── SECTION 4: ATTENDANCE ROWS ─────────────────────────────────────────
    const attRowsHtml = attendance.length === 0
      ? `<tr><td colspan="10" class="empty-msg">No attendance records recorded for this worker.</td></tr>`
      : attendance.map((att, i) => {
        const j = att.jobId || {};
        const eventName = j.title || j._id || '—';
        const evDate = formatDate(att.date || j.eventDate);
        const loc = getLocationString(j.location);
        const isVerified = Boolean(att.verifiedByAdminId);
        const verifiedBy = att.verifiedByAdminId?.email || (isVerified ? 'Admin Verified' : 'Unverified');
        const verDate = isVerified ? formatDate(att.updatedAt) : '—';
        const times = (att.checkInTime || att.checkOutTime) ? `${att.checkInTime || '—'} / ${att.checkOutTime || '—'}` : '—';
        const payable = j.adminApprovedPayment != null ? `₹${Number(j.adminApprovedPayment).toLocaleString('en-IN')}` : '—';
        const notes = att.notes || '—';

        return `
          <tr>
            <td style="text-align:center;">${i + 1}</td>
            <td><strong>${esc(eventName)}</strong><div style="color:#64748b;font-size:6.5px;margin-top:0.5px;">${esc(loc)}</div></td>
            <td style="white-space:nowrap;">${evDate}</td>
            <td>${renderBadge(att.status)}</td>
            <td>${renderBadge(isVerified ? 'VERIFIED' : 'UNVERIFIED', isVerified ? '#10b981' : '#f59e0b')}</td>
            <td style="font-size:6.5px;">${esc(verifiedBy)}</td>
            <td style="white-space:nowrap;">${verDate}</td>
            <td style="font-size:6.5px;white-space:nowrap;">${esc(times)}</td>
            <td style="font-weight:700;">${payable}</td>
            <td>${esc(notes)}</td>
          </tr>
        `;
      }).join('');

    // ── SECTION 5: EVENTS & COMPLETION ROWS ────────────────────────────────
    // Keeps worker assignment status and overall event lifecycle strictly separate
    const asgRowsHtml = assignments.length === 0
      ? `<tr><td colspan="9" class="empty-msg">No assigned event records found.</td></tr>`
      : assignments.map((asg, i) => {
        const j = asg.jobId || {};
        const rec = getRecruiterInfo(j);
        const loc = getLocationString(j.location);
        const evDate = formatDate(j.eventDate);
        const role = j.eventType || (j.requiredSkills?.length ? j.requiredSkills.join(', ') : 'Staff');
        // Distinct worker completion status derived strictly from assignment record
        const workerCompletionStatus = asg.status === 'COMPLETED'
          ? 'COMPLETED'
          : (asg.status === 'REJECTED' ? 'REJECTED' : (asg.status || 'IN PROGRESS'));
        const completionDate = asg.status === 'COMPLETED' ? formatDate(asg.updatedAt) : '—';
        const remarks = asg.notes || j.cancellationReason || j.adminNotes || '—';

        return `
          <tr>
            <td style="text-align:center;">${i + 1}</td>
            <td><strong>${esc(j.title || j._id || '—')}</strong><div style="color:#64748b;font-size:6.5px;margin-top:0.5px;">${esc(loc)}</div></td>
            <td><strong>${esc(rec.name)}</strong></td>
            <td><div style="white-space:nowrap;">${evDate}</div><div style="color:#8b5cf6;font-size:6.5px;">${esc(role)}</div></td>
            <td>${renderBadge(asg.status)}</td>
            <td>${renderBadge(j.status || '—')}</td>
            <td>${renderBadge(workerCompletionStatus)}</td>
            <td style="white-space:nowrap;">${completionDate}</td>
            <td>${esc(remarks)}</td>
          </tr>
        `;
      }).join('');

    // ── SECTION 6: PAYMENTS & TOTALS ───────────────────────────────────────
    let totalPayable = 0;
    let totalPaid = 0;
    const processedJobIds = new Set();
    const processedAssignmentIds = new Set();

    const paymentRows = [];

    // Process actual Payment records first (exclude soft-deleted payments from active totals)
    (payments || []).forEach((pay) => {
      const pAmount = Number(pay.amount || 0);
      const isDeleted = Boolean(pay.isDeleted);
      const isPaid = pay.status === 'PAID';
      const amountPaid = isPaid ? pAmount : 0;
      const remaining = isPaid ? 0 : pAmount;

      if (!isDeleted) {
        totalPayable += pAmount;
        totalPaid += amountPaid;
      }

      if (pay.jobId?._id || pay.jobId) processedJobIds.add((pay.jobId._id || pay.jobId).toString());
      if (pay.assignmentId?._id || pay.assignmentId) processedAssignmentIds.add((pay.assignmentId._id || pay.assignmentId).toString());

      paymentRows.push({
        sNo: paymentRows.length + 1,
        id: pay.transactionRef || pay._id?.toString() || '—',
        eventName: pay.jobId?.title || pay.jobId?._id || '—',
        payable: `₹${pAmount.toLocaleString('en-IN')}`,
        paid: `₹${amountPaid.toLocaleString('en-IN')}`,
        remaining: `₹${remaining.toLocaleString('en-IN')}`,
        status: isDeleted ? 'DELETED' : (pay.status || 'PENDING'),
        isDeleted,
        date: formatDate(pay.paidAt || pay.processedAt || pay.expectedPaymentDate || pay.createdAt),
        method: pay.paymentMethod || 'Bank Transfer / UPI',
        ref: pay.transactionRef || '—',
        remarks: isDeleted ? 'Deleted (In Trash)' : (pay.adminNotes || 'Payout via 10–15d cycle'),
      });
    });

    // Also check verified PRESENT attendance for events without a generated Payment doc
    (attendance || []).forEach((att) => {
      if (att.status === 'PRESENT' && att.verifiedByAdminId && !att.isDeleted) {
        const jId = (att.jobId?._id || att.jobId)?.toString();
        const asgId = (att.assignmentId?._id || att.assignmentId)?.toString();

        if (jId && !processedJobIds.has(jId) && asgId && !processedAssignmentIds.has(asgId)) {
          processedJobIds.add(jId);
          processedAssignmentIds.add(asgId);

          const rate = Number(att.jobId?.adminApprovedPayment || att.jobId?.offeredAmountPerPerson || 0);
          const isSettledPaid = att.assignmentId?.paymentSettlement?.status === 'PAID';
          const paidAmt = isSettledPaid ? Number(att.assignmentId?.paymentSettlement?.amount || rate) : 0;
          const remAmt = isSettledPaid ? 0 : rate;

          totalPayable += rate;
          totalPaid += paidAmt;

          paymentRows.push({
            sNo: paymentRows.length + 1,
            id: att.assignmentId?.paymentSettlement?.transactionRef || `ATT-${att._id?.toString().slice(-6) || '—'}`,
            eventName: att.jobId?.title || att.jobId?._id || '—',
            payable: `₹${rate.toLocaleString('en-IN')}`,
            paid: `₹${paidAmt.toLocaleString('en-IN')}`,
            remaining: `₹${remAmt.toLocaleString('en-IN')}`,
            status: isSettledPaid ? 'PAID' : 'PENDING',
            isDeleted: false,
            date: formatDate(att.assignmentId?.paymentSettlement?.paidAt || att.date || att.createdAt),
            method: 'Bank Transfer / UPI',
            ref: att.assignmentId?.paymentSettlement?.transactionRef || 'Pending Settlement',
            remarks: att.notes || 'Calculated from verified attendance',
          });
        }
      }
    });

    const totalOutstanding = Math.max(0, totalPayable - totalPaid);

    const paymentRowsHtml = paymentRows.length === 0
      ? `<tr><td colspan="10" class="empty-msg">No payment records found for this worker.</td></tr>`
      : paymentRows.map((p) => `
        <tr style="${p.isDeleted ? 'opacity:0.65;background:#fef2f2;' : ''}">
          <td style="text-align:center;">${p.sNo}</td>
          <td style="font-family:monospace;font-size:6.5px;">${esc(p.id)}</td>
          <td><strong>${esc(p.eventName)}</strong></td>
          <td style="font-weight:700;">${p.payable}</td>
          <td style="color:#059669;font-weight:700;">${p.paid}</td>
          <td style="color:${p.remaining !== '₹0' && !p.isDeleted ? '#d97706' : '#64748b'};font-weight:700;">${p.remaining}</td>
          <td>${renderBadge(p.status)}</td>
          <td style="white-space:nowrap;">${p.date}</td>
          <td>${esc(p.method)}</td>
          <td>${esc(p.remarks)}</td>
        </tr>
      `).join('');

    // ── SECTION 7: RECRUITER & EVENT DETAILS ──────────────────────────────
    const eventMap = new Map();
    const registerEvent = (j, extra = {}) => {
      if (!j) return;
      const jId = (j._id || j)?.toString();
      if (!jId) return;

      const rec = getRecruiterInfo(j);
      const existing = eventMap.get(jId) || {
        job: j,
        recruiterName: rec.name,
        recruiterEmail: rec.email,
        recruiterPhone: rec.phone,
        role: j.eventType || (j.requiredSkills?.length ? j.requiredSkills.join(', ') : 'Staff'),
        location: getLocationString(j.location),
        eventDate: formatDate(j.eventDate),
        time: `${j.startTime || '—'} - ${j.endTime || '—'}`,
        attendanceStatus: 'Not Marked',
        assignmentStatus: '—',
        eventStatus: j.status || '—',
        remarks: j.additionalInstructions || j.workerRequirements || '—',
      };

      if (extra.attendanceStatus) existing.attendanceStatus = extra.attendanceStatus;
      if (extra.assignmentStatus) existing.assignmentStatus = extra.assignmentStatus;
      if (extra.remarks && extra.remarks !== '—') existing.remarks = extra.remarks;

      eventMap.set(jId, existing);
    };

    applications.forEach((a) => registerEvent(a.jobId, { assignmentStatus: a.status }));
    assignments.forEach((a) => registerEvent(a.jobId, {
      assignmentStatus: a.status,
      remarks: a.notes,
    }));
    attendance.forEach((att) => registerEvent(att.jobId, {
      attendanceStatus: `${att.status || '—'} (${att.verifiedByAdminId ? 'Verified' : 'Unverified'})`,
      remarks: att.notes,
    }));

    const eventList = Array.from(eventMap.values());
    const recruiterRowsHtml = eventList.length === 0
      ? `<tr><td colspan="8" class="empty-msg">No event association records found.</td></tr>`
      : eventList.map((item, idx) => {
        const recContact = `Email: ${item.recruiterEmail}<br/>Phone: ${item.recruiterPhone}`;

        return `
          <tr>
            <td style="text-align:center;">${idx + 1}</td>
            <td><strong>${esc(item.recruiterName)}</strong></td>
            <td style="font-size:6.5px;line-height:1.15;">${recContact}</td>
            <td><strong>${esc(item.job?.title || 'Event')}</strong><div style="color:#64748b;font-size:6.5px;margin-top:0.5px;">${esc(item.location)}</div></td>
            <td><div style="white-space:nowrap;">${item.eventDate}</div><div style="color:#64748b;font-size:6.5px;">${esc(item.time)}</div></td>
            <td>${esc(item.role)}</td>
            <td>${renderBadge(item.attendanceStatus)}</td>
            <td>${renderBadge(item.eventStatus)}</td>
          </tr>
        `;
      }).join('');

    const isLastWorker = workerIdx === workers.length - 1;

    return `
      <!-- ══════════════════════════════════════════════════════════════════════
           PAGE 1: WORKER PROFILE, ACTIVITY SUMMARY & APPLICATIONS HISTORY
      ══════════════════════════════════════════════════════════════════════ -->
      <div class="report-page report-page-1 report-page-break">
        <div class="page-header-bar">
          <div class="brand-title">
            JOBBYHOP <span class="brand-pill">Worker Report</span>
          </div>
          <div class="page-meta">
            Worker: <strong>${esc(fullName)}</strong> • ID: <strong>${esc(workerId)}</strong><br/>
            <span>Page 1 of 2: Profile, Activity Summary & Applications</span>
          </div>
        </div>

        <!-- Section 1: Complete Personal Information -->
        <div class="sec-heading">
          <span>Section 1: Complete Personal Information</span>
          <span class="badge-count">${renderBadge(accountStatus)}</span>
        </div>

        <div class="profile-grid">
          <div class="profile-photo-box">
            ${photoUrl
              ? `<img src="${esc(photoUrl)}" alt="Profile Photo" onerror="this.parentElement.innerHTML='<div class=\\'profile-photo-placeholder\\'>Photo<br/>Not Available</div>';" />`
              : `<div class="profile-photo-placeholder">Photo Not Available</div>`
            }
          </div>
          <div style="flex:1;">
            <table class="kv-table">
              <tbody>
                <tr><td class="lbl">Unique Worker ID:</td><td class="val" style="font-family:monospace;font-size:6.8px;">${esc(workerId)}</td></tr>
                <tr><td class="lbl">Full Name:</td><td class="val">${esc(fullName)}</td></tr>
                <tr><td class="lbl">Registered Email:</td><td class="val">${esc(email)}</td></tr>
                <tr><td class="lbl">Mobile Number:</td><td class="val">${esc(phone)}</td></tr>
                <tr><td class="lbl">Saved Address/Location:</td><td class="val">${esc(location)}</td></tr>
                <tr><td class="lbl">Date of Birth:</td><td class="val">${dob}</td></tr>
              </tbody>
            </table>
          </div>
          <div style="flex:1;">
            <table class="kv-table">
              <tbody>
                <tr><td class="lbl">Account Status:</td><td class="val">${renderBadge(accountStatus)}</td></tr>
                <tr><td class="lbl">Registration Date:</td><td class="val">${formatDate(worker.createdAt)}</td></tr>
                <tr><td class="lbl">Rating:</td><td class="val">${profile.rating != null ? `${profile.rating} / 5.0 ⭐` : 'Unrated'}</td></tr>
                <tr><td class="lbl">Saved Skills:</td><td class="val" style="color:#7c3aed;font-weight:700;">${esc(skills)}</td></tr>
                <tr><td class="lbl">Total Lifetime Assignments:</td><td class="val">${totalAssigned || profile.totalAssignments || 0}</td></tr>
                <tr><td class="lbl">Completed Events Count:</td><td class="val">${completedEvents}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Experience & Availability Sub-table -->
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:3px 5px;margin-bottom:3px;">
          <table class="kv-table">
            <tbody>
              <tr><td class="lbl" style="width:18%;">Past Experience:</td><td class="val" style="width:82%;">${experienceHtml}</td></tr>
              <tr><td class="lbl" style="width:18%;">Availability Schedule:</td><td class="val" style="width:82%;color:#059669;">${esc(availabilityText)}</td></tr>
              ${profile.bio ? `<tr><td class="lbl" style="width:18%;">Bio / Summary:</td><td class="val" style="width:82%;">${esc(profile.bio)}</td></tr>` : ''}
            </tbody>
          </table>
        </div>

        <!-- Section 2: Worker Activity Summary -->
        <div class="sec-heading">
          <span>Section 2: Worker Activity Summary</span>
          <span class="badge-count">11 Operational Indicators</span>
        </div>

        <div class="metrics-grid">
          <div class="metric-card accent-purple">
            <div class="m-lbl">Total Applications</div>
            <div class="m-val">${totalApps}</div>
          </div>
          <div class="metric-card accent-emerald">
            <div class="m-lbl">Accepted Applications</div>
            <div class="m-val">${acceptedApps}</div>
          </div>
          <div class="metric-card accent-amber">
            <div class="m-lbl">Pending Applications</div>
            <div class="m-val">${pendingApps}</div>
          </div>
          <div class="metric-card accent-rose">
            <div class="m-lbl">Rejected Applications</div>
            <div class="m-val">${rejectedApps}</div>
          </div>
          <div class="metric-card accent-rose">
            <div class="m-lbl">Cancelled / Withdrawn</div>
            <div class="m-val">${cancelledApps}</div>
          </div>
          <div class="metric-card accent-purple">
            <div class="m-lbl">Total Assigned Events</div>
            <div class="m-val">${totalAssigned}</div>
          </div>
          <div class="metric-card accent-emerald">
            <div class="m-lbl">Completed Events</div>
            <div class="m-val">${completedEvents}</div>
          </div>
          <div class="metric-card accent-emerald" style="background:#ecfdf5;border-color:#a7f3d0;">
            <div class="m-lbl" style="color:#065f46;">Verified PRESENT Events</div>
            <div class="m-val" style="color:#065f46;">${verifiedPresentCount}</div>
          </div>
          <div class="metric-card accent-rose">
            <div class="m-lbl">ABSENT Events</div>
            <div class="m-val">${absentEventsCount}</div>
          </div>
          <div class="metric-card accent-cyan">
            <div class="m-lbl">Upcoming Events</div>
            <div class="m-val">${upcomingEventsCount}</div>
          </div>
          <div class="metric-card accent-rose">
            <div class="m-lbl">Cancelled Assignments</div>
            <div class="m-val">${cancelledAssignmentsCount}</div>
          </div>
          <div class="metric-card accent-purple">
            <div class="m-lbl">Lifecycle Status</div>
            <div class="m-val" style="font-size:8.5px;margin-top:1px;">${worker.isDeleted ? 'TRASH / DELETED' : 'ACTIVE / PRESERVED'}</div>
          </div>
        </div>

        <!-- Activity Timestamps & Verification Notice -->
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:2px 5px;font-size:6.5px;color:#64748b;display:flex;justify-content:space-between;flex-wrap:wrap;gap:3px;margin-bottom:3px;">
          <span>Account Created: <strong style="color:#0f172a;">${formatDateTime(worker.createdAt)}</strong></span>
          <span>Last Update: <strong style="color:#0f172a;">${formatDateTime(worker.updatedAt)}</strong></span>
          <span>Report Generated: <strong style="color:#0f172a;">${genDate}</strong></span>
          <span>Attendance Rule: <strong style="color:#065f46;">Only unique events with Admin-verified PRESENT count as Attended</strong></span>
        </div>

        <!-- Section 3: Complete Applications History -->
        <div class="sec-heading">
          <span>Section 3: Complete Applications History</span>
          <span class="badge-count">${applications.length} Records</span>
        </div>
        <table class="report-table">
          <thead>
            <tr>
              <th style="width:22px;text-align:center;">S.No.</th>
              <th style="width:65px;">Application ID</th>
              <th>Job / Event & Location</th>
              <th>Recruiter / Company</th>
              <th style="width:65px;">Applied Date</th>
              <th style="width:65px;">Event Date</th>
              <th style="width:60px;">Application Status</th>
              <th style="width:65px;">Decision Date</th>
            </tr>
          </thead>
          <tbody>
            ${appRowsHtml}
          </tbody>
        </table>

        <div class="page-footer-bar">
          <span>JobbyHop Administrative Platform • Strictly Confidential Record</span>
          <span>Worker: ${esc(fullName)} (${esc(workerId)})</span>
          <span>Page 1 of 2</span>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════════
           PAGE 2: ATTENDANCE, EVENTS, PAYMENTS, RECRUITER & ACCOUNT DETAILS
      ══════════════════════════════════════════════════════════════════════ -->
      <div class="report-page report-page-2${isLastWorker ? '' : ' report-page-break'}">
        <div class="page-header-bar">
          <div class="brand-title">
            JOBBYHOP <span class="brand-pill">Worker Report</span>
          </div>
          <div class="page-meta">
            Worker: <strong>${esc(fullName)}</strong> • ID: <strong>${esc(workerId)}</strong><br/>
            <span>Page 2 of 2: Attendance, Events, Payments, Recruiter & Account</span>
          </div>
        </div>

        <!-- Section 4: Complete Event Attendance History -->
        <div class="sec-heading">
          <span>Section 4: Complete Event Attendance History</span>
          <span class="badge-count">${attendance.length} Records</span>
        </div>
        <table class="report-table">
          <thead>
            <tr>
              <th style="width:22px;text-align:center;">S.No.</th>
              <th>Event Name & Location</th>
              <th style="width:60px;">Event Date</th>
              <th style="width:55px;">Attendance</th>
              <th style="width:55px;">Admin Status</th>
              <th style="width:70px;">Verified By</th>
              <th style="width:60px;">Verify Date</th>
              <th style="width:60px;">Check-In / Out</th>
              <th style="width:45px;">Payable</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${attRowsHtml}
          </tbody>
        </table>

        <!-- Section 5: Events & Completion History -->
        <div class="sec-heading">
          <span>Section 5: Events & Completion History</span>
          <span class="badge-count">${assignments.length} Records</span>
        </div>
        <table class="report-table">
          <thead>
            <tr>
              <th style="width:22px;text-align:center;">S.No.</th>
              <th>Event Title & Location</th>
              <th>Recruiter / Client</th>
              <th style="width:70px;">Date & Role</th>
              <th style="width:60px;">Assignment</th>
              <th style="width:60px;">Lifecycle</th>
              <th style="width:60px;">Completion</th>
              <th style="width:60px;">Completion Date</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${asgRowsHtml}
          </tbody>
        </table>

        <!-- Section 6: Complete Worker Payment History -->
        <div class="sec-heading">
          <span>Section 6: Complete Worker Payment History</span>
          <span class="badge-count">${paymentRows.length} Payment Items</span>
        </div>

        <!-- Payment Totals Banner -->
        <div class="banner-box">
          <div class="banner-item">
            <div class="b-lbl">Total Payable Amount</div>
            <div class="b-val" style="color:#0f172a;">₹${totalPayable.toLocaleString('en-IN')}</div>
          </div>
          <div class="banner-item" style="border-left:1px solid #cbd5e1;border-right:1px solid #cbd5e1;padding:0 12px;">
            <div class="b-lbl">Total Paid Amount</div>
            <div class="b-val" style="color:#059669;">₹${totalPaid.toLocaleString('en-IN')}</div>
          </div>
          <div class="banner-item">
            <div class="b-lbl">Total Outstanding Amount</div>
            <div class="b-val" style="color:${totalOutstanding > 0 ? '#d97706' : '#059669'};">₹${totalOutstanding.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <table class="report-table">
          <thead>
            <tr>
              <th style="width:22px;text-align:center;">S.No.</th>
              <th style="width:65px;">Payment / Ref ID</th>
              <th>Event Name</th>
              <th style="width:45px;">Payable</th>
              <th style="width:45px;">Paid</th>
              <th style="width:45px;">Remaining</th>
              <th style="width:50px;">Status</th>
              <th style="width:60px;">Date</th>
              <th style="width:70px;">Method</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${paymentRowsHtml}
          </tbody>
        </table>

        <!-- Section 7: Recruiter & Event Details -->
        <div class="sec-heading">
          <span>Section 7: Recruiter & Event Details</span>
          <span class="badge-count">${eventList.length} Associated Events</span>
        </div>
        <table class="report-table">
          <thead>
            <tr>
              <th style="width:22px;text-align:center;">S.No.</th>
              <th>Recruiter / Company</th>
              <th style="width:105px;">Recruiter Contact</th>
              <th>Event & Address</th>
              <th style="width:70px;">Date & Time</th>
              <th style="width:55px;">Role</th>
              <th style="width:60px;">Attendance</th>
              <th style="width:60px;">Lifecycle</th>
            </tr>
          </thead>
          <tbody>
            ${recruiterRowsHtml}
          </tbody>
        </table>

        <!-- Section 8: Account & Record Information -->
        <div class="sec-heading">
          <span>Section 8: Account & Record Information</span>
          <span class="badge-count">Audit & Governance</span>
        </div>

        <div class="audit-box">
          <table class="kv-table">
            <tbody>
              <tr>
                <td class="lbl">Account Current Status:</td>
                <td class="val">${renderBadge(accountStatus)}</td>
                <td class="lbl">Account Registration Timestamp:</td>
                <td class="val">${formatDateTime(worker.createdAt)}</td>
              </tr>
              <tr>
                <td class="lbl">Soft-Delete / Trash State:</td>
                <td class="val">${worker.isDeleted ? 'Deleted (In Trash)' : 'Active / Operational'}</td>
                <td class="lbl">Last Updated Timestamp:</td>
                <td class="val">${formatDateTime(worker.updatedAt)}</td>
              </tr>
              <tr>
                <td class="lbl">Assigned Role & Scope:</td>
                <td class="val"><strong style="color:#0f172a;">WORKER</strong> (Registered Event Staff)</td>
                <td class="lbl">Report Generated Date/Time:</td>
                <td class="val">${genDate}</td>
              </tr>
              <tr>
                <td class="lbl">Security & Privacy Governance:</td>
                <td class="val" colspan="3" style="color:#64748b;font-size:6.5px;line-height:1.15;">
                  Official Administrative Record generated from JobbyHop platform database. All sensitive credentials, passwords, authentication tokens, OTPs, and private financial records of other workers or recruiters are strictly excluded from this report.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="page-footer-bar">
          <span>JobbyHop Administrative Platform • Strictly Confidential Record</span>
          <span>Worker: ${esc(fullName)} (${esc(workerId)})</span>
          <span>Page 2 of 2</span>
        </div>
      </div>
    `;
  }).join('');

  const bodyHtml = `
    <div class="report-page-container">
      ${fullReportsHtml}
    </div>
  `;

  const safeTitle = filename || `JobbyHop_Worker_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  const html = _buildHtmlDoc({
    title: 'Worker Official Dossier',
    subtitle: '2-Page Administrative Report',
    bodyHtml,
    genDate,
    recordCount: workers.length,
    landscape: false,
    extraCss: WORKER_REPORT_CSS,
    filename: safeTitle,
  });

  win.document.open();
  win.document.write(html);
  win.document.close();
}

// Backward-compatible and semantic aliases
export const exportWorkerReportPdf = exportWorker2PageReportPdf;
export const exportWorker3PageReportPdf = exportWorker2PageReportPdf;



