// Scene selection and copy planning use only the selected model's ledger facts.
const SCENES = {
  'media-import': {
    title: '导卡外接，先核对', focus: '导卡与硬盘同时连接',
    order: ['ports', 'memory', 'screen'],
    pattern: /导卡|导入素材|(?:SD\s*卡|移动硬盘|硬盘|相机).{0,24}(?:导入|连接|插入|一起插|插上|接入|接到|接上|同时接)|(?:连接|接入|插上|接|导入).{0,12}(?:SD\s*卡|移动硬盘|硬盘|相机)/i,
    actions: ['出示实际使用的SD卡和移动硬盘，核对接口与转接需求', '连接读卡设备与移动硬盘，检查设备识别状态', '打开素材目录，核对文件和所选存储配置'],
    request: '卡的类型、硬盘接口和素材容量',
  },
  commute: {
    title: '通勤携带先试背包', focus: '通勤携带负担',
    order: ['portable', 'screen', 'ports'],
    pattern: /通勤|地铁|肩膀|肩酸|背包|背电脑|背着|装包|出差|咖啡店|携带|背去/,
    actions: ['把电脑装入日常背包再拿取，连同充电器体验携带负担', '对照官方重量口径与现在的电脑，记录携带取舍', '打开实际脚本文档，核对阅读和编辑需求'],
    request: '现在的电脑重量、背包和常用脚本文档',
  },
  'study-documents': {
    title: '论文课堂，逐项试', focus: '论文文档与课堂连接',
    order: ['screen', 'ports', 'portable'],
    pattern: /论文|PPT|教室|课堂|投影|上课|文档|图书馆/i,
    actions: ['打开自己的论文或PPT，检查阅读和排版', '带上课堂投影线，核对接口并实际连接', '列出常用软件与版本，核对兼容后再装包'],
    request: '论文或PPT样例、软件版本和投影接口',
  },
  multitask: {
    title: '项目工作集，先试', focus: '项目工作集与配置核对',
    order: ['memory', 'ports', 'screen'],
    pattern: /多任务|同时打开|多个软件|多软件|工作集|项目|剪视频|剪辑|内存|存储/,
    actions: ['列出同时使用的软件版本、项目文件和素材容量', '按实际SKU核对内存和存储，打开自己的真实项目', '记录软件兼容、响应与外设识别的待核验项'],
    request: '软件版本、真实项目和素材容量',
  },
  general: {
    title: '带实际任务来核对', focus: '待核对的实际任务', order: ['screen', 'portable', 'ports', 'memory'],
    actions: ['说明最常做的任务和遇到的阻碍', '带常用文件与外设，逐项核对实际操作', '记录尚未确认的软件、配置与连接条件'],
    request: '常用文件、软件版本和外设清单',
  },
};

function affirmative(text) {
  return String(text || '').split(/[，,。；;！!？?\n]|但是|而是|主要|只(?:是|需|要)?|但/)
    .map((part) => part.replace(/(?:不|无需|无须|没有).*$/, ''))
    .join('，');
}

function detect(text, topic = false) {
  const positive = affirmative(text);
  return Object.entries(SCENES).filter(([key, config]) => config.pattern?.test(positive) || (topic && key === 'media-import' && /整理素材/.test(positive))).map(([key]) => key);
}

function groupFacts(product, category) {
  const facts = (product.facts || []).filter((f) => f.productId === product.id && f.status === 'active' && f.field !== 'price');
  const patterns = {
    ports: /USB|HDMI|SD卡|雷电|接口/,
    portable: /kg|重量|厚度|尺寸|轻至|约\s*\d+\s*g\b/i,
    memory: /内存|SSD|存储/,
    screen: /英寸|OLED|分辨率/,
  };
  return facts.filter((f) => patterns[category].test(String(f.value)))
    .sort((a, b) => {
      const preferred = (f) => category === 'memory' ? Number(f.field === 'performance') : category === 'screen' ? Number(f.field === 'screen') : category === 'ports' ? Number(/SD卡/.test(f.value)) * 2 + Number(/USB/.test(f.value)) : Number(/kg|重量/.test(f.value));
      return preferred(b) - preferred(a);
    });
}

