export const uid = () => crypto.randomUUID();
export const kinds = { doc: { label: '文字', short: 'W', color: '#3573ed', extension: 'docx' }, sheet: { label: '表格', short: 'S', color: '#21a366', extension: 'xlsx' }, slides: { label: '演示', short: 'P', color: '#ee7942', extension: 'pptx' } };
export const templates = [
  { id: 'proposal', type: 'doc', name: '项目策划书', featured: true },
  { id: 'budget', type: 'sheet', name: '项目预算表', featured: true },
  { id: 'pitch', type: 'slides', name: '极简项目提案', featured: true },
  { id: 'meeting', type: 'doc', name: '高效会议纪要' },
  { id: 'tracker', type: 'sheet', name: '任务进度看板' },
  { id: 'report', type: 'slides', name: '季度工作汇报' }
];
export function newFile(type, template = false) {
  const file = { id: uid(), type, name: type === 'doc' ? '未命名文档' : type === 'sheet' ? '未命名工作簿' : '未命名演示文稿', modified: Date.now(), dirty: true };
  if (type === 'doc') file.html = template ? '<h1 style="text-align:center">项目策划书</h1><p style="text-align:center;color:#8b93a4">PROJECT PROPOSAL · 2026</p><p><br></p><h2>一、项目概述</h2><p>在此描述项目背景、目标与核心价值。</p><h2>二、实施计划</h2><p>明确关键里程碑、交付内容和负责人。</p><h2>三、预期成果</h2><p>记录项目成功的衡量标准。</p>' : '<p><br></p>';
  if (type === 'sheet') file.sheets = [{ id: uid(), name: 'Sheet1', cells: template ? { A1: { value: '项目' }, B1: { value: '预算' }, C1: { value: '实际支出' }, D1: { value: '结余' }, A2: { value: '市场推广' }, B2: { value: '15000' }, C2: { value: '12000' }, D2: { value: '=B2-C2' }, A3: { value: '产品研发' }, B3: { value: '32000' }, C3: { value: '28500' }, D3: { value: '=B3-C3' }, A4: { value: '合计' }, B4: { value: '=SUM(B2:B3)' }, C4: { value: '=SUM(C2:C3)' }, D4: { value: '=SUM(D2:D3)' } } : {} }];
  if (type === 'slides') file.slides = [{ id: uid(), bg: '#163c36', elements: [{ id: uid(), kind: 'text', x: 8, y: 22, w: 78, h: 20, text: template ? '让想法，\n成为下一步。' : '在这里，开启你的演示', size: 44, color: '#ffffff', bold: true }, { id: uid(), kind: 'text', x: 8, y: 72, w: 75, h: 10, text: 'Tom Office  /  点击编辑副标题', size: 18, color: '#b0d5c4' }] }];
  if (template) {
    const meta = templates.find(t => t.id === template) || templates.find(t => t.type === type);
    file.name = meta?.name || file.name;
    if (type === 'doc' && template === 'meeting') file.html = '<p style="color:#438273;font-size:12px">MEETING NOTES / 高效协作</p><h1>把讨论，变成行动。</h1><p style="color:#86918f">会议主题：____________　日期：____________</p><p><br></p><h2>01　会议信息</h2><p>主持人：____________　参会人员：____________</p><h2>02　议题与结论</h2><p>记录关键讨论内容，以及达成的共识。</p><ul><li>议题一：在此记录主要内容</li><li>议题二：在此记录主要内容</li></ul><h2>03　下一步行动</h2><table><tr><th>行动事项</th><th>负责人</th><th>截止日期</th></tr><tr><td>确认交付内容</td><td>待分配</td><td>待确认</td></tr><tr><td>跟进执行进度</td><td>待分配</td><td>待确认</td></tr></table><h2>04　补充记录</h2><p>让每一个重要细节，都有迹可循。</p>';
    if (type === 'sheet') {
      const s = file.sheets[0]; s.frozen = true;
      if (template === 'tracker') {
        s.cells = {}; const rows = [['任务', '负责人', '优先级', '进度', '状态'], ['需求确认', 'Tom', '高', '1', '已完成'], ['方案设计', 'Tom', '高', '0.7', '进行中'], ['开发实现', '团队', '中', '0.3', '进行中'], ['验收交付', '团队', '中', '0', '待开始'], ['完成数量', '=COUNTIF(E2:E5,"已完成")', '', '', ''], ['平均进度', '=AVERAGE(D2:D5)', '', '', '']];
        rows.forEach((row, r) => row.forEach((value, c) => { s.cells[`${String.fromCharCode(65 + c)}${r + 1}`] = { value, format: c === 3 && r > 0 && r < 5 || r === 6 && c === 1 ? 'percent' : 'general' }; }));
        s.widths = { 0: 160, 1: 130, 2: 120, 3: 140, 4: 140 };
      }
      Object.entries(s.cells).forEach(([ref, cell]) => { if (/1$/.test(ref)) Object.assign(cell, { bold: true, color: '#ffffff', background: '#287c62', size: 11 }); else if (Number(ref.replace(/[A-Z]+/, '')) % 2 === 0) cell.background = '#f3f8f5'; });
    }
    if (type === 'slides') {
      if (template === 'report') { file.slides[0].bg = '#202e49'; file.slides[0].elements[0].text = '每一步，\n都值得呈现。'; file.slides[0].elements[1].text = 'QUARTERLY REVIEW  /  季度工作汇报'; }
      for (const [i, title, subtitle] of [[1, '看见方向，\n也看见每一步。', '01  /  目标与背景\n\n在这里介绍项目目标、业务背景与关键机会。'], [2, '下一步，\n从现在开始。', '02  /  行动与计划\n\n明确里程碑、交付内容和团队分工。']]) file.slides.push({ id: uid(), bg: i === 1 ? '#f6f4ee' : file.slides[0].bg, notes: '', elements: [{ id: uid(), kind: 'text', x: 8, y: 12, w: 60, h: 32, text: title, size: 38, color: i === 1 ? '#244638' : '#ffffff', bold: true }, { id: uid(), kind: 'text', x: 8, y: 60, w: 78, h: 30, text: subtitle, size: 18, color: i === 1 ? '#718477' : '#b5c6c0' }, { id: uid(), kind: 'shape', shape: 'ellipse', x: 76, y: 14, w: 15, h: 26, color: i === 1 ? '#d9e2c7' : '#4f7562' }] });
    }
  }
  return file;
}
export function validateFile(file) {
  if (!file || !Object.hasOwn(kinds, file.type) || typeof file.name !== 'string') throw new Error('无效的 Tom Office 文件');
  if (file.type === 'doc' && typeof file.html !== 'string') throw new Error('文档内容损坏');
  if (file.type === 'sheet' && (!Array.isArray(file.sheets) || !file.sheets.length || file.sheets.some(s => !s || !s.cells || typeof s.cells !== 'object' || Array.isArray(s.cells) || typeof s.name !== 'string'))) throw new Error('工作簿内容损坏');
  if (file.type === 'sheet' && file.sheets.some(s => Object.values(s.cells).some(c => !c || typeof c !== 'object' || c.value !== undefined && !['string', 'number', 'boolean'].includes(typeof c.value)))) throw new Error('单元格内容损坏');
  if (file.type === 'slides' && (!Array.isArray(file.slides) || !file.slides.length || file.slides.some(s => !s || !/^#[0-9a-f]{6}$/i.test(s.bg) || !Array.isArray(s.elements) || s.elements.some(e => !e || !['text', 'shape', 'image'].includes(e.kind) || !['x', 'y', 'w', 'h'].every(key => typeof e[key] === 'number' && Number.isFinite(e[key])) || e.kind === 'text' && typeof e.text !== 'string' || e.kind === 'image' && !/^data:image\/(png|jpeg|gif|webp);base64,/i.test(e.src))))) throw new Error('演示文稿内容损坏');
  return file;
}
