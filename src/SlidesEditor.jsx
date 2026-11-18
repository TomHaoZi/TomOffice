import React, { useState, useRef, useEffect } from 'react';
import { Plus, Copy, Trash2, Type, Image, Square, Play, Palette, ArrowUp, ArrowDown, FileDown, Bold, Undo2, Redo2, X, ChevronLeft, ChevronRight, MousePointer2, Layers, Circle, AlignLeft, AlignCenter, AlignRight, Italic, AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter, LayoutTemplate, RotateCw, ArrowDownToLine } from 'lucide-react';
import { Tool, Group, Dropdown } from './ui';
import { uid } from './model';
const themes = [['墨绿', '#163c36', '#ffffff'], ['午夜蓝', '#172d53', '#ffffff'], ['极简白', '#ffffff', '#203049'], ['暖杏', '#f7e8d7', '#653f2b'], ['暮紫', '#433568', '#ffffff']];
export default function SlidesEditor({ file, onChange, onExport, onUndo, onRedo }) {
  const [index, setIndex] = useState(0), [tab, setTab] = useState('开始'), [selected, setSelected] = useState(null), [editing, setEditing] = useState(null), [show, setShow] = useState(false), [previewIndex, setPreviewIndex] = useState(0), [drag, setDrag] = useState(null);
  const canvas = useRef(), imageInput = useRef(), presentation = useRef();
  const [canvasWidth, setCanvasWidth] = useState(800);
  useEffect(() => {
    const changed = () => { if (!document.fullscreenElement) setShow(false); };
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  useEffect(() => {
    if (!show) return;
    const node = presentation.current; node?.focus({ preventScroll: true });
    const timer = setTimeout(() => node?.isConnected && node.requestFullscreen?.().catch(() => {}), 0);
    return () => clearTimeout(timer);
  }, [show]);
  const exitShow = () => { setShow(false); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  useEffect(() => { const container = canvas.current.parentElement; const observer = new ResizeObserver(() => setCanvasWidth(Math.max(100, Math.min(container.clientWidth - 64, (container.clientHeight - 64) * 16 / 9)))); observer.observe(container); return () => observer.disconnect(); }, []);
  const activeIndex = Math.min(index, file.slides.length - 1);
  useEffect(() => { setIndex(i => Math.min(i, file.slides.length - 1)); setPreviewIndex(i => Math.min(i, file.slides.length - 1)); }, [file.slides.length]);
  const slide = file.slides[activeIndex];
  const element = slide.elements.find(e => e.id === selected);
  const update = patch => onChange({ slides: file.slides.map(s => s.id === slide.id ? { ...s, ...patch } : s) });
  const updateElement = patch => update({ elements: slide.elements.map(e => e.id === selected ? { ...e, ...patch } : e) });
  const addElement = (kind, shape = 'rect') => {
    const e = { id: uid(), kind, shape, x: 12, y: 30, w: kind === 'text' ? 65 : 25, h: kind === 'text' ? 18 : 28, text: '双击编辑文字', size: 28, color: kind === 'shape' ? '#6bb59b' : slide.bg === '#ffffff' ? '#203049' : '#ffffff', bold: false };
    update({ elements: [...slide.elements, e] }); setSelected(e.id);
  };
  const addSlide = (duplicate, layout = 'title') => {
    const next = duplicate ? { ...structuredClone(slide), id: uid(), elements: slide.elements.map(e => ({ ...e, id: uid() })) } : { id: uid(), bg: slide.bg, elements: [{ id: uid(), kind: 'text', x: 8, y: 10, w: 82, h: 18, text: '点击添加标题', color: slide.bg === '#ffffff' ? '#203049' : '#ffffff', size: 36, bold: true }] };
    if (!duplicate && layout === 'blank') next.elements = [];
    if (!duplicate && layout === 'columns') next.elements.push(...[8, 53].map((x, i) => ({ id: uid(), kind: 'text', x, y: 40, w: 39, h: 45, text: i === 0 ? '第一部分\n\n双击添加内容' : '第二部分\n\n双击添加内容', size: 22, color: slide.bg === '#ffffff' ? '#60778a' : '#c9d9d0' })));
    const slides = [...file.slides]; slides.splice(activeIndex + 1, 0, next); onChange({ slides }); setIndex(activeIndex + 1); setSelected(null);
  };
  const deleteSlide = () => { if (file.slides.length === 1) return; onChange({ slides: file.slides.filter(s => s.id !== slide.id) }); setIndex(Math.max(0, activeIndex - 1)); setSelected(null); };
  const reorder = direction => { const next = [...file.slides], target = activeIndex + direction; if (target < 0 || target >= next.length) return; [next[activeIndex], next[target]] = [next[target], next[activeIndex]]; onChange({ slides: next }); setIndex(target); };
  const duplicateElement = () => { if (!element) return; const clone = { ...element, id: uid(), x: Math.min(100 - element.w, element.x + 3), y: Math.min(100 - element.h, element.y + 3) }; update({ elements: [...slide.elements, clone] }); setSelected(clone.id); };
  const startDrag = (e, el, resize = false) => {
    if (editing === el.id) return;
    e.preventDefault(); e.stopPropagation(); setSelected(el.id);
    const rect = canvas.current.getBoundingClientRect(), startX = e.clientX, startY = e.clientY;
    const handle = ev => {
      const dx = (ev.clientX - startX) / rect.width * 100, dy = (ev.clientY - startY) / rect.height * 100;
      const patch = resize ? { w: Math.max(5, Math.min(100 - el.x, el.w + dx)), h: Math.max(4, Math.min(100 - el.y, el.h + dy)) } : { x: Math.max(0, Math.min(100 - el.w, el.x + dx)), y: Math.max(0, Math.min(100 - el.h, el.y + dy)) };
      setDrag({ id: el.id, ...patch });
    };
    let latest;
    const record = ev => { handle(ev); const dx = (ev.clientX - startX) / rect.width * 100, dy = (ev.clientY - startY) / rect.height * 100; latest = resize ? { w: Math.max(5, Math.min(100 - el.x, el.w + dx)), h: Math.max(4, Math.min(100 - el.y, el.h + dy)) } : { x: Math.max(0, Math.min(100 - el.w, el.x + dx)), y: Math.max(0, Math.min(100 - el.h, el.y + dy)) }; };
    const finish = () => { if (latest) update({ elements: slide.elements.map(item => item.id === el.id ? { ...item, ...latest } : item) }); setDrag(null); window.removeEventListener('pointermove', record); window.removeEventListener('pointerup', finish); };
    window.addEventListener('pointermove', record); window.addEventListener('pointerup', finish, { once: true });
  };
  useEffect(() => {
    const key = e => {
      if (show) {
        if (['ArrowRight', 'ArrowDown', ' ', 'PageDown'].includes(e.key)) { e.preventDefault(); setPreviewIndex(v => Math.min(file.slides.length - 1, v + 1)); }
        if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); setPreviewIndex(v => Math.max(0, v - 1)); }
        if (e.key === 'Escape') exitShow();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && element && !e.target.isContentEditable) { e.preventDefault(); duplicateElement(); }
      else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && element && !e.target.isContentEditable && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) { e.preventDefault(); const d = e.shiftKey ? 5 : 1; updateElement({ x: Math.max(0, Math.min(100 - element.w, element.x + (e.key === 'ArrowRight' ? d : e.key === 'ArrowLeft' ? -d : 0))), y: Math.max(0, Math.min(100 - element.h, element.y + (e.key === 'ArrowDown' ? d : e.key === 'ArrowUp' ? -d : 0))) }); }
      else if (e.key === 'F5') { e.preventDefault(); startShow(); }
      else if (e.key === 'Delete' && selected && !e.target.isContentEditable && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) { update({ elements: slide.elements.filter(el => el.id !== selected) }); setSelected(null); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  });
  const startShow = () => { setPreviewIndex(activeIndex); setShow(true); setSelected(null); setEditing(null); };
  const renderElements = (s, interactive = false) => s.elements.map(original => {
    const el = drag?.id === original.id ? { ...original, ...drag } : original;
    const isSelected = interactive && selected === el.id;
    return <div key={el.id} className={`slide-element ${el.kind} ${isSelected ? 'selected' : ''} ${interactive && editing === el.id ? 'editing' : ''}`} style={{ left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`, height: `${el.h}%`, fontSize: `${el.size / 9.6}cqw`, color: el.color, fontWeight: el.bold ? 700 : 400, fontStyle: el.italic ? 'italic' : 'normal', textAlign: el.align || 'left', transform: `rotate(${el.rotate || 0}deg)`, borderRadius: el.kind === 'shape' && el.shape === 'ellipse' ? '50%' : undefined, backgroundColor: el.kind === 'shape' ? el.color : undefined }} onPointerDown={interactive ? e => startDrag(e, el) : undefined} onDoubleClick={interactive && el.kind === 'text' ? e => { e.stopPropagation(); setEditing(el.id); setTimeout(() => { const node = canvas.current.querySelector(`[data-text="${el.id}"]`); node?.focus(); const range = document.createRange(); range.selectNodeContents(node); const s = window.getSelection(); s.removeAllRanges(); s.addRange(range); }, 0); } : undefined}>
      {el.kind === 'text' ? <div className="slide-text" data-text={el.id} contentEditable={interactive && editing === el.id} suppressContentEditableWarning onBlur={e => { if (editing === el.id) { update({ elements: slide.elements.map(item => item.id === el.id ? { ...item, text: e.currentTarget.innerText } : item) }); setEditing(null); } }} onPaste={interactive ? e => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); } : undefined}>{el.text}</div> : el.kind === 'image' ? <img draggable={false} src={el.src}/> : null}
      {isSelected && <><i className="resize-handle" onPointerDown={e => { e.stopPropagation(); startDrag(e, el, true); }}/><span className="element-drag-label"><MousePointer2 size={10}/>拖动移动 · 右下角缩放</span></>}
    </div>;
  });
  return <div className="editor-shell slides-shell"><div className="ribbon-tabs"><button className="file-menu" onClick={() => onExport('pptx')}>文件</button>{['开始', '插入', '设计', '放映'].map(t => <button key={t} className={tab === t ? 'selected' : ''} onClick={() => setTab(t)}>{t}</button>)}<span className="ribbon-tip">演示 · 精彩，自有表达</span></div>
    <div className="ribbon">
      {tab === '开始' && <><Group label="幻灯片"><Tool icon={Plus} label="新建幻灯片" large onClick={() => addSlide(false)}/><div className="stack"><Tool icon={Copy} label="复制" onClick={() => addSlide(true)}/><Tool icon={Trash2} label="删除" disabled={file.slides.length === 1} onClick={deleteSlide}/></div></Group><Group label="插入"><Tool icon={Type} label="文本框" large onClick={() => addElement('text')}/><Tool icon={Image} label="图片" large onClick={() => imageInput.current.click()}/><Tool icon={Square} label="矩形" large onClick={() => addElement('shape')}/></Group><Group label="文字与颜色"><Tool icon={Bold} active={element?.bold} disabled={!element || element.kind !== 'text'} onClick={() => updateElement({ bold: !element.bold })}/><Dropdown value={element?.size || 28} options={[16, 18, 24, 28, 32, 36, 44, 56, 64]} title="字号" onChange={v => element && updateElement({ size: +v })}/><label className="color-tool" title="对象颜色"><Palette size={18}/><i style={{ background: element?.color || '#ffffff' }}/><input type="color" value={element?.color || '#ffffff'} disabled={!element} onChange={e => updateElement({ color: e.target.value })}/></label></Group><Group label="排列"><Tool icon={ArrowUp} label="上移页" large onClick={() => reorder(-1)}/><Tool icon={ArrowDown} label="下移页" large onClick={() => reorder(1)}/></Group><Group label="放映"><Tool icon={Play} label="从当前页" large onClick={startShow}/></Group><Group label="历史"><Tool icon={Undo2} onClick={onUndo}/><Tool icon={Redo2} onClick={onRedo}/></Group></>}
      {tab === '插入' && <><Group label="对象"><Tool icon={Type} label="文本框" large onClick={() => addElement('text')}/><Tool icon={Image} label="本地图片" large onClick={() => imageInput.current.click()}/><Tool icon={Square} label="矩形" large onClick={() => addElement('shape')}/><Tool icon={Circle} label="椭圆" large onClick={() => addElement('shape', 'ellipse')}/></Group><Group label="版式"><Tool icon={LayoutTemplate} label="双栏新页" large onClick={() => addSlide(false, 'columns')}/><Tool icon={Plus} label="空白新页" large onClick={() => addSlide(false, 'blank')}/></Group><Group label="层级"><Tool icon={Copy} label="复制对象" large disabled={!element} onClick={duplicateElement}/><Tool icon={Layers} label="置于顶层" large disabled={!element} onClick={() => update({ elements: [...slide.elements.filter(e => e.id !== selected), element] })}/><Tool icon={Trash2} label="删除对象" large disabled={!element} onClick={() => { update({ elements: slide.elements.filter(e => e.id !== selected) }); setSelected(null); }}/></Group></>}
      {tab === '设计' && <><Group label="配色方案">{themes.map(([name, bg, fg]) => <button key={name} className="theme-swatch" onClick={() => update({ bg, elements: slide.elements.map(e => e.kind === 'text' ? { ...e, color: fg } : e) })}><i style={{ background: bg, color: fg }}>Aa</i><span>{name}</span></button>)}</Group><Group label="背景"><label className="background-color"><Palette size={24}/><span>自定义背景</span><input type="color" value={slide.bg} onChange={e => update({ bg: e.target.value })}/></label></Group></>}
      {tab === '放映' && <><Group label="演示"><Tool icon={Play} label="开始放映" large onClick={startShow}/></Group><Group label="导出"><Tool icon={FileDown} label="导出 PPTX" large onClick={() => onExport('pptx')}/></Group><span className="ribbon-help">方向键切换幻灯片 · Esc 退出放映 · F5 从当前页开始</span></>}
    </div>
    <div className="presentation-workspace"><aside className="slide-thumbnails"><div className="slides-panel-title">幻灯片 <span>{file.slides.length}</span></div>{file.slides.map((s, i) => <button className={`slide-thumbnail ${i === activeIndex ? 'selected' : ''}`} key={s.id} onClick={() => { setIndex(i); setSelected(null); setEditing(null); }}><span className="slide-number">{i + 1}</span><div className="mini-slide" style={{ background: s.bg }}>{renderElements(s)}</div></button>)}<button className="add-slide-btn" onClick={() => addSlide(false)}><Plus size={17}/>新建幻灯片</button></aside>
      <div className="slide-edit-area"><div className="slide-canvas-container"><div className="slide-canvas" ref={canvas} style={{ background: slide.bg, width: canvasWidth }} onPointerDown={e => { if (e.target === e.currentTarget) { setSelected(null); setEditing(null); } }}>{renderElements(slide, true)}</div></div><div className="slide-notes"><label>备注</label><textarea placeholder="点击添加演讲备注…" value={slide.notes || ''} onChange={e => update({ notes: e.target.value })}/></div></div>
      <aside className="slide-properties"><h3>{element ? '对象属性' : '幻灯片属性'}</h3>{element ? <><span className="property-label">位置与尺寸（%）</span><div className="property-grid">{[['x', 'X'], ['y', 'Y'], ['w', '宽'], ['h', '高']].map(([key, label]) => <label key={key}>{label}<input type="number" value={Math.round(element[key] * 10) / 10} min="0" max="100" onChange={e => updateElement({ [key]: Math.max(key === 'w' || key === 'h' ? 1 : 0, Math.min(100, +e.target.value)) })}/></label>)}</div><div className="object-property-controls">{element.kind === 'text' && <><span className="property-label">文字样式</span><div className="inline"><Tool icon={Bold} active={element.bold} onClick={() => updateElement({ bold: !element.bold })}/><Tool icon={Italic} active={element.italic} onClick={() => updateElement({ italic: !element.italic })}/>{[[AlignLeft, 'left'], [AlignCenter, 'center'], [AlignRight, 'right']].map(([Icon, align]) => <Tool key={align} icon={Icon} active={element.align === align} onClick={() => updateElement({ align })}/>)}</div></>}<span className="property-label">对齐与旋转</span><div className="inline"><Tool icon={AlignHorizontalJustifyCenter} title="水平居中" onClick={() => updateElement({ x: (100 - element.w) / 2 })}/><Tool icon={AlignVerticalJustifyCenter} title="垂直居中" onClick={() => updateElement({ y: (100 - element.h) / 2 })}/><Tool icon={RotateCw} title="顺时针旋转 15°" onClick={() => updateElement({ rotate: ((element.rotate || 0) + 15) % 360 })}/><Tool icon={Copy} title="复制对象 Ctrl+D" onClick={duplicateElement}/></div></div><button className="property-delete" onClick={() => { update({ elements: slide.elements.filter(e => e.id !== selected) }); setSelected(null); }}><Trash2 size={15}/>删除对象</button></> : <><span className="property-label">幻灯片背景</span><div className="theme-dots">{themes.map(([name, bg, fg]) => <button key={name} title={name} style={{ background: bg }} onClick={() => update({ bg })}/>)}</div><div className="property-info"><MousePointer2 size={22}/><p>单击选中对象<br/>拖动调整位置<br/>双击编辑文字</p></div><span className="property-label">页面尺寸</span><div className="aspect-badge">16 : 9 <span>宽屏</span></div></>}</aside>
    </div>
    <div className="status-bar"><span>幻灯片 {Math.min(index + 1, file.slides.length)} / {file.slides.length}</span><span>16:9 宽屏</span><div className="status-spacer"/><button onClick={startShow}><Play size={14}/>放映</button><span>自适应</span></div>
    <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => { const f = e.target.files[0]; if (!f) return; if (f.size > 10 * 1024 * 1024) { alert('图片不能超过 10 MB'); return; } const reader = new FileReader(); reader.onload = () => { const el = { id: uid(), kind: 'image', src: reader.result, x: 20, y: 20, w: 45, h: 50 }; update({ elements: [...slide.elements, el] }); setSelected(el.id); }; reader.readAsDataURL(f); e.target.value = ''; }}/>
    {show && <div ref={presentation} tabIndex={-1} role="dialog" aria-label="幻灯片放映" className="slideshow"><div className="slideshow-stage" style={{ background: file.slides[previewIndex]?.bg }}>{renderElements(file.slides[previewIndex] || slide)}</div><div className="slideshow-controls"><button onClick={() => setPreviewIndex(v => Math.max(0, v - 1))}><ChevronLeft size={19}/></button><span>{previewIndex + 1} / {file.slides.length}</span><button onClick={() => setPreviewIndex(v => Math.min(file.slides.length - 1, v + 1))}><ChevronRight size={19}/></button><button onClick={exitShow}><X size={18}/>退出</button></div></div>}
  </div>;
}
