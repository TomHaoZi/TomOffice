import { uid, validateFile } from './model.js';
import { normalizePreferences } from './preferences.js';
export function restoreWorkspace(saved) {
  const files = [], rejected = Array.isArray(saved?.recoveryFiles) ? [...saved.recoveryFiles] : [], ids = new Set();
  let invalid = 0;
  for (const raw of Array.isArray(saved?.files) ? saved.files : []) {
    try {
      validateFile(raw);
      const file = { ...raw, id: typeof raw.id === 'string' && !ids.has(raw.id) ? raw.id : uid() };
      ids.add(file.id);
      if (file.type === 'sheet') file.sheets = file.sheets.map(s => ({ ...s, id: s.id || uid() }));
      if (file.type === 'slides') file.slides = file.slides.map(s => ({ ...s, id: s.id || uid(), elements: s.elements.map(e => ({ ...e, id: e.id || uid() })) }));
      files.push(file);
    } catch { rejected.push(raw); invalid++; }
  }
  const tabs = [...new Set(Array.isArray(saved?.tabs) ? saved.tabs : [])].filter(id => ids.has(id));
  const active = ids.has(saved?.active) ? saved.active : null;
  return { files, tabs: active && !tabs.includes(active) ? [...tabs, active] : tabs, active, preferences: normalizePreferences(saved?.preferences), recoveryFiles: rejected, notice: invalid ? `已恢复可用文档，${invalid} 份异常记录已隔离保留，不会清除原始内容。` : saved?._recoveryNotice || null };
}
