// 去 AI 味检查：只指出问题句和替换方向，不静默改原意。
const PATTERNS = [
  { re: /不是[^。！？\n]{0,30}而是/g, type: "AI 对比句", suggestion: "直接说后半句，别先否定再反转" },
  { re: /^[^\n。！？]{1,12}[，,]\s*是[^\n。！？]{0,24}(的)?[。！？]?$/gm, type: "金句式定义", suggestion: "标题先说清型号、数字或动作，不写“A，是B”" },
  { re: /真正[^。！？\n]{0,20}的是/g, type: "AI 对比句", suggestion: "把要说的那件事直接讲出来" },
  { re: /与其说[^。！？\n]{0,30}不如说/g, type: "AI 对比句", suggestion: "直接说结论，不要绕" },
  { re: /说到底|说白了|值得注意的是|更重要的是|更关键的是/g, type: "AI 口头禅", suggestion: "删掉，直接进入下一句" },
  { re: /不仅[^。！？\n]{0,24}还/g, type: "AI 排比", suggestion: "拆成两句具体的话" },
  { re: /既[^。！？\n]{0,16}又/g, type: "AI 排比", suggestion: "写两件具体的事，不用对仗" },
  { re: /先说结论|综上所述|总的来说/g, type: "AI 开头/收尾", suggestion: "直接说事，别先总结" },
  { re: /在这个[^。！？\n]{0,24}的时代/g, type: "AI 套话", suggestion: "从顾客现在做的事写起" },
  { re: /真正/g, type: "AI 强调", suggestion: "删掉“真正”，直接说事" },
  { re: /他说|她说|他问|她问|我递|临走|走的时候|笑了笑|拎着没说话/g, type: "疑似补了对白/动作", suggestion: "只写已知细节，别补顾客说过或做过什么" },
  { re: /这意味着|换句话说|某种程度上|不难看出/g, type: "AI 解释腔", suggestion: "删掉，直接说下一步" },
  { re: /边界/g, type: "产品黑话", suggestion: "改成“不合适的地方”或具体条件" },
  { re: /赋能/g, type: "空泛动词", suggestion: "换成具体动作，例如“把参数整理成一页给顾客”" },
  { re: /打造/g, type: "营销套话", suggestion: "直接说做了什么，例如“把接口和重量列出来”" },
  { re: /引领/g, type: "营销套话", suggestion: "删掉“引领”，补充可核实的场景" },
  { re: /重新定义/g, type: "营销套话", suggestion: "直接写产品解决的具体问题" },
  { re: /在这个时代/g, type: "套话开头", suggestion: "从顾客正在做的事开头" },
  { re: /无论是[^。！？\n]{0,28}还是/g, type: "过度对仗", suggestion: "拆成两句话说清楚" },
  { re: /首先[，,]/g, type: "三段式", suggestion: "删掉“首先”，直接进入内容" },
  { re: /其次[，,]/g, type: "三段式", suggestion: "删掉“其次”，按真实顺序写" },
  { re: /最后[，,]/g, type: "三段式", suggestion: "用具体动作收尾，不用“最后”" },
  { re: /综上所述/g, type: "公文腔", suggestion: "改成一句门店里会说的话" },
  { re: /值得一提/g, type: "公文腔", suggestion: "删掉，直接说值得看的点" },
  { re: /一站式/g, type: "空泛承诺", suggestion: "列出具体能做的事" },
  { re: /全方位/g, type: "空泛承诺", suggestion: "说明具体覆盖了什么" },
  { re: /生态闭环/g, type: "行业黑话", suggestion: "换成顾客听得懂的设备协同场景" },
  { re: /全新体验/g, type: "空泛承诺", suggestion: "描述一个可感知的动作或细节" },
  { re: /焕新/g, type: "营销套话", suggestion: "直接说换了什么、为什么换" },
  { re: /解锁/g, type: "营销套话", suggestion: "直接说怎么用" },
  { re: /轻松搞定/g, type: "空泛承诺", suggestion: "写清楚步骤或限制" },
];

function sentenceAround(text, index, length) {
  const before = text.lastIndexOf("。", index - 1);
  const before2 = text.lastIndexOf("\n", index - 1);
  const start = Math.max(0, before, before2) + 1;
  const afterCandidates = [text.indexOf("。", index + length), text.indexOf("\n", index + length)].filter((i) => i >= 0);
  const end = afterCandidates.length ? Math.min(...afterCandidates) : Math.min(text.length, index + length + 60);
  return text.slice(start, end).trim();
}

export function analyzeCopy(text) {
  const t = String(text || "");
  const issues = [];
  for (const pattern of PATTERNS) {
    for (const match of t.matchAll(pattern.re)) {
      issues.push({
        type: pattern.type,
        term: match[0],
        sentence: sentenceAround(t, match.index || 0, match[0].length),
        suggestion: pattern.suggestion,
      });
    }
  }
  const emoji = (t.match(/\p{Extended_Pictographic}/gu) || []).length;
  if (emoji > 3) {
    issues.push({
      type: "emoji 过多",
      term: `${emoji} 个 emoji`,
      sentence: "整篇",
      suggestion: "删到 1–3 个，只保留真正有语气作用的那几个",
    });
  }
  const exclamations = (t.match(/[！!]/g) || []).length;
  if (exclamations > 3) {
    issues.push({
      type: "感叹号过多",
      term: `${exclamations} 个感叹号`,
      sentence: "整篇",
      suggestion: "保留最多 1–2 个，其余改成句号",
    });
  }
  return {
    issues,
    counts: { characters: [...t].length, emoji, exclamations },
    summary: issues.length ? `${issues.length} 处需要人工看` : "没有明显 AI 腔",
  };
}

export function humanizeLocally(text) {
  let out = String(text || "");
  const replacements = [
    [/赋能/g, "帮"],
    [/打造/g, "整理成"],
    [/引领/g, "带来"],
    [/重新定义/g, "换一种做法"],
    [/在这个时代/g, "现在"],
    [/首先[，,]/g, ""],
    [/其次[，,]/g, ""],
    [/最后[，,]/g, ""],
    [/综上所述/g, "总的来说"],
    [/值得一提/g, ""],
    [/一站式/g, "一套"],
    [/全方位/g, "从几个方面"],
    [/生态闭环/g, "设备协同"],
    [/全新体验/g, "新的用法"],
    [/焕新/g, "换新"],
    [/解锁/g, "使用"],
    [/轻松搞定/g, "可以完成"],
    [/说到底[，,]?/g, ""],
    [/说白了[，,]?/g, ""],
    [/值得注意的是[，,]?/g, ""],
    [/更重要的是[，,]?/g, ""],
    [/先说结论[：:，,]?/g, ""],
    [/换句话说[，,]?/g, ""],
    [/这意味着/g, "也就是说"],
    [/某种程度上[，,]?/g, ""],
  ];
  for (const [re, value] of replacements) out = out.replace(re, value);
  out = out.replace(/[！!]{2,}/g, "！").replace(/\n{3,}/g, "\n\n").trim();
  return out;
}