export function resolveScene({ product, audience = '', scene = '', realDetail = '', target = '' }) {
  const detail = typeof realDetail === 'object' ? realDetail?.text || '' : String(realDetail || '');
  const detailMatches = detect(detail);
  const deniedKeys = Object.entries(SCENES).filter(([key, config]) => config.pattern?.test(detail) && !detailMatches.includes(key)).map(([key]) => key);
  const topicMatches = detect(scene, true).filter((key) => !deniedKeys.includes(key));
  // A concrete burden or operation outranks a broad topic or audience label.
  const scriptOnly = /(?:^|[，,。；;])只[^，,。；;]{0,20}(?:改|写|编辑)[^，,。；;]{0,8}脚本/.test(detail);
  const detailPriority = detailMatches.includes('commute') && scriptOnly ? 'commute' : detailMatches[0];
  const key = detailPriority || topicMatches[0] || 'general';
  const config = SCENES[key];
  const evidence = [];
  for (const category of config.order) {
    const found = groupFacts(product, category);
    const limit = category === 'memory' ? 2 : 1;
    for (const fact of found.slice(0, limit)) if (!evidence.some((f) => f.id === fact.id)) evidence.push(fact);
  }
  if (!evidence.length) evidence.push(...(product.facts || []).filter((f) => f.productId === product.id && f.status === 'active' && f.field !== 'price').slice(0, 3));
  const conflict = detailPriority && topicMatches.length && detailPriority !== topicMatches[0];
  return {
    key, ...config, evidence, evidenceIds: evidence.map((f) => f.id),
    matchedSignals: [...new Set([...detailMatches, ...topicMatches])],
    explanation: conflict ? `真实细节中的${config.focus}优先于原选题；这里先按实际动作核对，选题是否调整可再确认。` : key === 'general' ? '当前缺少明确的肯定任务，原选题与实际用途待确认；先带常用文件逐项核对。' : `按${config.focus}组织核对；参数只引用当前型号资料，操作结果尚待现场验证。`,
    detail, audience, target,
  };
}

function angleEvidence(strategy, angle) {
  const facts = [...strategy.evidence];
  if (angle === 'avoidance' && facts.length > 2) return [facts[0], ...facts.slice(2), facts[1]];
  if (angle === 'story' && facts.length > 1) return [...facts.slice(1), facts[0]];
  return facts;
}

function angleActions(strategy, angle) {
  const [first, second, third] = strategy.actions;
  if (angle === 'avoidance') return [`先列核对清单：${third}`, `逐项检查：${first}`, `实际验证后记录结果：${second}`];
  if (angle === 'story') return [`顾客先说明任务并准备：${first}`, `销售陪同完成：${third}`, `一起复核并记录：${second}`];
  return [`先展示实际阻碍：${first}`, `按任务演示：${second}`, `记录是否符合需要：${third}`];
}

function sceneCta(strategy, angle) {
  const request = strategy.request;
  const next = angle === 'avoidance' ? `先列好${request}，逐项核对后再选。` : angle === 'story' ? `把${request}和操作中的疑问一起带来，接着核对。` : `准备好${request}，先验证最困扰你的动作。`;
  if (/私聊/.test(strategy.target)) return `${next}私聊发来清单，再按实际SKU确认配置。`;
  if (/收藏/.test(strategy.target)) return `${next}先收藏这份核对顺序。`;
  return `${next}到店用自己的任务试一遍。`;
}

function posterFacts(evidence, strategy) {
  const pattern = strategy.key === 'commute' ? /kg|重量|英寸/ : strategy.key === 'media-import' ? /SD卡|内存|SSD|存储/ : strategy.key === 'study-documents' ? /英寸|HDMI|USB/ : /内存|SSD|英寸|kg/;
  return evidence.map((fact) => {
    // Extract a complete ledger clause, keeping all qualifiers in that clause.
    const parts = String(fact.value).split(/[，。；;]/).filter(Boolean);
    return parts.find((part) => pattern.test(part)) || parts[0];
  });
}

