import React, { useState } from 'react';
import { Check, Palette, UserRound, ShieldCheck, RotateCcw, Monitor, Droplets, Accessibility, FolderOpen } from 'lucide-react';
import { Modal } from './ui';
import { defaultPreferences, accentColors } from './preferences';
export { defaultPreferences, accentColors } from './preferences';
export default function Settings({ value, onChange, onClose }) {
  const patch = data => onChange({ ...value, ...data });
  const [folderError, setFolderError] = useState('');
  const toggle = (key, title, description) => <div className="toggle-setting"><div><b>{title}</b><p>{description}</p></div><button className={`switch ${value[key] ? 'on' : ''}`} role="switch" aria-checked={!!value[key]} aria-label={title} onClick={() => patch({ [key]: !value[key] })}><i/></button></div>;
  return <Modal title="把工作空间，调成你的样子。" onClose={onClose} wide>
    <div className="settings-body">
      <div className="settings-heading"><span><Droplets size={23}/></span><div><b>Liquid Glass</b><p>轻盈的材质，清晰的想法。</p></div><span className="glass-version">全新外观</span></div>
      <section className="settings-section name-setting"><label className="settings-label" htmlFor="workspace-name"><UserRound size={15}/>如何称呼你</label><input id="workspace-name" className="full-input" maxLength={24} placeholder="Tom" value={value.name} onChange={e => patch({ name: e.target.value })}/></section>
      <section className="settings-section"><label className="settings-label"><Monitor size={15}/>界面基调</label><div className="appearance-options">{[['cloud', '云白', '蓝紫晨雾，清透轻盈'], ['warm', '暖纸', '落日暖光，柔和从容']].map(([id, name, description]) => <button className={`appearance-card ${value.paper === id ? 'selected' : ''}`} key={id} onClick={() => patch({ paper: id })}><div className={`appearance-preview ${id}`}><i/><div><span/><span/><b/><b/><b/></div></div><div><b>{name}</b><small>{description}</small>{value.paper === id && <Check size={16}/>}</div></button>)}</div></section>
      <section className="settings-section accent-section"><div><label className="settings-label"><Palette size={15}/>点睛色</label><p>让常用操作，多一点你的个性。</p></div><div className="accent-options">{Object.entries(accentColors).map(([id, color]) => <button key={id} title={{ coral: '日落珊瑚', green: '森林绿', blue: '雾蓝', purple: '鸢尾紫' }[id]} aria-pressed={value.accent === id} style={{ background: color }} onClick={() => patch({ accent: id })}>{value.accent === id && <Check size={16}/>}</button>)}</div></section>
      <section className="settings-section glass-opacity-setting"><label className="settings-label" htmlFor="glass-opacity"><Droplets size={15}/>玻璃材质浓度<span>{value.glassOpacity}%</span></label><input id="glass-opacity" aria-label="玻璃材质浓度" type="range" min="45" max="90" value={value.glassOpacity} disabled={value.reduceTransparency} onChange={e => patch({ glassOpacity: +e.target.value })}/><div className="opacity-caption"><span>更通透</span><span>更柔和</span></div></section>
      <section className="settings-section accessibility-settings"><label className="settings-label"><Accessibility size={15}/>舒适与可读性</label>{toggle('reduceTransparency', '减少透明效果', '使用不透明面板，降低视觉干扰与图形负载。')}{toggle('reduceMotion', '减弱动态效果', '关闭跟随高光和位移动效，也尊重系统动态偏好。')}{toggle('compact', '紧凑布局', '减少留白，让首页展示更多文档。')}{toggle('showTemplates', '首页精选模板', '在工作台中展示三个常用模板。')}</section>
      <div className="settings-private"><ShieldCheck size={15}/><span>偏好与恢复记录仅存储于本机。</span><button title="恢复文件位置" disabled={!window.desktop} onClick={async () => { try { setFolderError(''); await window.desktop.openWorkspace(); } catch (error) { setFolderError('打开恢复目录失败：' + error.message); } }}><FolderOpen size={13}/>恢复文件位置</button></div>{folderError && <p className="settings-folder-error" role="alert">{folderError}</p>}
    </div>
    <div className="modal-actions settings-actions"><button onClick={() => onChange({ ...defaultPreferences })}><RotateCcw size={14}/>恢复默认</button><button className="primary" onClick={onClose}>完成设置</button></div>
  </Modal>;
}
