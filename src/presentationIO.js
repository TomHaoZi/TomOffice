import JSZip from 'jszip';
import { uid } from './model';
const all = (node, name) => node ? [...node.getElementsByTagNameNS('*', name)] : [];
const first = (node, name) => all(node, name)[0];
const direct = (node, name) => [...(node?.children || [])].filter(n => n.localName === name);
const relationId = node => node?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || node?.getAttribute('r:id');
const parseXML = text => { const xml = new DOMParser().parseFromString(text, 'application/xml'); if (xml.getElementsByTagName('parsererror').length) throw new Error('演示文件 XML 损坏'); return xml; };
const resolve = (from, to) => { const parts = to.startsWith('/') ? [] : from.split('/').slice(0, -1); for (const part of to.replace(/^\//, '').split('/')) { if (part === '..') parts.pop(); else if (part !== '.') parts.push(part); } return parts.join('/'); };
export async function readOfficeArchive(bytes) {
  const zip = await JSZip.loadAsync(bytes);
  let total = 0; for (const entry of Object.values(zip.files)) { total += entry._data?.uncompressedSize || 0; if (total > 160 * 1024 * 1024) throw new Error('解压内容超过 160 MB 安全限制'); }
  return zip;
}
export async function importPresentation(bytes) {
  const zip = await readOfficeArchive(bytes);
  const read = async file => zip.file(file) ? parseXML(await zip.file(file).async('string')) : null;
  const relationships = async file => {
    const relFile = file.replace(/([^/]+)$/, '_rels/$1.rels'); const xml = await read(relFile); const map = {};
    all(xml, 'Relationship').filter(r => r.getAttribute('TargetMode') !== 'External').forEach(r => { map[r.getAttribute('Id')] = resolve(file, r.getAttribute('Target')); }); return map;
  };
  const presentation = await read('ppt/presentation.xml'); if (!presentation) throw new Error('这不是有效的 PPTX 文件');
  const size = first(presentation, 'sldSz'), width = Number(size?.getAttribute('cx')) || 12192000, height = Number(size?.getAttribute('cy')) || 6858000;
  const theme = await read('ppt/theme/theme1.xml'); const palette = { bg1: '#ffffff', tx1: '#202b3b', bg2: '#f4f5f6', tx2: '#34485e' };
  const scheme = first(theme, 'clrScheme'); [...(scheme?.children || [])].forEach(item => { const color = item.firstElementChild; palette[item.localName] = '#' + (color?.getAttribute('val')?.match(/^[0-9A-F]{6}$/i) ? color.getAttribute('val') : color?.getAttribute('lastClr') || '202b3b'); });
  palette.bg1 = palette.lt1 || palette.bg1; palette.tx1 = palette.dk1 || palette.tx1;
  const colorOf = (node, fallback) => { const solid = node?.localName === 'solidFill' ? node : direct(node, 'solidFill')[0]; if (!solid) return fallback; const rgb = first(solid, 'srgbClr'), sc = first(solid, 'schemeClr'); return rgb ? '#' + rgb.getAttribute('val') : palette[sc?.getAttribute('val')] || fallback; };
  const rels = await relationships('ppt/presentation.xml'); const slides = [];
  const ids = all(presentation, 'sldId'); if (ids.length > 300) throw new Error('暂时支持最多 300 页幻灯片');
  for (const id of ids) {
    const file = rels[relationId(id)]; if (!file) continue;
    const xml = await read(file), links = await relationships(file);
    const layoutPath = Object.values(links).find(p => p.includes('/slideLayouts/')); const layout = layoutPath ? await read(layoutPath) : null;
    const bg = colorOf(first(xml, 'bgPr'), colorOf(first(layout, 'bgPr'), '#ffffff'));
    const slide = { id: uid(), bg, elements: [] };
    async function walk(tree, transform = { x: 0, y: 0, sx: 1, sy: 1 }) {
      for (const shape of [...(tree?.children || [])]) {
        if (!['sp', 'pic', 'grpSp'].includes(shape.localName)) continue;
        let xfrm = first(direct(shape, shape.localName === 'grpSp' ? 'grpSpPr' : 'spPr')[0], 'xfrm');
        const ph = first(shape, 'ph');
        let fallback;
        if (ph && layout) { fallback = all(layout, 'sp').find(sp => { const p = first(sp, 'ph'); return p && (p.getAttribute('idx') || '0') === (ph.getAttribute('idx') || '0'); }); if (!xfrm) xfrm = first(fallback, 'xfrm'); }
        const off = direct(xfrm, 'off')[0], ext = direct(xfrm, 'ext')[0];
        const ox = Number(off?.getAttribute('x')) || 0, oy = Number(off?.getAttribute('y')) || 0;
        const ew = Number(ext?.getAttribute('cx')) || width * .7, eh = Number(ext?.getAttribute('cy')) || height * .15;
        if (shape.localName === 'grpSp') {
          const chOff = direct(xfrm, 'chOff')[0], chExt = direct(xfrm, 'chExt')[0];
          const sx = ew / (Number(chExt?.getAttribute('cx')) || ew), sy = eh / (Number(chExt?.getAttribute('cy')) || eh);
          await walk(shape, { x: transform.x + (ox - Number(chOff?.getAttribute('x') || 0) * sx) * transform.sx, y: transform.y + (oy - Number(chOff?.getAttribute('y') || 0) * sy) * transform.sy, sx: sx * transform.sx, sy: sy * transform.sy }); continue;
        }
        const geometry = { id: uid(), x: (transform.x + ox * transform.sx) / width * 100, y: (transform.y + oy * transform.sy) / height * 100, w: ew * transform.sx / width * 100, h: eh * transform.sy / height * 100, rotate: Number(xfrm?.getAttribute('rot') || 0) / 60000 };
        if (shape.localName === 'pic') {
          const blip = first(shape, 'blip'), embed = blip?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed') || blip?.getAttribute('r:embed');
          const media = links[embed], entry = media && zip.file(media); const extension = media?.split('.').pop().toLowerCase();
          const mime = { png: 'png', jpg: 'jpeg', jpeg: 'jpeg', gif: 'gif', webp: 'webp' }[extension];
          if (entry && mime) slide.elements.push({ ...geometry, kind: 'image', src: `data:image/${mime};base64,${await entry.async('base64')}` });
          continue;
        }
        const properties = direct(shape, 'spPr')[0]; const fill = colorOf(properties);
        const txBody = direct(shape, 'txBody')[0]; const text = direct(txBody, 'p').map(p => [...p.children].map(n => n.localName === 'br' ? '\n' : n.localName === 'r' || n.localName === 'fld' ? all(n, 't').map(t => t.textContent).join('') : '').join('')).join('\n');
        if (text) {
          const rPr = first(txBody, 'rPr') || first(txBody, 'defRPr') || first(fallback, 'defRPr'), pPr = first(txBody, 'pPr');
          slide.elements.push({ ...geometry, kind: 'text', text, size: Number(rPr?.getAttribute('sz') || 2400) / 100 * 12192000 / width, color: colorOf(rPr, '#202b3b'), bold: rPr?.getAttribute('b') === '1', italic: rPr?.getAttribute('i') === '1', align: { ctr: 'center', r: 'right', l: 'left', just: 'justify' }[pPr?.getAttribute('algn')] || 'left', font: first(rPr, 'latin')?.getAttribute('typeface') || 'Microsoft YaHei' });
        } else if (fill) slide.elements.push({ ...geometry, kind: 'shape', shape: first(properties, 'prstGeom')?.getAttribute('prst') === 'ellipse' ? 'ellipse' : 'rect', color: fill });
      }
    }
    await walk(first(xml, 'spTree'));
    const notesPath = Object.values(links).find(p => p.includes('/notesSlides/')); const notes = notesPath ? await read(notesPath) : null;
    slide.notes = all(notes, 'sp').filter(sp => first(sp, 'ph')?.getAttribute('type') === 'body').map(sp => all(sp, 't').map(t => t.textContent).join('\n')).join('\n');
    slides.push(slide);
  }
  if (!slides.length) throw new Error('文件中没有可读取的幻灯片');
  return slides;
}
