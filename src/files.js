import DOMPurify from 'dompurify';
import { newFile, uid, validateFile } from './model';
import { colName, parseCSV, calculate, coords } from './formula';
import { buildPrintable } from './print';
import { importPresentation, readOfficeArchive } from './presentationIO';
export const cleanHTML = html => DOMPurify.sanitize(html, { ADD_ATTR: ['style'], FORBID_TAGS: ['iframe', 'script', 'style', 'form', 'input'], FORBID_ATTR: ['srcset'], ALLOWED_URI_REGEXP: /^(?:data:image\/(?:png|jpeg|gif|webp);base64,|blob:|$)/i });
const textDecoder = new TextDecoder();
export async function importFile(source) {
  const ext = source.name.split('.').pop().toLowerCase();
  const bytes = new Uint8Array(source.bytes);
  if (['docx', 'xlsx'].includes(ext)) await readOfficeArchive(bytes);
  let file;
  if (ext === 'tom') { file = validateFile(JSON.parse(textDecoder.decode(bytes))); file.id = uid(); }
  else if (ext === 'docx') {
    const mammoth = await import('mammoth/mammoth.browser');
    const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer });
    file = newFile('doc'); file.html = cleanHTML(result.value);
  } else if (ext === 'txt') {
    file = newFile('doc'); const div = document.createElement('div');
    div.textContent = textDecoder.decode(bytes); file.html = div.innerHTML.split(/\r?\n/).map(s => `<p>${s || '<br>'}</p>`).join('');
  } else if (ext === 'csv') {
    file = newFile('sheet');
    parseCSV(textDecoder.decode(bytes).replace(/^\uFEFF/, '')).forEach((row, r) => row.forEach((v, c) => { if (r < 1000 && c < 100) file.sheets[0].cells[`${colName(c)}${r + 1}`] = { value: v }; }));
  } else if (ext === 'xlsx') {
    const { default: ExcelJS } = await import('exceljs');
    const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes.buffer);
    file = newFile('sheet'); file.sheets = [];
    book.eachSheet(sheet => {
      const cells = {};
      sheet.eachRow((row, r) => { if (r > 1000) return; row.eachCell((cell, c) => {
        if (c > 100) return;
        const v = cell.value;
        cells[`${colName(c - 1)}${r}`] = { value: cell.formula ? '=' + cell.formula : v?.richText ? v.richText.map(t => t.text).join('') : v instanceof Date ? v.toISOString().slice(0, 10) : String(v?.text ?? v ?? ''), bold: !!cell.font?.bold, color: cell.font?.color?.argb ? '#' + cell.font.color.argb.slice(-6) : undefined, background: cell.fill?.fgColor?.argb ? '#' + cell.fill.fgColor.argb.slice(-6) : undefined, align: cell.alignment?.horizontal, italic: !!cell.font?.italic, size: cell.font?.size || 11, wrap: !!cell.alignment?.wrapText, format: cell.numFmt?.includes('%') ? 'percent' : /[¥￥$]/.test(cell.numFmt || '') ? 'currency' : 'general' };
      }); });
      file.sheets.push({ id: uid(), name: sheet.name, cells, widths: Object.fromEntries((sheet.columns || []).slice(0, 100).map((col, i) => [i, Math.max(60, Math.min(400, (col.width || 16) * 7))])), frozen: sheet.views?.some(v => v.state === 'frozen' && v.ySplit) || false });
    });
    if (!file.sheets.length) file.sheets = [{ id: uid(), name: 'Sheet1', cells: {} }];
  } else if (ext === 'pptx') {
    file = newFile('slides'); file.slides = await importPresentation(bytes);
  } else throw new Error('暂不支持这个文件格式，请打开 .tom、.docx、.xlsx、.pptx、.txt 或 .csv');
  file.name = source.name.replace(/\.[^.]+$/, ''); file.path = source.path; file.format = ext; file.dirty = false; file.modified = Date.now();
  if (file.type === 'doc') file.html = cleanHTML(file.html);
  return file;
}
function docRuns(node, docx, inherited = {}, images = new Map()) {
  if (node.nodeType === Node.TEXT_NODE) return [new docx.TextRun({ text: node.textContent, ...inherited })];
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  if (node.tagName === 'IMG') return images.has(node) ? [images.get(node)] : [];
  if (['UL', 'OL'].includes(node.tagName)) return [];
  const s = node.style;
  const options = { ...inherited };
  if (s.fontFamily || node.getAttribute('face')) options.font = (s.fontFamily || node.getAttribute('face')).replace(/["']/g, '');
  if (node.tagName === 'FONT' && node.getAttribute('size')) options.size = [0, 16, 20, 24, 28, 36, 48, 72][Number(node.getAttribute('size'))] || 24;
  if (['B', 'STRONG'].includes(node.tagName) || s.fontWeight === 'bold') options.bold = true;
  if (['I', 'EM'].includes(node.tagName) || s.fontStyle === 'italic') options.italics = true;
  if (node.tagName === 'U' || s.textDecoration?.includes('underline')) options.underline = {};
  if (node.tagName === 'S' || node.tagName === 'STRIKE') options.strike = true;
  if (s.fontSize) options.size = Math.round(parseFloat(s.fontSize) * (s.fontSize.includes('pt') ? 2 : 1.5));
  const color = s.color || node.getAttribute('color');
  if (color) {
    const rgb = color.match(/\d+/g);
    options.color = color.startsWith('#') ? color.slice(1) : rgb ? rgb.slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('') : undefined;
  }
  if (node.tagName === 'BR') return [new docx.TextRun({ break: 1 })];
  return Array.from(node.childNodes).flatMap(child => docRuns(child, docx, options, images));
}
export async function exportBytes(file, format) {
  if (format === 'pdf') {
    if (!window.desktop) throw new Error('PDF 导出请在 Tom Office 桌面版中使用');
    return new Uint8Array(await window.desktop.pdf(buildPrintable(file)));
  }
  if (format === 'txt') { const div = document.createElement('div'); div.innerHTML = cleanHTML(file.html); document.body.appendChild(div); const text = div.innerText; div.remove(); return new TextEncoder().encode(text); }
  if (format === 'csv') {
    const sheet = file.sheets[0];
    const [rMax, cMax] = Object.keys(sheet.cells).reduce(([r, c], key) => { const [rr, cc] = coords(key); return [Math.max(r, rr), Math.max(c, cc)]; }, [0, 0]);
    const rows = Array.from({ length: rMax + 1 }, (_, r) => Array.from({ length: cMax + 1 }, (_, c) => '"' + String(calculate(sheet.cells, `${colName(c)}${r + 1}`, new Set(), { sheets: file.sheets, currentSheet: sheet.name })).replace(/"/g, '""') + '"').join(','));
    return new TextEncoder().encode('\uFEFF' + rows.join('\r\n'));
  }
  if (format === 'tom') return new TextEncoder().encode(JSON.stringify({ ...file, path: undefined, dirty: false, format: undefined }, null, 2));
  if (format === 'docx') {
    const docx = await import('docx');
    const root = document.createElement('div'); root.innerHTML = cleanHTML(file.html);
    const images = new Map();
    await Promise.all([...root.querySelectorAll('img')].map(async node => {
      const image = new Image(); image.src = node.src; await image.decode();
      const width = Math.min(600, Number(node.getAttribute('width')) || parseFloat(node.style.width) || image.naturalWidth), height = width / image.naturalWidth * image.naturalHeight;
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; canvas.getContext('2d').drawImage(image, 0, 0);
      const bytes = Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]), c => c.charCodeAt(0));
      images.set(node, new docx.ImageRun({ type: 'png', data: bytes, transformation: { width, height } }));
    }));
    const paragraphs = [];
    const runs = node => docRuns(node, docx, {}, images);
    function convert(node, list) {
      if (node.nodeType === Node.TEXT_NODE) { if (node.textContent.trim()) paragraphs.push(new docx.Paragraph({ children: runs(node) })); return; }
      if (node.style?.breakAfter === 'page') { paragraphs.push(new docx.Paragraph({ children: [new docx.PageBreak()] })); return; }
      if (node.tagName === 'TABLE') {
        const rows = Array.from(node.rows).map(row => new docx.TableRow({ children: Array.from(row.cells).map(cell => new docx.TableCell({ children: [new docx.Paragraph({ children: runs(cell) })] })) }));
        if (rows.length) paragraphs.push(new docx.Table({ rows, width: { size: 100, type: docx.WidthType.PERCENTAGE } }));
      } else if (['UL', 'OL'].includes(node.tagName)) [...node.children].forEach(child => convert(child, { type: node.tagName, level: Math.min(8, list ? list.level + 1 : 0) }));
      else if (node.tagName === 'DIV' && [...node.children].some(n => /^(P|H[1-6]|DIV|UL|OL|TABLE)$/.test(n.tagName))) [...node.childNodes].forEach(child => convert(child, list));
      else {
        const heading = /^H[1-6]$/.test(node.tagName) ? docx.HeadingLevel['HEADING_' + node.tagName[1]] : undefined;
        paragraphs.push(new docx.Paragraph({ heading, alignment: node.style?.textAlign === 'justify' ? 'both' : node.style?.textAlign || undefined, bullet: node.tagName === 'LI' && list?.type !== 'OL' ? { level: list?.level || 0 } : undefined, numbering: node.tagName === 'LI' && list?.type === 'OL' ? { reference: 'tom-numbered', level: list.level } : undefined, children: runs(node) }));
        if (node.tagName === 'LI') [...node.children].filter(n => ['UL', 'OL'].includes(n.tagName)).forEach(child => convert(child, list));
      }
    }
    Array.from(root.childNodes).forEach(node => convert(node));
    const blob = await docx.Packer.toBlob(new docx.Document({ numbering: { config: [{ reference: 'tom-numbered', levels: Array.from({ length: 9 }, (_, i) => ({ level: i, format: docx.LevelFormat.DECIMAL, text: `%${i + 1}.`, alignment: 'left', style: { paragraph: { indent: { left: 720 * (i + 1), hanging: 260 } } } })) }] }, sections: [{ properties: { page: { size: { orientation: file.page?.orientation === 'landscape' ? 'landscape' : 'portrait' }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children: paragraphs.length ? paragraphs : [new docx.Paragraph('')] }] }));
    return new Uint8Array(await blob.arrayBuffer());
  }
  if (format === 'xlsx') {
    const { default: ExcelJS } = await import('exceljs');
    const book = new ExcelJS.Workbook(); book.creator = 'Tom Office'; book.calcProperties.fullCalcOnLoad = true;
    for (const sheet of file.sheets) {
      const ws = book.addWorksheet(sheet.name);
      Object.entries(sheet.cells).forEach(([ref, cell]) => {
        const target = ws.getCell(ref); const v = cell.value ?? '';
        target.value = typeof v === 'string' && v.startsWith('=') ? { formula: v.slice(1), result: calculate(sheet.cells, ref, new Set(), { sheets: file.sheets, currentSheet: sheet.name }) } : v !== '' && Number.isFinite(Number(v)) ? Number(v) : v;
        target.font = { name: '等线', bold: cell.bold, italic: cell.italic, size: cell.size || 11, color: cell.color ? { argb: 'FF' + cell.color.slice(1) } : undefined };
        target.alignment = { horizontal: cell.align || 'left', wrapText: cell.wrap };
        if (cell.background) target.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + cell.background.slice(1) } };
        if (cell.format === 'currency') target.numFmt = '¥#,##0.00';
        if (cell.format === 'percent') target.numFmt = '0.00%';
      });
      for (let c = 1; c <= 100; c++) ws.getColumn(c).width = (sheet.widths?.[c - 1] || 112) / 7;
      if (sheet.frozen) ws.views = [{ state: 'frozen', ySplit: 1 }];
    }
    return new Uint8Array(await book.xlsx.writeBuffer());
  }
  if (format === 'pptx') {
    const { default: PptxGenJS } = await import('pptxgenjs'); const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE'; pptx.author = 'Tom Office'; pptx.title = file.name;
    for (const data of file.slides) {
      const slide = pptx.addSlide(); slide.background = { color: data.bg.slice(1) };
      for (const element of data.elements) {
        const options = { x: element.x / 100 * 13.333, y: element.y / 100 * 7.5, w: element.w / 100 * 13.333, h: element.h / 100 * 7.5, rotate: element.rotate || 0 };
        if (element.kind === 'image') slide.addImage({ ...options, data: element.src });
        else if (element.kind === 'shape') slide.addShape(element.shape === 'ellipse' ? pptx.ShapeType.ellipse : pptx.ShapeType.rect, { ...options, fill: { color: element.color.slice(1) }, line: { color: element.color.slice(1) }, radius: 0.1 });
        else slide.addText(element.text, { ...options, fontSize: element.size, fontFace: element.font || 'Microsoft YaHei', color: element.color.slice(1), bold: element.bold, italic: element.italic, align: element.align || 'left', margin: 0, breakLine: false, valign: 'top' });
      }
      if (data.notes) slide.addNotes(data.notes);
    }
    return new Uint8Array(await pptx.write({ outputType: 'arraybuffer' }));
  }
  throw new Error('不支持的导出格式');
}
export async function saveFile(file, format, saveAs = false) {
  const bytes = await exportBytes(file, format);
  if (window.desktop) return window.desktop.save({ bytes, name: file.name, extension: format, existingPath: !saveAs && file.format === format ? file.path : undefined });
  const url = URL.createObjectURL(new Blob([bytes])); const a = document.createElement('a'); a.href = url; a.download = `${file.name}.${format}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return a.download;
}
