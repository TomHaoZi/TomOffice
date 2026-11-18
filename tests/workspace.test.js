import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { normalizePreferences, accentColors } from '../src/preferences.js';
import { restoreWorkspace } from '../src/workspace.js';
import { newFile } from '../src/model.js';
const { loadWorkspace, saveWorkspace } = createRequire(import.meta.url)('../electron/workspace.cjs');
async function temporary(t) { const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tom-workspace-unit-')); t.after(() => fs.rm(dir, { recursive: true, force: true })); return path.join(dir, 'workspace.json'); }
test('preferences migrate safely and reject malformed persisted values', () => {
  const prefs = normalizePreferences({ name: 5, accent: '__proto__', paper: 'unknown', glassOpacity: NaN, compact: 'false', reduceMotion: true });
  assert.equal(prefs.name, 'Tom'); assert.equal(prefs.accent, 'blue'); assert.equal(prefs.paper, 'cloud'); assert.equal(prefs.glassOpacity, 62); assert.equal(prefs.compact, false); assert.equal(prefs.reduceMotion, true);
  assert.equal(normalizePreferences({ glassOpacity: 999 }).glassOpacity, 90); assert.equal(normalizePreferences({ glassOpacity: -1 }).glassOpacity, 45);
});
test('all accent buttons preserve white-text contrast, including their subtle highlight', () => {
  for (const hex of Object.values(accentColors)) {
    const rgb = hex.slice(1).match(/../g).map(n => parseInt(n, 16) * .96 + 255 * .04);
    const luminance = rgb.map(n => { const v = n / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    assert.ok(1.05 / (luminance + .05) >= 4.5, hex + ' must meet 4.5:1');
  }
});
test('one bad document is isolated without losing good records or original payload', () => {
  const good = newFile('doc'), bad = { id: 'broken', type: 'sheet', name: 'broken', sheets: [] };
  const result = restoreWorkspace({ files: [good, bad], tabs: [good.id, good.id, 'broken'], active: 'broken', preferences: { name: 'Ada' } });
  assert.equal(result.files.length, 1); assert.equal(result.files[0].id, good.id); assert.deepEqual(result.tabs, [good.id]); assert.equal(result.active, null); assert.deepEqual(result.recoveryFiles, [bad]); assert.match(result.notice, /1 份异常/); assert.equal(result.preferences.name, 'Ada');
  const again = restoreWorkspace(result); assert.deepEqual(again.recoveryFiles, [bad]);
});
test('duplicate document IDs are repaired and active tab is restored', () => {
  const a = newFile('doc'), b = { ...newFile('doc'), id: a.id };
  const result = restoreWorkspace({ files: [a, b], tabs: [], active: a.id });
  assert.notEqual(result.files[0].id, result.files[1].id); assert.deepEqual(result.tabs, [a.id]);
});
test('workspace writes keep the previous valid version as an atomic backup', async t => {
  const file = await temporary(t); const first = { files: [newFile('doc')], active: null, tabs: [] }, next = { ...first, preferences: { name: 'Ada' } };
  await saveWorkspace(file, JSON.stringify(first)); await saveWorkspace(file, JSON.stringify(next));
  assert.deepEqual(await loadWorkspace(file), next); assert.deepEqual(JSON.parse(await fs.readFile(file + '.bak', 'utf8')), first);
});
test('corrupt primary is quarantined and a good backup is recovered', async t => {
  const file = await temporary(t), data = { files: [newFile('sheet')], tabs: [] };
  await saveWorkspace(file, JSON.stringify(data)); await saveWorkspace(file, JSON.stringify(data)); await fs.writeFile(file, '{ damaged json');
  const loaded = await loadWorkspace(file); assert.equal(loaded.files[0].id, data.files[0].id); assert.match(loaded._recoveryNotice, /备份/);
  const archives = (await fs.readdir(path.dirname(file))).filter(n => n.startsWith('workspace.corrupt-')); assert.equal(archives.length, 1); assert.equal(await fs.readFile(path.join(path.dirname(file), archives[0]), 'utf8'), '{ damaged json');
  await saveWorkspace(file, JSON.stringify(loaded)); assert.equal(JSON.parse(await fs.readFile(file + '.bak', 'utf8')).files.length, 1);
});
test('corrupt workspace without a backup is preserved rather than silently overwritten', async t => {
  const file = await temporary(t); await fs.writeFile(file, 'broken');
  const loaded = await loadWorkspace(file); assert.equal(loaded.files.length, 0); assert.match(loaded._recoveryNotice, /原始记录已隔离/);
  assert.ok((await fs.readdir(path.dirname(file))).some(n => n.startsWith('workspace.corrupt-')));
});
