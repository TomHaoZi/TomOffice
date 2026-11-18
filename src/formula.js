export function colName(n) {
  let s = ''; for (n++; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s;
  return s;
}
export function coords(ref) {
  const m = /^([A-Z]+)([1-9]\d*)$/.exec(ref.replace(/\$/g, '').toUpperCase());
  if (!m) throw new Error('#REF!');
  let c = 0; for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64;
  return [Number(m[2]) - 1, c - 1];
}
export function rangeRefs(a, b, maxCells = 10000) {
  const [r1, c1] = coords(a), [r2, c2] = coords(b), result = [];
  if ((Math.abs(r2 - r1) + 1) * (Math.abs(c2 - c1) + 1) > maxCells) throw new Error('#RANGE!');
  for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) result.push(`${colName(c)}${r + 1}`);
  return result;
}
const tokenPattern = /\s*("(?:[^"]|"")*"|(?:'(?:[^']|'')+'|[\p{L}_][\p{L}\p{N}_.]*)!\$?[A-Za-z]+\$?[1-9]\d*|\$?[A-Za-z]+\$?[1-9]\d*|\d*\.?\d+(?:[eE][+-]?\d+)?|[A-Za-z_][A-Za-z_0-9.]*|#REF!|<>|<=|>=|[+\-*/^&=<>():,;%])\s*/uy;
const cellPattern = /^(?:(.+)!)?(\$?[A-Za-z]+\$?[1-9]\d*)$/;
const fail = code => { throw new Error(code); };
const numeric = value => { if (typeof value === 'string' && value.startsWith('#')) fail(value); const n = value === '' ? 0 : Number(value); if (!Number.isFinite(n)) fail('#VALUE!'); return n; };
const isNumber = value => value !== '' && typeof value !== 'boolean' && Number.isFinite(Number(value));
const flat = args => args.flatMap(a => a?.values || [a]);
const truthy = value => typeof value === 'string' ? value.toUpperCase() === 'TRUE' || (isNumber(value) && Number(value) !== 0) : !!value;
function parse(source) {
  const tokens = []; let pos = 0;
  while (pos < source.length) { tokenPattern.lastIndex = pos; const match = tokenPattern.exec(source); if (!match) fail('#ERROR!'); tokens.push(match[1]); pos = tokenPattern.lastIndex; if (tokens.length > 4000) fail('#RANGE!'); }
  let i = 0, depth = 0;
  const peek = () => tokens[i];
  const eat = token => { if (tokens[i++] !== token) fail('#ERROR!'); };
  function primary() {
    if (++depth > 100) fail('#RANGE!');
    const t = tokens[i++]; let node;
    if (t === '(') { node = comparison(); eat(')'); }
    else if (t?.startsWith('"')) node = { kind: 'literal', value: t.slice(1, -1).replace(/""/g, '"') };
    else if (/^\d*\.?\d+(?:e[+-]?\d+)?$/i.test(t || '')) node = { kind: 'literal', value: Number(t) };
    else if (t === '#REF!') node = { kind: 'error', value: t };
    else if (/^(TRUE|FALSE)$/i.test(t || '') && peek() !== '(') node = { kind: 'literal', value: t.toUpperCase() === 'TRUE' };
    else if (cellPattern.test(t || '')) {
      const match = cellPattern.exec(t); const sheet = match[1]?.replace(/^'|'$/g, '').replace(/''/g, "'");
      node = { kind: 'ref', sheet, ref: match[2].replace(/\$/g, '').toUpperCase() };
      if (peek() === ':') { i++; const end = cellPattern.exec(tokens[i++] || ''); if (!end || end[1]) fail('#REF!'); node = { kind: 'range', sheet, start: node.ref, end: end[2].replace(/\$/g, '').toUpperCase() }; }
    } else if (/^[A-Z_][A-Z_0-9.]*$/i.test(t || '') && peek() === '(') {
      i++; const args = [];
      if (peek() !== ')') do { args.push(comparison()); if (![',', ';'].includes(peek())) break; i++; } while (true);
      eat(')'); node = { kind: 'call', name: t.toUpperCase(), args };
    } else fail('#ERROR!');
    depth--; while (peek() === '%') { i++; node = { kind: 'binary', op: '/', left: node, right: { kind: 'literal', value: 100 } }; }
    return node;
  }
  function power() { let node = primary(); if (peek() === '^') { i++; node = { kind: 'binary', op: '^', left: node, right: unary() }; } return node; }
  function unary() { if (['+', '-'].includes(peek())) { const op = tokens[i++]; return { kind: 'binary', op, left: { kind: 'literal', value: 0 }, right: unary() }; } return power(); }
  function level(next, operators) { let left = next(); while (operators.includes(peek())) { const op = tokens[i++]; left = { kind: 'binary', op, left, right: next() }; } return left; }
  function product() { return level(unary, ['*', '/']); }
  function addition() { return level(product, ['+', '-']); }
  function concat() { return level(addition, ['&']); }
  function comparison() { return level(concat, ['=', '<>', '>', '<', '>=', '<=']); }
  const ast = comparison(); if (i !== tokens.length) fail('#ERROR!'); return ast;
}
function compare(a, b, op) {
  if (isNumber(a) && isNumber(b)) { a = Number(a); b = Number(b); }
  else { a = String(a).toLocaleLowerCase(); b = String(b).toLocaleLowerCase(); }
  return op === '=' ? a === b : op === '<>' ? a !== b : op === '>' ? a > b : op === '<' ? a < b : op === '>=' ? a >= b : a <= b;
}
function criteria(value, criterion) {
  if (typeof criterion !== 'string') return compare(value, criterion, '=');
  const match = /^(<=|>=|<>|=|<|>)(.*)$/.exec(criterion);
  if (match) {
    if (isNumber(match[2])) {
      if (value !== '' && !isNumber(value)) return match[1] === '<>';
      return compare(value === '' ? 0 : Number(value), Number(match[2]), match[1]);
    }
    return compare(value, match[2], match[1]);
  }
  if (/[?*]/.test(criterion)) { const pattern = criterion.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.'); return new RegExp('^' + pattern + '$', 'i').test(String(value)); }
  return compare(value, criterion, '=');
}
// Parse to an AST and interpret known operators/functions only; no eval or dynamic JS.
export function calculate(cells, ref, visiting = new Set(), context = {}) {
  const raw = cells[ref]?.value ?? '';
  if (typeof raw !== 'string' || !raw.startsWith('=')) return raw;
  const key = `${context.currentSheet || ''}!${ref}`;
  if (visiting.has(key)) return '#CYCLE!';
  if (visiting.size > 256) return '#RANGE!';
  if (context.cache?.has(key)) return context.cache.get(key);
  const stack = new Set(visiting); stack.add(key);
  const get = (sheetName, cellRef) => {
    const sheet = sheetName ? context.sheets?.find(s => s.name.toLowerCase() === sheetName.toLowerCase()) : null;
    if (sheetName && !sheet) fail('#REF!');
    const value = calculate(sheet ? sheet.cells : cells, cellRef, stack, { ...context, currentSheet: sheet?.name || context.currentSheet });
    if (typeof value === 'string' && value.startsWith('#')) fail(value);
    return isNumber(value) ? Number(value) : value;
  };
  function evaluate(node) {
    if (node.kind === 'literal') return node.value;
    if (node.kind === 'error') fail(node.value);
    if (node.kind === 'ref') return get(node.sheet, node.ref);
    if (node.kind === 'range') { const [r1, c1] = coords(node.start), [r2, c2] = coords(node.end); return { values: rangeRefs(node.start, node.end).map(r => get(node.sheet, r)), rows: Math.abs(r2 - r1) + 1, cols: Math.abs(c2 - c1) + 1 }; }
    if (node.kind === 'binary') {
      const a = evaluate(node.left), b = evaluate(node.right);
      if (['=', '<>', '>', '<', '>=', '<='].includes(node.op)) return compare(a, b, node.op);
      if (node.op === '&') return String(a) + String(b);
      const x = numeric(a), y = numeric(b);
      if (node.op === '/' && y === 0) fail('#DIV/0!');
      return node.op === '+' ? x + y : node.op === '-' ? x - y : node.op === '*' ? x * y : node.op === '/' ? x / y : x ** y;
    }
    const { name, args: nodes } = node;
    // Lazy branches preserve IF/IFERROR semantics (unused branches do not throw).
    if (name === 'IF') { if (nodes.length < 2) fail('#VALUE!'); return truthy(evaluate(nodes[0])) ? evaluate(nodes[1]) : nodes[2] ? evaluate(nodes[2]) : false; }
    if (name === 'IFERROR') { try { return evaluate(nodes[0]); } catch { return nodes[1] ? evaluate(nodes[1]) : ''; } }
    const args = nodes.map(evaluate), all = flat(args), numbers = all.filter(isNumber).map(Number);
    const first = () => numeric(args[0]), digits = () => numeric(args[1] ?? 0);
    switch (name) {
      case 'SUM': return numbers.reduce((a, b) => a + b, 0);
      case 'AVERAGE': if (!numbers.length) fail('#DIV/0!'); return numbers.reduce((a, b) => a + b, 0) / numbers.length;
      case 'MIN': return numbers.length ? Math.min(...numbers) : 0;
      case 'MAX': return numbers.length ? Math.max(...numbers) : 0;
      case 'COUNT': return numbers.length;
      case 'COUNTA': return all.filter(a => a !== '').length;
      case 'COUNTBLANK': return all.filter(a => a === '').length;
      case 'PRODUCT': return numbers.length ? numbers.reduce((a, b) => a * b, 1) : 0;
      case 'ABS': return Math.abs(first());
      case 'ROUND': return Math.sign(first()) * Math.round(Math.abs(first()) * 10 ** digits() + 1e-9) / 10 ** digits();
      case 'ROUNDUP': return Math.sign(first()) * Math.ceil(Math.abs(first()) * 10 ** digits()) / 10 ** digits();
      case 'ROUNDDOWN': return Math.sign(first()) * Math.floor(Math.abs(first()) * 10 ** digits()) / 10 ** digits();
      case 'INT': return Math.floor(first());
      case 'MOD': { const divisor = numeric(args[1]); if (!divisor) fail('#DIV/0!'); return first() - divisor * Math.floor(first() / divisor); }
      case 'SQRT': if (first() < 0) fail('#NUM!'); return Math.sqrt(first());
      case 'POWER': return first() ** numeric(args[1]);
      case 'AND': return all.every(truthy);
      case 'OR': return all.some(truthy);
      case 'NOT': return !truthy(args[0]);
      case 'LEN': return String(args[0] ?? '').length;
      case 'TRIM': return String(args[0] ?? '').trim().replace(/ +/g, ' ');
      case 'UPPER': return String(args[0] ?? '').toUpperCase();
      case 'LOWER': return String(args[0] ?? '').toLowerCase();
      case 'LEFT': return String(args[0] ?? '').slice(0, Math.max(0, numeric(args[1] ?? 1)));
      case 'RIGHT': { const n = Math.max(0, numeric(args[1] ?? 1)); return n ? String(args[0] ?? '').slice(-n) : ''; }
      case 'MID': return String(args[0] ?? '').substr(Math.max(0, numeric(args[1]) - 1), Math.max(0, numeric(args[2])));
      case 'CONCAT': case 'CONCATENATE': return all.join('');
      case 'COUNTIF': return flat([args[0]]).filter(v => criteria(v, args[1])).length;
      case 'SUMIF': { const range = flat([args[0]]), sums = flat([args[2] ?? args[0]]); return range.reduce((sum, value, i) => sum + (criteria(value, args[1]) && isNumber(sums[i]) ? Number(sums[i]) : 0), 0); }
      case 'VLOOKUP': { const table = args[1], col = numeric(args[2]) - 1; if (!table?.values || col < 0 || col >= table.cols) fail('#REF!'); let result; for (let row = 0; row < table.rows; row++) { const value = table.values[row * table.cols]; if (compare(value, args[0], '=')) return table.values[row * table.cols + col]; if ((args[3] === undefined || truthy(args[3])) && compare(value, args[0], '<=')) result = table.values[row * table.cols + col]; } if (result === undefined) fail('#N/A'); return result; }
      case 'TODAY': return Math.floor(Date.now() / 86400000) + 25569;
      case 'DATE': return Date.UTC(numeric(args[0]) < 1900 ? numeric(args[0]) + 1900 : numeric(args[0]), numeric(args[1]) - 1, numeric(args[2])) / 86400000 + 25569;
      default: fail('#NAME?');
    }
  }
  let result;
  try { result = evaluate(parse(raw.slice(1).trim())); if (typeof result === 'number') result = Number.isFinite(result) ? Math.round(result * 1e10) / 1e10 : '#NUM!'; if (result?.values) result = '#VALUE!'; }
  catch (e) { result = e.message.startsWith('#') ? e.message : '#ERROR!'; }
  context.cache?.set(key, result); return result;
}
export function parseCSV(text) {
  const rows = []; let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(value); value = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(value); rows.push(row); row = []; value = ''; }
    else value += c;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}
