const USES = {
  edit: ["剪视频", "剪辑", "设计", "修图", "视频"],
  study: ["网课", "上课", "学习", "学生", "考研"],
  office: ["办公", "文档", "会议", "出差", "通勤", "上班"],
  dev: ["编程", "代码", "开发"], game: ["玩游戏", "游戏"],
};

const BUDGET_RANGE = String.raw`\d{3,5}\s*[-–—~至到]\s*\d{3,5}`;
const BUDGET_THOUSANDS = String.raw`\d(?:\.\d+)?\s*[千kK]`;
const BUDGET_VALUE = `(?:${BUDGET_RANGE}|${BUDGET_THOUSANDS}|\\d{3,5})`;
const BUDGET_EVENTS = new RegExp([
  String.raw`预算\s*(?:先|暂时|保持|仍然|还)?\s*(?:不变|不改|保持原样)`,
  String.raw`(?:预算|价格|最多|不超过)\s*(?:改为|改成|调整到|提高到|降低到|大概|最多|不超过|为|是)?\s*${BUDGET_VALUE}`,
  String.raw`${BUDGET_VALUE}\s*(?:元|块)?\s*(?:预算|左右|以内|以上|\+|元|块)`,
  BUDGET_RANGE, BUDGET_THOUSANDS,
].join("|"), "g");

function budgetEvents(text) {
  return [...text.matchAll(BUDGET_EVENTS)].map(([token]) => {
    if (/不变|不改|保持原样/.test(token)) return { field: "budget", operation: "hold" };
    const numbers = [...token.matchAll(/\d+(?:\.\d+)?/g)].map(([number]) => Number(number));
    const value = numbers.length === 2 ? Math.round((numbers[0] + numbers[1]) / 2) : /[千kK]/.test(token) ? Math.round(numbers[0] * 1000) : numbers[0];
    return { field: "budget", operation: "set", value, explicit: /预算|价格|最多|不超过/.test(token) };
  });
}

function budgetIn(text) {
  let value = null;
  let held = false;
  for (const event of budgetEvents(text)) {
    if (event.operation === "hold") held = true;
    else if (event.explicit || !held) { value = event.value; held = false; }
  }
  return value;
}

// Scope markers are scanned in order. List conjunctions retain polarity;
// a clause boundary or affirmative contrast opens a new positive scope.
const SCOPE_MARKERS = /不仅|不只|不光|而是|但是|但|只是|只|还|[，,。；;！!?？]|以及|和|或|、|不一定|不强求|非必需|非必须|不必|不打算|不需要|不再|不用|不想|不会|不做|不玩|无需|取消|不/g;
const COORDINATORS = new Set(["和", "或", "以及", "、"]);
const NEGATORS = new Set(["不一定", "不强求", "非必需", "非必须", "不必", "不打算", "不需要", "不再", "不用", "不想", "不会", "不做", "不玩", "无需", "取消", "不"]);

function conditionEvents(text) {
  const pattern = new RegExp([...Object.values(USES).flat(), "Windows"].sort((a, b) => b.length - a.length).join("|"), "gi");
  let previousEnd = 0;
  let negative = false;
  return [...text.matchAll(pattern)].map((match) => {
    const bridge = text.slice(previousEnd, match.index);
    for (const [marker] of bridge.matchAll(SCOPE_MARKERS)) {
      if (COORDINATORS.has(marker)) continue;
      negative = NEGATORS.has(marker);
    }
    previousEnd = match.index + match[0].length;
    return { field: /^Windows$/i.test(match[0]) ? "os" : "use", label: match[0], key: Object.keys(USES).find((kind) => USES[kind].includes(match[0])), negative };
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
    const conditions = conditionEvents(text);
    const turnMentions = conditions.filter((event) => event.field === "use");
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
    for (const event of conditions.filter((event) => event.field === "os")) os = event.negative ? null : "Windows";
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
