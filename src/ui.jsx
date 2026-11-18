import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { kinds } from './model';
export function FileIcon({ type, size = '', className = '' }) { return <span className={`file-icon ${size} ${className}`} style={{ '--file-color': kinds[type].color }}>{kinds[type].short}</span>; }
const iconLabels = { Bold: '加粗', Italic: '斜体', Underline: '下划线', AlignLeft: '左对齐', AlignCenter: '居中对齐', AlignRight: '右对齐', AlignJustify: '两端对齐', Undo2: '撤销', Redo2: '重做', Percent: '百分比', DollarSign: '货币格式' };
export function Tool({ icon: Icon, label, onClick, active, disabled, large, title, children }) {
  const name = title || label || iconLabels[Icon?.displayName] || Icon?.displayName || '工具';
  return <button type="button" aria-label={name} aria-pressed={active === undefined ? undefined : !!active} className={`tool ${large ? 'large' : ''} ${active ? 'active' : ''}`} disabled={disabled} title={name} onMouseDown={e => e.preventDefault()} onClick={onClick}>{Icon && <Icon size={large ? 25 : 17} strokeWidth={1.65}/>} {label && <span>{label}</span>}{children}</button>;
}
export function Group({ label, children, className = '' }) { return <div className={`tool-group ${className}`}><div className="group-content">{children}</div><span className="group-label">{label}</span></div>; }
export function Modal({ title, children, onClose, wide }) {
  const dialog = useRef(); const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const target = dialog.current.querySelector('[autofocus],input,textarea,select') || dialog.current.querySelector('button');
    const frame = requestAnimationFrame(() => { if (target?.isConnected) target.focus(); });
    const key = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close.current(); }
      if (e.key === 'Tab') {
        const nodes = [...dialog.current.querySelectorAll('button,input,select,textarea,[tabindex="0"]')].filter(n => !n.disabled && n.offsetParent !== null);
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && (document.activeElement === first || !dialog.current.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown', key, true);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', key, true); if (previous?.isConnected && previous !== document.body) previous.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div ref={dialog} data-glass-light className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><header><h3>{title}</h3><button className="icon-btn" aria-label="关闭对话框" onClick={onClose}><X size={19}/></button></header>{children}</div></div>;
}
export function Dropdown({ value, onChange, options, title, style }) { return <select className="ribbon-select" aria-label={title || '选择选项'} title={title} value={value} style={style} onChange={e => onChange(e.target.value)}>{options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}</select>; }