/** Keep the existing channel shape, while replacing claims with scene-ordered ledger evidence. */
export function applySceneStrategy(draft, { product, platform, angle, strategy }) {
  const evidence = angleEvidence(strategy, angle);
  const actions = angleActions(strategy, angle);
  const cta = sceneCta(strategy, angle);
  const titles = { pain: strategy.title, avoidance: `${strategy.focus}核对清单`, story: `${strategy.focus}的一次核对` };
  const title = titles[angle];
  const context = `销售提供的真实细节：${strategy.detail || '尚未提供具体任务，先列待核对项'}。`;
  const facts = evidence.map((fact) => String(fact.value));
  const limits = '具体SKU、软件版本与兼容性需确认；现场操作是核对步骤，未实测前不承诺性能或识别结果。';
  const price = product.price?.status === 'conflict' ? '价格字段存在冲突，冻结具体价格，待门店核对。' : '配置与价格以门店实际确认为准。';
  const reasoning = angle === 'pain'
    ? `先处理${strategy.focus}带来的阻碍，再按以下资料与操作逐项验证。`
    : angle === 'avoidance' ? `选购前先列${strategy.focus}清单：所需条件、现有设备和待核对项分开记录。`
      : `按这次${strategy.focus}的动作顺序走一遍；以下是待执行的核对，不是已发生的体验或成交故事。`;
  let body = [context, strategy.explanation, reasoning, ...facts, ...actions, limits, price, cta].join('\n\n');
  if (platform === 'moments') {
    // The compact channel quotes one complete fact, never truncating a condition or number.
    const visibleIndex = { pain: 0, avoidance: 1, story: 2 }[angle];
    const visibleFact = strategy.evidence[Math.min(visibleIndex, strategy.evidence.length - 1)];
    const factNote = strategy.evidence.length < 3 ? '现有可引用事实不足以分开三个证据角度，其余条件待确认。' : '';
    body = [title, visibleFact?.value, actions[0], strategy.explanation.includes('优先于原选题') ? strategy.explanation : '操作与软件兼容需实测确认。', factNote, cta].filter(Boolean).join('\n');
  }
  if (platform === 'wechat-mp') {
    body = [
      `一、这次要解决的动作\n\n${context}\n\n${strategy.explanation}\n\n${reasoning}`,
      `二、按任务顺序核对同型号资料\n\n${facts.join('\n\n')}\n\n这里的数值是官方资料口径，不等于已经验证了顾客的项目或软件。先把常用文件、设备和操作步骤写下来，再决定哪些条件必须满足；缺少的信息记为待确认。`,
      `三、带上自己的任务逐项试\n\n${actions.join('\n\n')}\n\n每一步都记录实际使用的SKU、软件版本、线材与外设；遇到无法确认的条件先保留疑问，不用人群标签代替测试。\n\n核对前可以先整理一张任务清单：文件放在哪里，开始工作要接哪些设备，哪些步骤现在最费时间。到店后用同一份文件重复这些动作，记录是否完成、还差什么条件，不把单次演示直接写成长期体验。\n\n如果需要比较配置，把同一个任务和同一组设备带到不同配置上再看。软件能否打开、外设能否识别，都以实际环境的结果为准；遇到尚未安装或无法演示的环节，留下明确的待确认项。\n\n如果这次主要想解决携带或阅读问题，也可以先用自己的背包与文档观察一遍。参数提供比较依据，实际取舍由常用任务决定，不凭一个数字替顾客下结论。\n\n${limits}\n\n${price}\n\n${cta}`,
      '产品信息来自同型号事实账本；本文由AI辅助整理，操作结果须现场核对。',
    ].join('\n\n');
  }
  if (platform === 'poster') {
    const lines = [];
    const priceNote = product.price?.status === 'conflict' ? '价格待确认' : '配置价格到店确认';
    for (const line of posterFacts(evidence, strategy)) {
      if (lines.length < 2 && [...[...lines, line, priceNote].join('\n')].length <= 60) lines.push(line);
    }
    body = [...lines, priceNote].join('\n');
  }
  const result = {
    ...draft,
    title: platform === 'moments' ? '' : platform === 'poster' || platform === 'video' ? [...title].slice(0, 12).join('') : title,
    body, cta, evidence,
    limitations: [limits, price],
    sceneStrategy: { key: strategy.key, matchedSignals: strategy.matchedSignals, explanation: strategy.explanation, actions },
  };
  if (platform === 'wechat-mp') result.summary = `围绕${strategy.focus}，按同型号资料和实际任务核对配置。`;
  if (platform === 'video') {
    result.shotList = [
      `第一幕：${actions[0]}（出示实际设备与任务）`,
      `第二幕：${actions[1]}；字幕引用：${facts[0] || '资料缺失，待确认'}`,
      `第三幕：${actions[2]}；字幕引用：${facts[1] || '按实际SKU核对'}`,
      `第四幕：镜头回到任务清单，标记兼容与识别待确认项，${cta}`,
    ];
    result.script = [
      `0–3 秒：${strategy.title}。${context}`,
      `3–18 秒：${actions[0]}。${facts[0] || '资料缺失，待确认'}`,
      `18–35 秒：${actions[1]}。${facts.slice(1).join(' ')}`,
      `35–48 秒：${actions[2]}。${strategy.explanation}${limits}`,
      `48–60 秒：${price}${cta}`,
    ].join('\n');
    result.body = result.script;
  }
  return result;
}
