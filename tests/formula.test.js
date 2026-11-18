import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, colName, coords, rangeRefs, parseCSV } from '../src/formula.js';
const cells = { A1: { value: '10' }, A2: { value: '20' }, A3: { value: '=SUM(A1:A2)' }, B1: { value: '=AVERAGE(A1:A2)*2' } };
test('column names and reference coordinates', () => { assert.equal(colName(26), 'AA'); assert.deepEqual(coords('CV1000'), [999, 99]); assert.deepEqual(rangeRefs('B2', 'A1'), ['A1', 'B1', 'A2', 'B2']); });
test('formula arithmetic and references', () => { assert.equal(calculate(cells, 'A3'), 30); assert.equal(calculate(cells, 'B1'), 30); assert.equal(calculate({ A1: { value: '=(2+3)*4^2-50%' } }, 'A1'), 79.5); });
test('nested functions', () => { assert.equal(calculate({ ...cells, C1: { value: '=ROUND(AVERAGE(A1:A3)/7,2)' } }, 'C1'), 2.86); });
test('rejects cycles, code, malformed expressions, division by zero', () => {
  for (const [formula, expected] of [['=A1+1', '#CYCLE!'], ['=1/0', '#DIV/0!'], ['=process.exit()', '#NAME?'], ['=SUM(A1:A999999)', '#RANGE!'], ['=BOGUS(1)', '#NAME?'], ['=1+2 garbage', '#ERROR!']]) assert.equal(calculate({ A1: { value: formula } }, 'A1'), expected);
});
test('transitive cycle and empty cells', () => { assert.equal(calculate({ A1: { value: '=B1' }, B1: { value: '=A1' } }, 'A1'), '#CYCLE!'); assert.equal(calculate({ A1: { value: '=B1+2' } }, 'A1'), 2); });
test('aggregate ranges skip blank and text cells', () => { const data = { A1: { value: '10' }, A2: { value: 'label' }, B1: { value: '=AVERAGE(A1:A3)' }, B2: { value: '=COUNT(A1:A3)' }, B3: { value: '=SUM(A1:A3)' } }; assert.equal(calculate(data, 'B1'), 10); assert.equal(calculate(data, 'B2'), 1); assert.equal(calculate(data, 'B3'), 10); });
test('CSV supports escaped quotes, commas and multiline fields', () => { assert.deepEqual(parseCSV('a,"b,c","d""e"\r\n"two\nlines",2,3'), [['a', 'b,c', 'd"e'], ['two\nlines', '2', '3']]); });
