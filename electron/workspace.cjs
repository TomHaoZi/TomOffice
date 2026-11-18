const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
function parseWorkspace(text) {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.files)) throw new Error('Invalid workspace');
  return data;
}
async function archiveCorrupt(filePath) {
  const archive = path.join(path.dirname(filePath), `workspace.corrupt-${Date.now()}-${randomUUID().slice(0, 8)}.json`);
  await fs.rename(filePath, archive);
  return archive;
}
async function loadWorkspace(filePath) {
  let damaged = false;
  try { return parseWorkspace(await fs.readFile(filePath, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') { await archiveCorrupt(filePath); damaged = true; }
  }
  try {
    const backup = parseWorkspace(await fs.readFile(filePath + '.bak', 'utf8'));
    return { ...backup, _recoveryNotice: '已从本机备份恢复工作空间；损坏的恢复文件已隔离保留。' };
  } catch { return damaged ? { files: [], tabs: [], active: null, _recoveryNotice: '恢复文件损坏，原始记录已隔离保留。请从已保存的文档继续工作。' } : null; }
}
async function saveWorkspace(filePath, serialized) {
  parseWorkspace(serialized);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath + '.tmp', serialized);
  try {
    parseWorkspace(await fs.readFile(filePath, 'utf8'));
    await fs.copyFile(filePath, filePath + '.bak.tmp');
    await fs.rename(filePath + '.bak.tmp', filePath + '.bak');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      // Never replace a known-good backup with a malformed primary file.
      if (error instanceof SyntaxError || error.message === 'Invalid workspace') await archiveCorrupt(filePath);
      else throw error;
    }
  }
  await fs.rename(filePath + '.tmp', filePath);
}
module.exports = { loadWorkspace, saveWorkspace };
