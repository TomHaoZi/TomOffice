import { colName, coords } from './formula.js';
// Match strings separately so references inside quoted text are never rewritten.
const references = /"(?:[^"]|"")*"|((?:'(?:[^']|'')+'|[\p{L}_][\p{L}\p{N}_.]*)!)?(\$?[A-Za-z]+\$?[1-9]\d*)(?::(\$?[A-Za-z]+\$?[1-9]\d*))?/gu;
const sheetName = value => value ? value.slice(0, -1).replace(/^'|'$/g, '').replace(/''/g, "'") : null;
const unpack = ref => { const m = /^(\$?)([A-Za-z]+)(\$?)([1-9]\d*)$/.exec(ref); const [r, c] = coords(m[2] + m[4]); return { r, c, ac: m[1], ar: m[3] }; };
const pack = item => `${item.ac}${colName(item.c)}${item.ar}${item.r + 1}`;
export function shiftFormula(formula, dr, dc) {
  if (typeof formula !== 'string' || !formula.startsWith('=')) return formula;
  return formula.replace(references, (all, prefix, a, b) => {
    if (all.startsWith('"')) return all;
    const move = ref => { const v = unpack(ref); if (!v.ar) v.r += dr; if (!v.ac) v.c += dc; return v.r < 0 || v.c < 0 ? '#REF!' : pack(v); };
    return (prefix || '') + move(a) + (b ? ':' + move(b) : '');
  });
}
export function adjustFormula(formula, currentSheet, targetSheet, axis, index, delta) {
  if (typeof formula !== 'string' || !formula.startsWith('=')) return formula;
  const key = axis === 'row' ? 'r' : 'c';
  return formula.replace(references, (all, prefix, a, b) => {
    if (all.startsWith('"') || (sheetName(prefix) || currentSheet).toLowerCase() !== targetSheet.toLowerCase()) return all;
    const first = unpack(a), last = b ? unpack(b) : null;
    if (delta < 0 && last) {
      const low = Math.min(first[key], last[key]), high = Math.max(first[key], last[key]);
      if (low === high && low === index) return '#REF!';
      const transform = v => v > index ? v - 1 : v === index && low < index ? v - 1 : v;
      first[key] = transform(first[key]); last[key] = transform(last[key]);
    } else {
      for (const v of [first, last].filter(Boolean)) {
        if (delta < 0 && v[key] === index) return '#REF!';
        if (v[key] >= index) v[key] += delta;
      }
    }
    return (prefix || '') + pack(first) + (last ? ':' + pack(last) : '');
  });
}
export function editStructure(sheets, targetId, axis, index, delta) {
  const target = sheets.find(s => s.id === targetId); if (!target) return sheets;
  return sheets.map(sheet => {
    const cells = {};
    for (const [ref, cell] of Object.entries(sheet.cells)) {
      let [r, c] = coords(ref);
      if (sheet.id === targetId) {
        const v = axis === 'row' ? r : c;
        if (delta < 0 && v === index) continue;
        if (v >= index) { if (axis === 'row') r += delta; else c += delta; }
        if (r >= 1000 || c >= 100) throw new Error('操作将使已有内容超出 1,000 行 × 100 列，请先清理末尾数据。');
      }
      cells[`${colName(c)}${r + 1}`] = { ...cell, value: adjustFormula(cell.value, sheet.name, target.name, axis, index, delta) };
    }
    let widths = sheet.widths;
    if (sheet.id === targetId && axis === 'column' && widths) widths = Object.fromEntries(Object.entries(widths).filter(([key]) => !(delta < 0 && Number(key) === index)).map(([key, value]) => [Number(key) >= index ? Number(key) + delta : Number(key), value]));
    return { ...sheet, cells, widths };
  });
}
export function removeSheet(sheets, id) {
  const target = sheets.find(s => s.id === id); if (!target || sheets.length === 1) return sheets;
  return sheets.filter(s => s.id !== id).map(s => ({ ...s, cells: Object.fromEntries(Object.entries(s.cells).map(([ref, cell]) => [ref, { ...cell, value: typeof cell.value === 'string' && cell.value.startsWith('=') ? cell.value.replace(references, (all, prefix) => prefix && sheetName(prefix).toLowerCase() === target.name.toLowerCase() ? '#REF!' : all) : cell.value }])) }));
}
export function nextSheetName(sheets, base = 'Sheet') {
  let n = 1; while (sheets.some(s => s.name.toLowerCase() === `${base}${n}`.toLowerCase())) n++;
  return `${base}${n}`;
}
export function renameSheet(sheets, id, name) {
  const target = sheets.find(s => s.id === id);
  return sheets.map(s => ({ ...s, name: s.id === id ? name : s.name, cells: Object.fromEntries(Object.entries(s.cells).map(([ref, cell]) => [ref, { ...cell, value: typeof cell.value === 'string' && cell.value.startsWith('=') ? cell.value.replace(references, (all, prefix, a, b) => prefix && sheetName(prefix).toLowerCase() === target.name.toLowerCase() ? `'${name.replace(/'/g, "''")}'!${a}${b ? ':' + b : ''}` : all) : cell.value }])) }));
}
