// lib/kb-mock.mjs —— 无真实知识库时的占位数据（仅用于界面联调，禁止对外演示参数）
export const KB_META = {
  name: '任德耀新建华为PC知识库',
  mode: 'mock',
  note: '占位数据：接入本地知识库包后自动替换',
};

export const MOCK_MODELS = [
  {
    short: 'MateBook X Pro',
    full: 'HUAWEI MateBook X Pro 2024',
    tier: '旗舰轻薄',
    facts: [
      { key: '重量', value: '约 980g', title: 'X Pro 产品参数卡', tags: ['便携'] },
      { key: '屏幕', value: '14.2 英寸 3.1K OLED 120Hz', title: 'X Pro 屏幕说明', tags: ['屏幕', '创作'] },
      { key: '处理器', value: 'Intel Core Ultra 9', title: 'X Pro 配置表', tags: ['性能'] },
      { key: '电池', value: '70Wh', title: 'X Pro 续航说明', tags: ['续航'] },
      { key: '接口', value: '仅 USB-C（2×雷电 4 + 1×USB-C）', title: 'X Pro 接口说明', tags: ['接口', '办公'] },
    ],
    images: [
      { name: 'X Pro 整机正面·深空灰', position: '首图', caption: '机身正面，用于展示整体质感', kind: '主图' },
      { name: 'X Pro 3.1K OLED 屏幕特写', position: '正文中段', caption: '屏幕色彩表现，对应创作场景', kind: '场景图' },
      { name: 'X Pro 侧边接口特写', position: '卖点段', caption: '仅 USB-C 的接口布局，需提醒扩展坞', kind: '细节图' },
    ],
  },
  {
    short: 'MateBook 14',
    full: 'HUAWEI MateBook 14 2024',
    tier: '主流轻薄',
    facts: [
      { key: '重量', value: '约 1.31kg', title: 'MateBook 14 参数卡', tags: ['便携'] },
      { key: '屏幕', value: '14.2 英寸 2.5K 120Hz', title: 'MateBook 14 屏幕说明', tags: ['屏幕'] },
      { key: '电池', value: '56Wh', title: 'MateBook 14 续航说明', tags: ['续航'] },
      { key: '接口', value: 'USB-C ×1、USB-A ×1、HDMI ×1', title: 'MateBook 14 接口说明', tags: ['接口'] },
      { key: '处理器', value: 'Intel Core Ultra 5', title: 'MateBook 14 配置表', tags: ['性能'] },
    ],
    images: [
      { name: 'MateBook 14 整机·皓月银', position: '首图', caption: '整机外观，对应主流价位段', kind: '主图' },
      { name: 'MateBook 14 键盘与触控板', position: '正文中段', caption: '日常办公输入体验', kind: '场景图' },
      { name: 'MateBook 14 接口一侧', position: '卖点段', caption: '保留 USB-A 与 HDMI，接线更省事', kind: '细节图' },
    ],
  },
  {
    short: 'MateBook D 16',
    full: 'HUAWEI MateBook D 16 2024',
    tier: '大屏办公',
    facts: [
      { key: '重量', value: '约 1.68kg', title: 'D 16 参数卡', tags: ['便携'] },
      { key: '屏幕', value: '16 英寸 1920×1200', title: 'D 16 屏幕说明', tags: ['屏幕'] },
      { key: '键盘', value: '含独立数字小键盘', title: 'D 16 键盘说明', tags: ['办公'] },
      { key: '电池', value: '65Wh', title: 'D 16 续航说明', tags: ['续航'] },
      { key: '接口', value: 'USB-C ×1、USB-A ×2、HDMI ×1', title: 'D 16 接口说明', tags: ['接口'] },
    ],
    images: [
      { name: 'D 16 整机·16 英寸大屏', position: '首图', caption: '大屏办公定位', kind: '主图' },
      { name: 'D 16 数字小键盘特写', position: '正文中段', caption: '财务/表格场景的核心差异点', kind: '场景图' },
    ],
  },
];
