import React, { useState, useEffect, useRef } from 'react';
import { Home as HomeIcon, Plus, X, Minus, Square, Search, Settings2, HelpCircle, ChevronDown, ArrowLeft, Save, Undo2, Redo2, Download, Printer, Check, CloudOff, FolderOpen, FileText, LayoutGrid, PanelLeftClose, Loader2, AlertCircle, Pencil, ShieldCheck } from 'lucide-react';
import Home from './Home';
import DocEditor from './DocEditor';
import SheetEditor from './SheetEditor';
import SlidesEditor from './SlidesEditor';
import { FileIcon, Modal } from './ui';
import { newFile, kinds } from './model';
import { importFile, saveFile } from './files';
import { buildPrintable } from './print';
import CommandPalette from './CommandPalette';
import Settings, { defaultPreferences, accentColors } from './Settings';
import { restoreWorkspace } from './workspace';
import { useGlassLight } from './useGlassLight';
export default function App() {
  const [files, setFiles] = useState([]), [tabs, setTabs] = useState([]), [active, setActive] = useState(null), [loaded, setLoaded] = useState(false), [query, setQuery] = useState(''), [modal, setModal] = useState(null), [toast, setToast] = useState(null), [busy, setBusy] = useState(false), [autosave, setAutosave] = useState('ready'), [rename, setRename] = useState('');
  const [preferences, setPreferences] = useState(defaultPreferences), [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0), root = useRef(), recoveryFiles = useRef([]), autosaveRevision = useRef(0), docHistory = useRef(null);
  useGlassLight(root, loaded && !preferences.reduceMotion && !preferences.reduceTransparency);
  const state = useRef(); state.current = { files, tabs, active, preferences, recoveryFiles: recoveryFiles.current };
  const actionRef = useRef(); const timer = useRef(); const browserFile = useRef(); const histories = useRef({});
  const current = files.find(f => f.id === active);
  const notify = (message, error = false) => { setToast({ message, error }); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(null), error ? 7000 : 3200); };
  useEffect(() => { (async () => {
    try {
      const saved = window.desktop ? await window.desktop.loadWorkspace() : JSON.parse(localStorage.getItem('tom-office') || 'null');
      if (saved?.files) {
        const restored = restoreWorkspace(saved);
        recoveryFiles.current = restored.recoveryFiles;
        setPreferences(restored.preferences); setFiles(restored.files); setTabs(restored.tabs); setActive(restored.active);
        if (restored.notice) notify(restored.notice, true);
      }
    } catch { notify('恢复记录读取失败，已开启空白工作空间。原文件未修改。', true); }
    setLoaded(true);
  })(); }, []);
  const persist = async data => { if (window.desktop) await window.desktop.saveWorkspace(data); else localStorage.setItem('tom-office', JSON.stringify(data)); };
  useEffect(() => {
    if (!loaded) return; setAutosave('saving');
    const revision = ++autosaveRevision.current;
    const timeout = setTimeout(() => persist({ files, tabs, active, preferences, recoveryFiles: recoveryFiles.current }).then(() => { if (revision === autosaveRevision.current) setAutosave('saved'); }).catch(() => { if (revision === autosaveRevision.current) setAutosave('error'); notify('自动恢复记录保存失败，请手动保存文档。', true); }), 650);
    return () => clearTimeout(timeout);
  }, [files, tabs, active, preferences, loaded]);
  useEffect(() => { if (!window.desktop) return; return window.desktop.onAction(action => actionRef.current?.(action)); }, []);
  useEffect(() => { if (loaded && window.desktop) window.desktop.pending().then(async sources => { for (const source of sources) await actionRef.current({ type: 'open-source', source }); }).catch(error => notify(error.message, true)); }, [loaded]);
  useEffect(() => {
    const key = e => {
      if (e.key === 'Escape') setModal(null);
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'k' && !window.desktop) { e.preventDefault(); setModal('palette'); }
      const actions = { n: 'new-doc', o: 'open', s: e.shiftKey ? 'saveAs' : 'save', p: 'print' };
      if (!window.desktop && actions[k]) { e.preventDefault(); actionRef.current(actions[k]); }
      if (['z', 'y'].includes(k) && !window.desktop) { if (current?.type !== 'doc') { e.preventDefault(); undo(k === 'y' || e.shiftKey); } }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [current]);
  const select = id => { setActive(id); setTabs(prev => prev.includes(id) ? prev : [...prev, id]); };
  const create = (type, template = false) => { const f = newFile(type, template); setFiles(prev => [...prev, f]); setTabs(prev => [...prev, f.id]); setActive(f.id); setModal(null); };
  const change = patch => {
    const id = state.current.active, before = state.current.files.find(f => f.id === id);
    if (!before) return;
    if (before.type !== 'doc') { const history = histories.current[id] ||= { undo: [], redo: [] }; history.undo.push(before); if (history.undo.length > 60) history.undo.shift(); history.redo = []; }
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...patch, dirty: true, modified: Date.now() } : f));
  };
  const undo = redo => {
    const target = document.activeElement;
    if (target && (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable && !target.closest('.document-paper'))) { document.execCommand(redo ? 'redo' : 'undo'); return; }
    const f = state.current.files.find(f => f.id === state.current.active);
    if (!f) return;
    if (f.type === 'doc') { docHistory.current?.(redo); return; }
    const h = histories.current[f.id]; const from = redo ? h?.redo : h?.undo; const to = redo ? h?.undo : h?.redo;
    if (!from?.length) return; to.push(f); const snapshot = from.pop(); setFiles(prev => prev.map(item => item.id === f.id ? { ...snapshot, dirty: true, modified: Date.now() } : item));
  };
  const open = async () => {
    try { if (!window.desktop) { browserFile.current.click(); return; } const source = await window.desktop.open(); if (source) await loadSource(source); }
    catch (error) { notify('打开失败：' + error.message, true); }
  };
  const loadSource = async source => {
    const existing = source.path && state.current.files.find(f => f.path === source.path);
    if (existing) { select(existing.id); notify('已切换到工作空间中的文档，保留未保存的编辑'); return; }
    if (source.bytes.length > 50 * 1024 * 1024) throw new Error('文件超过 50 MB 限制');
    setBusy(true);
    try { const f = await importFile(source); setFiles(prev => [...prev, f]); setTabs(prev => [...prev, f.id]); setActive(f.id); notify(f.format === 'tom' ? '文档已打开' : '已导入可编辑内容。复杂格式、图表及宏可能无法保留。'); }
    finally { setBusy(false); }
  };
  const save = async (format = 'tom', saveAs = false) => {
    document.activeElement?.blur(); await new Promise(r => setTimeout(r, 0));
    const f = state.current.files.find(f => f.id === state.current.active); if (!f) { notify('请先打开一份文档'); return; }
    setBusy(true);
    try {
      const path = await saveFile(f, format, saveAs);
      if (path) {
        if (format === 'tom') setFiles(prev => prev.map(item => item.id === f.id ? { ...item, path, format, dirty: item.modified !== f.modified } : item));
        notify(format === 'tom' ? '文件已保存到本机' : `已导出 ${format.toUpperCase()} 文件`); setModal(null);
      }
    } catch (error) { notify('保存失败：' + error.message, true); }
    finally { setBusy(false); }
  };
  const print = async () => {
    document.activeElement?.blur(); await new Promise(r => setTimeout(r, 0));
    const f = state.current.files.find(f => f.id === state.current.active); if (!f) { notify('请先打开一份文档'); return; }
    if (!window.desktop) { notify('请在桌面版中使用完整的打印功能'); return; }
    setBusy(true);
    try { await window.desktop.print(buildPrintable(f)); } catch (e) { notify('打印失败：' + e.message, true); }
    finally { setBusy(false); }
  };
  actionRef.current = async action => {
    if (action?.type === 'open-source') { try { await loadSource(action.source); } catch (error) { notify('打开失败：' + error.message, true); } return; }
    if (action === 'palette') setModal('palette');
    if (action === 'new-doc') create('doc');
    if (action === 'open') await open();
    if (action === 'save') await save();
    if (action === 'saveAs') await save('tom', true);
    if (action === 'print') await print();
    if (action === 'undo' || action === 'redo') undo(action === 'redo');
    if (action === 'quit') {
      document.activeElement?.blur(); await new Promise(r => setTimeout(r, 20));
      try { await persist(state.current); await window.desktop.window('quit'); }
      catch { notify('未能保存恢复记录，请先手动保存文件后重试退出。', true); }
    }
  };
  const closeTab = id => { setTabs(prev => prev.filter(t => t !== id)); if (active === id) { const idx = tabs.indexOf(id); setActive(tabs[idx - 1] || tabs[idx + 1] || null); } };
  if (!loaded) return <div className="loading-screen"><div className="brand-mark">T</div><h2>Tom Office</h2><Loader2 className="spin" size={20}/></div>;
  return <div className={`app ${current ? `mode-${current.type}` : 'mode-home'}`} ref={root} data-paper={preferences.paper} data-transparency={preferences.reduceTransparency ? 'reduced' : 'glass'} data-motion={preferences.reduceMotion ? 'reduced' : 'auto'} style={{ '--brand-color': accentColors[preferences.accent] || accentColors.blue, '--glass-alpha': preferences.glassOpacity / 100 }} onDragEnter={e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); dragDepth.current++; setDragging(true); } }} onDragOver={e => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); }} onDragLeave={e => { if ([...e.dataTransfer.types].includes('Files') && --dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false); } }} onDrop={async e => { e.preventDefault(); dragDepth.current = 0; setDragging(false); for (const f of [...e.dataTransfer.files]) try { await loadSource({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }); } catch (error) { notify('导入失败：' + error.message, true); } }}> 
    <header className="titlebar"><button className="brand" onClick={() => setActive(null)}><span className="brand-mark">T</span><strong>Tom <span>Office</span></strong></button><div className="top-tabs"><button className={`home-tab ${!active ? 'active' : ''}`} onClick={() => setActive(null)}><HomeIcon size={16}/>首页</button>{tabs.map(id => { const f = files.find(item => item.id === id); return f && <div key={id} className={`document-tab ${id === active ? 'active' : ''}`} onClick={() => setActive(id)}><FileIcon type={f.type}/><span>{f.name}</span>{f.dirty && <i className="dirty-dot"/>}<button title="关闭标签页（文档保留在工作空间）" onClick={e => { e.stopPropagation(); closeTab(id); }}><X size={13}/></button></div>; })}<button className="add-tab" title="新建" onClick={() => setModal('create')}><Plus size={19}/></button></div><div className="window-controls"><button title="最小化" onClick={() => window.desktop?.window('minimize')}><Minus size={16}/></button><button title="最大化 / 还原" onClick={() => window.desktop?.window('maximize')}><Square size={12}/></button><button className="window-close" title="关闭" onClick={() => window.desktop ? window.desktop.window('close') : notify('当前为浏览器预览，请关闭浏览器标签页')}><X size={17}/></button></div></header>
    {!current ? <div className="home-toolbar"><div className="workspace-breadcrumb"><LayoutGrid size={16}/><b>工作台</b><span>/</span><span>个人空间</span></div><div className="global-search"><Search size={16}/><input placeholder="搜索你的文档，找到每一份灵感" value={query} onChange={e => setQuery(e.target.value)}/><kbd>搜索</kbd></div><div className="toolbar-right"><button className="toolbar-command" title="快捷操作 Ctrl+K" onClick={() => setModal('palette')}><Search size={14}/><kbd>Ctrl K</kbd></button><span className="offline-status"><i/>本地模式</span><button className="icon-btn" title="帮助与版本信息" onClick={() => setModal('about')}><HelpCircle size={19}/></button><button className="icon-btn" title="外观设置" onClick={() => setModal('settings')}><Settings2 size={18}/></button><span className="avatar small">{(preferences.name || 'Tom').slice(0, 1).toUpperCase()}</span></div></div> : <div className="quick-toolbar"><div className="quick-actions"><button className="icon-btn" title="返回首页" onClick={() => setActive(null)}><ArrowLeft size={17}/></button><span className="vertical-line"/><button className="icon-btn" title="保存 Ctrl+S" onClick={() => save()}><Save size={17}/></button><button className="icon-btn" title="撤销" onMouseDown={e => e.preventDefault()} onClick={() => undo(false)}><Undo2 size={17}/></button><button className="icon-btn" title="重做" onMouseDown={e => e.preventDefault()} onClick={() => undo(true)}><Redo2 size={17}/></button><span className="vertical-line"/><button className="document-title" onClick={() => { setRename(current.name); setModal('rename'); }}>{current.name}<ChevronDown size={13}/></button><span className={`save-status ${autosave === 'error' ? 'error' : ''}`}>{autosave === 'saving' ? <Loader2 size={12} className="spin"/> : autosave === 'error' ? <AlertCircle size={12}/> : <Check size={12}/>}<span>{autosave === 'saving' ? '保存恢复记录…' : autosave === 'error' ? '恢复记录保存失败' : '恢复记录已保存'}</span></span></div><div className="quick-actions"><button className="text-button" onClick={open}><FolderOpen size={15}/>打开</button><button className="text-button" onClick={print}><Printer size={15}/>打印</button><button className="icon-btn" title="快捷操作 Ctrl+K" onClick={() => setModal('palette')}><Search size={17}/></button><button className="export-button" onClick={() => setModal('export')}><Download size={15}/>导出 / 另存为</button><button className="icon-btn" title="帮助与版本信息" onClick={() => setModal('about')}><HelpCircle size={18}/></button></div></div>}
    {!current ? <Home preferences={preferences} onSettings={() => setModal('settings')} onPalette={() => setModal('palette')} files={files} onNew={create} onOpen={open} onSelect={select} query={query} setQuery={setQuery} onStar={id => setFiles(prev => prev.map(f => f.id === id ? { ...f, starred: !f.starred } : f))} onDelete={id => setModal({ type: 'delete', id })}/> : current.type === 'doc' ? <DocEditor key={current.id} historyRef={docHistory} file={current} onChange={change} onSave={() => save()} onExport={save} onPrint={print}/> : current.type === 'sheet' ? <SheetEditor key={current.id} file={current} onChange={change} onExport={save} onUndo={() => undo(false)} onRedo={() => undo(true)}/> : <SlidesEditor key={current.id} file={current} onChange={change} onExport={save} onUndo={() => undo(false)} onRedo={() => undo(true)}/>}
    {modal === 'create' && <Modal title="创建新文档" onClose={() => setModal(null)}><div className="new-file-options">{Object.entries(kinds).map(([type, meta]) => <button key={type} onClick={() => create(type)}><FileIcon type={type} size="big"/><b>新建{meta.label}</b><span>{meta.extension.toUpperCase()}</span><Plus size={18}/></button>)}</div></Modal>}
    {modal === 'rename' && <Modal title="重命名文档" onClose={() => setModal(null)}><form onSubmit={e => { e.preventDefault(); const name = rename.trim().replace(/[<>:"/\\|?*]/g, '').slice(0, 100); if (name) { change({ name }); setModal(null); } }}><div className="modal-body"><input className="full-input" autoFocus value={rename} onChange={e => setRename(e.target.value)} maxLength={100}/><p className="hint">更改工作空间名称，不会重命名原磁盘文件。</p></div><div className="modal-actions"><button type="button" onClick={() => setModal(null)}>取消</button><button className="primary">保存名称</button></div></form></Modal>}
    {modal === 'export' && current && <Modal title="导出与保存" onClose={() => setModal(null)}><div className="export-options"><button disabled={busy} onClick={() => save('tom', true)}><span className="format-badge native">T</span><div><b>Tom Office 文档 <em>.tom</em></b><p>完整保留本应用的编辑内容，建议作为源文件保存</p></div><Download size={18}/></button><button disabled={busy} onClick={() => save(kinds[current.type].extension, true)}><FileIcon type={current.type} size="big"/><div><b>{kinds[current.type].extension.toUpperCase()} <em>通用办公格式</em></b><p>{current.type === 'doc' ? '保留文字、常用格式、图片与表格；复杂版式可能变化' : current.type === 'sheet' ? '保留单元格、公式、列宽、冻结与常用格式' : '保留文本、图片、基本形状与演讲备注'}</p></div><Download size={18}/></button><button disabled={busy} onClick={() => save('pdf', true)}><span className="format-badge pdf">PDF</span><div><b>PDF <em>便携文档格式</em></b><p>直接生成 PDF 文件，保留可视排版，方便分享与打印</p></div><Download size={18}/></button>{current.type !== 'slides' && <button disabled={busy} onClick={() => save(current.type === 'doc' ? 'txt' : 'csv', true)}><span className="format-badge plain">{current.type === 'doc' ? 'TXT' : 'CSV'}</span><div><b>{current.type === 'doc' ? 'TXT 纯文本' : 'CSV 表格数据'}</b><p>{current.type === 'doc' ? '只导出文字，不包含图片与格式' : '导出第一个工作表的计算结果，不包含格式'}</p></div><Download size={18}/></button>}</div><div className="export-note"><ShieldCheck size={16}/>所有转换均在本机完成，不会上传你的文件。</div></Modal>}
    {modal === 'about' && <Modal title="关于 Tom Office" onClose={() => setModal(null)} wide><div className="about-body"><div className="about-brand"><span className="brand-mark">T</span><div><h2>Tom Office</h2><p>桌面办公套件 · v0.3.0 · Liquid Glass</p></div><span className="version-badge">本地版</span></div><h4>为你的每一个想法，提供一处工作空间。</h4><p>支持富文本编辑、多工作表、常用公式、幻灯片编排与放映。无需账号，所有文件和恢复记录均存储于本机。</p><div className="about-tip"><b>保存与恢复</b><p>Ctrl+S 保存为 .tom 源文件。工作空间自动保留恢复记录；它不等同于磁盘文件备份。重要文档请手动保存。</p></div><div className="about-tip"><b>当前版本边界</b><p>这不是 WPS 或 Microsoft Office，也不宣称完整兼容。支持 DOCX/XLSX/PPTX 导入导出及 PDF 输出。PPTX 导入提取文本、图片和基本形状，不保证完整母版、动画、图表和排版。不支持旧版 DOC/XLS/PPT、宏、云协作、批注、修订、透视表以及 Excel 全部函数。导入复杂文件前请保留原件。</p></div><div className="shortcut-list"><span>新建文字 <kbd>Ctrl N</kbd></span><span>打开文件 <kbd>Ctrl O</kbd></span><span>保存源文件 <kbd>Ctrl S</kbd></span><span>文字查找 <kbd>Ctrl F</kbd></span></div></div></Modal>}
    {modal?.type === 'delete' && <Modal title="从工作空间移除？" onClose={() => setModal(null)}><div className="modal-body"><p>此操作将清除这份文档的本机恢复记录，且无法撤销。磁盘上已保存的文件不会被删除。</p><p className="hint">如果还没有保存到文件，请先保存再移除。</p></div><div className="modal-actions"><button onClick={() => setModal(null)}>取消</button><button className="danger" onClick={() => { closeTab(modal.id); setFiles(prev => prev.filter(f => f.id !== modal.id)); setModal(null); }}>确认移除</button></div></Modal>}
    {modal === 'settings' && <Settings value={preferences} onChange={setPreferences} onClose={() => setModal(null)}/>}
    {modal === 'palette' && <CommandPalette files={files} onSelect={select} onClose={() => setModal(null)} actions={[...Object.entries(kinds).map(([type, meta]) => ({ label: '新建' + meta.label, icon: FileText, hint: meta.extension.toUpperCase(), action: () => create(type) })), { label: '打开本地文件', icon: FolderOpen, hint: 'Ctrl O', action: open }, ...(current ? [{ label: '保存当前文档', icon: Save, hint: 'Ctrl S', action: () => save() }, { label: '导出 PDF', icon: Download, hint: 'PDF', action: () => save('pdf', true) }, { label: '导出 / 另存为', icon: Download, action: () => setModal('export') }] : []), { label: '外观设置', icon: Settings2, action: () => setModal('settings') }, { label: '关于 Tom Office', icon: HelpCircle, action: () => setModal('about') }]}/>}
    {dragging && <div className="drop-overlay"><div><FolderOpen size={42}/><h2>让文件，来到你的工作空间。</h2><p>松开鼠标即可导入 DOCX · XLSX · PPTX · TXT · CSV · TOM</p></div></div>}
    {toast && <div role={toast.error ? 'alert' : 'status'} aria-live={toast.error ? 'assertive' : 'polite'} className={`toast ${toast.error ? 'error' : ''}`}>{toast.error ? <AlertCircle size={18}/> : <Check size={18}/>}<span>{toast.message}</span><button onClick={() => setToast(null)}><X size={14}/></button></div>}
    {busy && <div className="busy-overlay" role="status" aria-live="polite"><div><Loader2 className="spin" size={25}/><span>正在处理文件，请稍候…</span></div></div>}
    <input ref={browserFile} type="file" accept=".tom,.docx,.xlsx,.pptx,.csv,.txt" hidden onChange={async e => { const f = e.target.files[0]; if (f) try { await loadSource({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }); } catch (err) { notify(err.message, true); } e.target.value = ''; }}/>
  </div>;
}
