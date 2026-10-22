const USES = {
  edit: ["剪视频", "剪辑", "设计", "修图", "视频"],
  study: ["网课", "上课", "学习", "学生", "考研"],
  office: ["办公", "文档", "会议", "出差", "通勤", "上班"],
  dev: ["编程", "代码", "开发"], game: ["玩游戏", "游戏"],
};

function budgetIn(text) {
  const range = text.match(/(\d{3,5})\s*[-–—~至到]\s*(\d{3,5})/);
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2);
  const direct = text.match(/(?:预算|价格|最多|不超过)[^\d]{0,6}(\d{3,5})|(\d{3,5})\s*(?:元|块|左右|以内|以上|\+)/);
  if (direct) return Number(direct[1] || direct[2]);
  const thousands = text.match(/(\d(?:\.\d+)?)\s*[千kK]/);
  return thousands ? Math.round(Number(thousands[1]) * 1000) : null;
}

function mentions(text) {
  const pattern = new RegExp(Object.values(USES).flat().sort((a, b) => b.length - a.length).join("|"), "g");
  return [...text.matchAll(pattern)].map((match) => {
    const prefix = text.slice(0, match.index).split(/[，,。；;！!?？但而]/).at(-1);
    const negative = /(?:不(?:再|需要|用|会|想|做|玩)?|无需|不用|取消|不打算)[^，,。；;！!?？但而]{0,5}$/.test(prefix);
    return { label: match[0], key: Object.keys(USES).find((kind) => USES[kind].includes(match[0])), negative };
  });
}

export function extractSlots(messages) {
  let budget = null, segment = null, os = null, screenMin = null, screenMax = null;
  let uses = new Map();
  for (const message of messages) {
    if (message?.role !== "user") continue;
    const text = String(message.content || "");
    const nextBudget = budgetIn(text);
    if (nextBudget !== null) budget = nextBudget;
    const turnMentions = mentions(text);
    for (const mention of turnMentions) {
      if (mention.negative) {
        for (const [label] of uses) {
          if (label === mention.label || (/(?:视频|剪辑)/.test(label) && /(?:视频|剪辑)/.test(mention.label)) || (/游戏/.test(label) && /游戏/.test(mention.label))) uses.delete(label);
        }
      } else uses.set(mention.label, mention.key);
    }
    const positives = turnMentions.filter((mention) => !mention.negative && uses.has(mention.label));
    if (positives.length) uses = new Map([...positives.map(({ label, key }) => [label, key]), ...uses]);
    const audience = text.match(/大学生|研究生|学生|考研|家长|孩子|爸妈|家庭|职场|上班族|创作者/);
    if (audience) segment = /学生|考研/.test(audience[0]) ? "学生" : /家长|孩子|爸妈|家庭/.test(audience[0]) ? "家庭" : /创作者/.test(audience[0]) ? "创作者" : "职场";
    for (const match of text.matchAll(/Windows/gi)) {
      const prefix = text.slice(0, match.index).split(/[，,。；;但]/).at(-1);
      os = /不(?:再|需要|用|要求|想要)?[^，,。；;]{0,3}$|无需$/.test(prefix) ? null : "Windows";
    }
    const size = text.match(/(\d{1,2}(?:\.\d+)?)\s*(?:英寸|寸)\s*(以内|以下|左右|级别|以上)?/);
    if (size) {
      const value = Number(size[1]);
      if (/以内|以下/.test(size[2] || "") || /不超过|最多/.test(text.slice(Math.max(0, size.index - 5), size.index))) {
        screenMin = null; screenMax = value;
      } else if (size[2] === "以上") {
        screenMin = value; screenMax = null;
      } else if (/左右|级别/.test(size[2] || "")) {
        screenMin = value; screenMax = value + 0.9;
      } else { screenMin = value; screenMax = value; }
    }
  }
  const scenario = [...uses].map(([label, key]) => ({ label, key }))[0] || null;
  return { budget, scenario: scenario?.label || null, scenarioKey: scenario?.key || null, segment, os, screenMin, screenMax };
}
