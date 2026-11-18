import React, { useState, useRef, useEffect } from 'react';
import { Clipboard, Scissors, Copy, Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, IndentIncrease, IndentDecrease, Highlighter, Table2, Image, Link, Search, Undo2, Redo2, Eraser, Type, Minus, Plus, Printer, FileDown, Pilcrow, ZoomIn, Check, ChevronDown, Heading1, FilePlus2, Replace, PanelLeft, Rows3, Columns3, Trash2 } from 'lucide-react';
import { Tool, Group, Dropdown, Modal } from './ui';
import { cleanHTML } from './files';
export default function DocEditor({ file, onChange, onSave, onExport, onPrint, historyRef }) {
  const editor = useRef(); const selection = useRef(); const imageInput = useRef();
  const [tab, setTab] = useState('开始'), [zoom, setZoom] = useState(90), [font, setFont] = useState('Microsoft YaHei'), [size, setSize] = useState('3');
  const [findOpen, setFindOpen] = useState(false), [find, setFind] = useState(''), [replacement, setReplacement] = useState(''), [findMsg, setFindMsg] = useState('');
  const [tableOpen, setTableOpen] = useState(false), [rows, setRows] = useState(3), [cols, setCols] = useState(3), [wide, setWide] = useState(file.page?.orientation === 'landscape');
  const [styles, setStyles] = useState({}), [count, setCount] = useState(0), [showOutline, setShowOutline] = useState(true), [outline, setOutline] = useState([]), [inTable, setInTable] = useState(false);
  useEffect(() => { editor.current.innerHTML = cleanHTML(file.html); setCount(editor.current.innerText.replace(/\s/g, '').length); setOutline([...editor.current.querySelectorAll('h1,h2,h3')].map(n => ({ text: n.textContent, level: n.tagName }))); }, [file.id]);
  useEffect(() => {
    function remember() {
      const s = window.getSelection();
      if (s.rangeCount && editor.current?.contains(s.anchorNode)) {
        selection.current = s.getRangeAt(0).cloneRange();
        setInTable(!!(s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement)?.closest('td,th'));
        setStyles(Object.fromEntries(['bold', 'italic', 'underline', 'strikeThrough', 'justifyLeft', 'justifyCenter', 'justifyRight'].map(c => [c, document.queryCommandState(c)])));
      }
    }
    document.addEventListener('selectionchange', remember);
    const findHandler = e => { if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); setFindOpen(v => !v); } };
    window.addEventListener('keydown', findHandler);
    return () => { document.removeEventListener('selectionchange', remember); window.removeEventListener('keydown', findHandler); };
  }, []);
  const sync = () => { onChange({ html: editor.current.innerHTML }); setCount(editor.current.innerText.replace(/\s/g, '').length); setOutline([...editor.current.querySelectorAll('h1,h2,h3')].map(n => ({ text: n.textContent, level: n.tagName }))); };
  const restore = () => { editor.current.focus(); if (selection.current && editor.current.contains(selection.current.startContainer)) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(selection.current); } };
  const cmd = (command, value) => { restore(); document.execCommand(command, false, value); sync(); };
  useEffect(() => { if (historyRef) historyRef.current = redo => cmd(redo ? 'redo' : 'undo'); return () => { if (historyRef) historyRef.current = null; }; }, [historyRef]);
  const insertTable = () => {
    cmd('insertHTML', `<table style="border-collapse:collapse;width:100%"><tbody>${Array.from({ length: Math.min(30, Math.max(1, rows)) }, () => `<tr>${Array.from({ length: Math.min(12, Math.max(1, cols)) }, () => '<td style="border:1px solid #bac2ce;padding:8px;min-width:30px"><br></td>').join('')}</tr>`).join('')}</tbody></table><p><br></p>`); setTableOpen(false);
  };
  const matches = () => {
    if (!find) return [];
    const walker = document.createTreeWalker(editor.current, NodeFilter.SHOW_TEXT); let node, text = ''; const parts = [], ranges = [];
    while ((node = walker.nextNode())) { parts.push({ node, offset: text.length }); text += node.textContent; }
    let pos = text.toLocaleLowerCase().indexOf(find.toLocaleLowerCase());
    while (pos >= 0) {
      const start = parts.findLast(p => p.offset <= pos), end = parts.findLast(p => p.offset < pos + find.length);
      const range = document.createRange(); range.setStart(start.node, pos - start.offset); range.setEnd(end.node, pos + find.length - end.offset); ranges.push(range);
      pos = text.toLocaleLowerCase().indexOf(find.toLocaleLowerCase(), pos + find.length);
    }
    return ranges;
  };
  const findNext = () => {
    const found = matches(); if (!found.length) { setFindMsg('未找到匹配内容'); return; }
    const s = window.getSelection(); const old = selection.current;
    const next = found.find(range => old && range.compareBoundaryPoints(Range.START_TO_START, old) > 0) || found[0];
    s.removeAllRanges(); s.addRange(next); selection.current = next.cloneRange(); next.startContainer.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' }); setFindMsg(`共 ${found.length} 处匹配`);
  };
  const replaceAll = () => {
    const found = matches(); if (!found.length) { setFindMsg('未找到匹配内容'); return; }
    editor.current.focus(); const s = window.getSelection();
    [...found].reverse().forEach(range => { s.removeAllRanges(); s.addRange(range); document.execCommand('insertText', false, replacement); });
    sync(); setFindMsg(`已替换 ${found.length} 处`);
  };
  const editTable = action => {
    const node = selection.current?.startContainer, cell = (node?.nodeType === 1 ? node : node?.parentElement)?.closest('td,th'), table = cell?.closest('table');
    if (!table) return;
    const clone = table.cloneNode(true), r = cell.parentElement.rowIndex, c = cell.cellIndex;
    if (action === 'row') { const row = clone.insertRow(r + 1); for (let i = 0; i < table.rows[r].cells.length; i++) row.insertCell().innerHTML = '<br>'; }
    if (action === 'column') [...clone.rows].forEach(row => { row.insertCell(Math.min(c + 1, row.cells.length)).innerHTML = '<br>'; });
    if (action === 'deleteRow') clone.deleteRow(r);
    const range = document.createRange(); range.selectNode(table); selection.current = range;
    cmd('insertHTML', action === 'delete' || !clone.rows.length ? '<p><br></p>' : clone.outerHTML); setInTable(false);
  };
  return <div className="editor-shell doc-shell">
    <div className="ribbon-tabs"><button className="file-menu" onClick={onSave}>文件</button>{['开始', '插入', '页面', '审阅', '视图'].map(t => <button key={t} className={tab === t ? 'selected' : ''} onClick={() => setTab(t)}>{t}</button>)}<span className="ribbon-tip">文字 · 记录每一个好想法</span></div>
    <div className="ribbon">
      {tab === '开始' && <><Group label="剪贴板"><Tool icon={Clipboard} label="粘贴" large onClick={async () => { try { cmd('insertText', await navigator.clipboard.readText()); } catch { alert('请使用 Ctrl+V 粘贴'); } }}/><div className="stack"><Tool icon={Scissors} label="剪切" onClick={() => cmd('cut')}/><Tool icon={Copy} label="复制" onClick={() => cmd('copy')}/></div></Group>
      <Group label="字体" className="font-group"><div className="stack"><div className="inline"><Dropdown value={font} onChange={v => { setFont(v); cmd('fontName', v); }} options={[{ value: 'Microsoft YaHei', label: '微软雅黑' }, { value: 'SimSun', label: '宋体' }, { value: 'SimHei', label: '黑体' }, 'Arial', 'Georgia', 'Times New Roman']} title="字体"/><Dropdown value={size} onChange={v => { setSize(v); cmd('fontSize', v); }} options={[{ value: '1', label: '8' }, { value: '2', label: '10' }, { value: '3', label: '12' }, { value: '4', label: '14' }, { value: '5', label: '18' }, { value: '6', label: '24' }, { value: '7', label: '36' }]} title="字号" style={{ width: 58 }}/></div><div className="inline">{[[Bold, 'bold', '加粗'], [Italic, 'italic', '斜体'], [Underline, 'underline', '下划线'], [Strikethrough, 'strikeThrough', '删除线']].map(([icon, c, label]) => <Tool key={c} icon={icon} title={label} active={styles[c]} onClick={() => cmd(c)}/>)}<label className="color-tool" title="文字颜色"><Type size={17}/><i style={{ background: '#e34a4a' }}/><input type="color" defaultValue="#e34a4a" onChange={e => cmd('foreColor', e.target.value)}/></label><label className="color-tool" title="高亮颜色"><Highlighter size={17}/><i style={{ background: '#ffe36c' }}/><input type="color" defaultValue="#fff2a8" onChange={e => cmd('hiliteColor', e.target.value)}/></label><Tool icon={Eraser} title="清除格式" onClick={() => cmd('removeFormat')}/></div></div></Group>
      <Group label="段落"><div className="stack"><div className="inline"><Tool icon={List} title="项目符号" onClick={() => cmd('insertUnorderedList')}/><Tool icon={ListOrdered} title="编号" onClick={() => cmd('insertOrderedList')}/><Tool icon={IndentDecrease} title="减少缩进" onClick={() => cmd('outdent')}/><Tool icon={IndentIncrease} title="增加缩进" onClick={() => cmd('indent')}/></div><div className="inline">{[[AlignLeft, 'justifyLeft'], [AlignCenter, 'justifyCenter'], [AlignRight, 'justifyRight'], [AlignJustify, 'justifyFull']].map(([icon, c]) => <Tool key={c} icon={icon} active={styles[c]} onClick={() => cmd(c)}/>)}</div></div></Group>
      <Group label="样式"><div className="style-preview" onMouseDown={e => e.preventDefault()}><button onClick={() => cmd('formatBlock', 'p')}><span>正文</span><small>正文</small></button><button onClick={() => cmd('formatBlock', 'h1')}><strong>标题</strong><small>标题 1</small></button><button onClick={() => cmd('formatBlock', 'h2')}><b>标题</b><small>标题 2</small></button></div></Group><Group label="编辑"><Tool icon={Search} label="查找替换" large onClick={() => setFindOpen(v => !v)}/></Group></>}
      {tab === '插入' && <><Group label="表格"><Tool icon={Table2} label="插入表格" large onClick={() => setTableOpen(true)}/></Group><Group label="表格编辑"><Tool icon={Rows3} label="增加行" large disabled={!inTable} onClick={() => editTable('row')}/><Tool icon={Columns3} label="增加列" large disabled={!inTable} onClick={() => editTable('column')}/><Tool icon={Trash2} label="删除行" large disabled={!inTable} onClick={() => editTable('deleteRow')}/><Tool icon={Trash2} label="删除表格" large disabled={!inTable} onClick={() => editTable('delete')}/></Group><Group label="插图"><Tool icon={Image} label="本地图片" large onClick={() => imageInput.current.click()}/></Group><Group label="内容"><Tool icon={Minus} label="水平线" large onClick={() => cmd('insertHorizontalRule')}/><Tool icon={FilePlus2} label="分页标记" large onClick={() => cmd('insertHTML', '<div style="break-after:page;border-bottom:1px dashed #d0d5de"><br></div><p><br></p>')}/></Group><span className="ribbon-help">支持图片、表格、标题、列表与常用文字格式</span></>}
      {tab === '页面' && <><Group label="纸张"><Tool icon={FileTextIcon} label={wide ? '横向纸张' : '纵向纸张'} large onClick={() => { setWide(v => !v); onChange({ page: { ...file.page, orientation: wide ? 'portrait' : 'landscape' } }); }}/></Group><Group label="输出"><Tool icon={Printer} label="打印 / PDF" large onClick={onPrint}/><Tool icon={FileDown} label="导出 DOCX" large onClick={() => onExport('docx')}/></Group><span className="ribbon-help">连续编辑画布 · 打印时按纸张自动分页</span></>}
      {tab === '审阅' && <><Group label="字数"><div className="word-count"><b>{count.toLocaleString()}</b><span>字符（不含空格）</span></div></Group><Group label="检查"><Tool icon={Search} label="查找替换" large onClick={() => setFindOpen(v => !v)}/><Tool icon={Eraser} label="清除格式" large onClick={() => cmd('removeFormat')}/></Group><span className="ribbon-help">拼写检查使用系统编辑引擎，不包含云端审校服务</span></>}
      {tab === '视图' && <><Group label="缩放"><Tool icon={Minus} label="缩小" large onClick={() => setZoom(v => Math.max(50, v - 10))}/><Tool icon={Plus} label="放大" large onClick={() => setZoom(v => Math.min(150, v + 10))}/><Tool icon={ZoomIn} label="100%" large onClick={() => setZoom(100)}/><Tool icon={PanelLeft} label="文档大纲" large active={showOutline} onClick={() => setShowOutline(v => !v)}/></Group><Group label="历史操作"><Tool icon={Undo2} label="撤销" large onClick={() => cmd('undo')}/><Tool icon={Redo2} label="重做" large onClick={() => cmd('redo')}/></Group></>}
    </div>
    {findOpen && <div className="find-bar"><Search size={16}/><input autoFocus placeholder="查找内容" value={find} onChange={e => setFind(e.target.value)} onKeyDown={e => e.key === 'Enter' && findNext()}/><button onClick={findNext}>查找下一处</button><input placeholder="替换为" value={replacement} onChange={e => setReplacement(e.target.value)}/><button onClick={() => { if (window.getSelection()?.toString().toLowerCase() === find.toLowerCase() && find) { cmd('insertText', replacement); setFindMsg('已替换'); } else findNext(); }}>替换</button><button onClick={replaceAll}>全部替换</button><span>{findMsg}</span><button onClick={() => setFindOpen(false)}>关闭</button></div>}
    <div className="doc-body">{showOutline && <aside className="doc-outline"><div className="outline-title"><PanelLeft size={15}/>文档大纲<button className="icon-btn" title="隐藏大纲" onClick={() => setShowOutline(false)}>×</button></div>{outline.length ? outline.map((h, i) => <button key={i} className={h.level} onClick={() => editor.current.querySelectorAll('h1,h2,h3')[i]?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>{h.text || '空标题'}</button>) : <div className="outline-empty"><Heading1 size={27}/><p>清晰的结构，<br/>是好文档的开始。</p><span>应用“标题”样式后<br/>在这里快速定位内容</span></div>}</aside>}<div className="doc-workspace"><div className="ruler" style={{ width: wide ? 1123 * zoom / 100 : 794 * zoom / 100 }}>{Array.from({ length: 21 }, (_, i) => <span key={i}>{i || '⌞'}</span>)}</div><div className="paper-wrap" style={{ width: (wide ? 1123 : 794) * zoom / 100 }}><article className={`document-paper ${wide ? 'landscape' : ''}`} style={{ zoom: zoom / 100 }} ref={editor} contentEditable suppressContentEditableWarning spellCheck onInput={sync} onPaste={e => { e.preventDefault(); const html = e.clipboardData.getData('text/html'); cmd(html ? 'insertHTML' : 'insertText', html ? cleanHTML(html) : e.clipboardData.getData('text/plain')); }}/></div><div className="paper-end">— 文档末尾 —</div></div></div>
    <div className="status-bar"><span>文字文档</span><span>{count.toLocaleString()} 字符</span><span><Check size={13}/>自动恢复已启用</span><div className="status-spacer"/><span>连续页面</span><button onClick={() => setZoom(v => Math.max(50, v - 10))}><Minus size={13}/></button><input aria-label="缩放" type="range" min="50" max="150" value={zoom} onChange={e => setZoom(+e.target.value)}/><button onClick={() => setZoom(v => Math.min(150, v + 10))}><Plus size={13}/></button><span>{zoom}%</span></div>
    <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e => { const f = e.target.files[0]; if (!f) return; if (f.size > 10 * 1024 * 1024) { alert('图片不能超过 10 MB'); return; } const reader = new FileReader(); reader.onload = () => cmd('insertHTML', `<img src="${reader.result}" style="max-width:100%;height:auto"/><p><br></p>`); reader.readAsDataURL(f); e.target.value = ''; }}/>
    {tableOpen && <Modal title="插入表格" onClose={() => setTableOpen(false)}><div className="modal-body form-fields"><label>行数（1–30）<input type="number" min="1" max="30" value={rows} onChange={e => setRows(+e.target.value)}/></label><label>列数（1–12）<input type="number" min="1" max="12" value={cols} onChange={e => setCols(+e.target.value)}/></label></div><div className="modal-actions"><button onClick={() => setTableOpen(false)}>取消</button><button className="primary" onClick={insertTable}>插入表格</button></div></Modal>}
  </div>;
}
function FileTextIcon(props) { return <Pilcrow {...props}/>; }
