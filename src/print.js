import { cleanHTML } from './files';
import { calculate, colName, coords } from './formula';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const color = (value, fallback = '#243348') => /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
export function buildPrintable(file) {
  let body = '', page;
  if (file.type === 'doc') {
    page = { pageSize: 'A4', landscape: file.page?.orientation === 'landscape', margins: { top: 20, bottom: 20, left: 20, right: 20 } };
    body = `<article class="document">${cleanHTML(file.html)}</article>`;
  } else if (file.type === 'sheet') {
    page = { pageSize: 'A4', landscape: true, margins: { top: 12, bottom: 12, left: 12, right: 12 } };
    body = file.sheets.map(sheet => {
      const used = Object.entries(sheet.cells).filter(([, cell]) => cell.value !== '' && cell.value !== undefined);
      const [lastRow, lastCol] = used.reduce(([r, c], [ref]) => { const [rr, cc] = coords(ref); return [Math.max(r, rr), Math.max(c, cc)]; }, [0, 0]);
      const cache = new Map();
      const rows = Array.from({ length: Math.min(1000, lastRow + 1) }, (_, r) => `<tr>${Array.from({ length: Math.min(100, lastCol + 1) }, (_, c) => {
        const ref = `${colName(c)}${r + 1}`, cell = sheet.cells[ref] || {};
        let value = calculate(sheet.cells, ref, new Set(), { sheets: file.sheets, currentSheet: sheet.name, cache });
        if (value !== '' && Number.isFinite(Number(value))) {
          if (cell.format === 'currency') value = Number(value).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' });
          if (cell.format === 'percent') value = (Number(value) * 100).toFixed(2) + '%';
        }
        return `<td style="color:${color(cell.color)};background:${color(cell.background, '#ffffff')};text-align:${['left', 'center', 'right'].includes(cell.align) ? cell.align : 'left'};font-weight:${cell.bold ? '700' : '400'};font-style:${cell.italic ? 'italic' : 'normal'}">${escape(value)}</td>`;
      }).join('')}</tr>`).join('');
      return `<section class="sheet-print"><h2>${escape(file.name)} <small>${escape(sheet.name)}</small></h2><table>${rows}</table></section>`;
    }).join('');
  } else {
    page = { pageSize: { width: 254, height: 142.875 }, landscape: false, margins: { top: 0, bottom: 0, left: 0, right: 0 } };
    body = file.slides.map(slide => `<section class="slide-print" style="background:${color(slide.bg, '#ffffff')}">${slide.elements.map(el => {
      const style = `position:absolute;left:${num(el.x)}%;top:${num(el.y)}%;width:${num(el.w)}%;height:${num(el.h)}%;transform:rotate(${num(el.rotate)}deg);`;
      if (el.kind === 'image' && /^data:image\/(png|jpeg|gif|webp);base64,/i.test(el.src)) return `<img style="${style}object-fit:contain" src="${escape(el.src)}"/>`;
      if (el.kind === 'shape') return `<div style="${style}background:${color(el.color)};border-radius:${el.shape === 'ellipse' ? '50%' : '0'}"></div>`;
      return `<div style="${style}font-size:${num(el.size)}px;color:${color(el.color)};font-weight:${el.bold ? 700 : 400};font-style:${el.italic ? 'italic' : 'normal'};text-align:${['center', 'right', 'justify'].includes(el.align) ? el.align : 'left'};white-space:pre-wrap;line-height:1.4">${escape(el.text)}</div>`;
    }).join('')}</section>`).join('');
  }
  return { name: file.name, ...page, html: `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${escape(file.name)}</title><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; object-src 'none'; base-uri 'none'"><style>*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:'Microsoft YaHei','Segoe UI',sans-serif;color:#243348;-webkit-print-color-adjust:exact;print-color-adjust:exact}.document{font-size:16px;line-height:1.85;overflow-wrap:break-word}.document p{margin:.6em 0;min-height:1em}.document h1{font-size:30px;line-height:1.45;margin:.8em 0;font-weight:650}.document h2{font-size:22px;line-height:1.5;font-weight:600;margin:1em 0 .5em}.document h3{font-size:19px}.document h1,.document h2,.document h3{break-after:avoid}.document img{max-width:100%;height:auto;break-inside:avoid}.document table{border-collapse:collapse;max-width:100%}.document td,.document th{border:1px solid #bdc7d2;padding:8px}.sheet-print{break-after:page}.sheet-print:last-child{break-after:auto}.sheet-print h2{font-size:17px;margin:0 0 15px}.sheet-print small{font-size:11px;color:#7d899a;margin-left:12px}.sheet-print table{border-collapse:collapse;width:100%;font-size:10px}.sheet-print td{border:1px solid #d7dfe7;padding:6px;white-space:pre-wrap;overflow-wrap:anywhere}.sheet-print tr{break-inside:avoid}.slide-print{position:relative;overflow:hidden;width:960px;height:540px;break-after:page}.slide-print:last-child{break-after:auto}</style></head><body>${body}</body></html>` };
}
