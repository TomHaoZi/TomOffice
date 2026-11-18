import test from 'node:test';
import assert from 'node:assert/strict';
import { newFile, validateFile, templates } from '../src/model.js';
test('all six templates produce valid, editable source models', () => { for (const template of templates) { const file = newFile(template.type, template.id); assert.equal(validateFile(file), file); assert.equal(file.name, template.name); if (template.type === 'slides') assert.equal(file.slides.length, 3); } });
test('rejects inherited kind names and malformed payloads', () => { assert.throws(() => validateFile({ type: '__proto__', name: 'bad' })); assert.throws(() => validateFile({ type: 'sheet', name: 'bad', sheets: [{ name: 'x', cells: { A1: null } }] })); assert.throws(() => validateFile({ type: 'slides', name: 'bad', slides: [{ bg: '#fff', elements: [] }] })); });
test('new blank documents have independent identifiers and no placeholder content', () => { const a = newFile('doc'), b = newFile('doc'); assert.notEqual(a.id, b.id); assert.equal(a.html, '<p><br></p>'); assert.equal(newFile('sheet').sheets.length, 1); });
