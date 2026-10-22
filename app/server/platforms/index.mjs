// 由 build-fixtures.mjs 生成，勿手改
export default {
  "moments": {
    "platform": "moments",
    "label": "朋友圈",
    "capability": "MANUAL",
    "capabilityNote": "无开放接口；导出短文案与九宫格图包，人工发布",
    "limits": {
      "titleMin": 0,
      "titleMax": 0,
      "bodyMin": 40,
      "bodyMax": 300,
      "tagsMin": 0,
      "tagsMax": 0,
      "paragraphMaxLines": 2,
      "collapseLines": 6,
      "images": {
        "min": 1,
        "max": 9,
        "ratio": "1:1",
        "allowedCount": [
          1,
          3,
          4,
          6,
          9
        ]
      }
    },
    "banned": [
      "最好",
      "最佳",
      "最强",
      "最低价",
      "最高级",
      "国家级",
      "顶级",
      "绝对",
      "100%",
      "全网最低",
      "史无前例",
      "永久",
      "第一品牌",
      "行业第一",
      "排名第一",
      "销量第一"
    ],
    "bannedReason": "极限词风险",
    "falsePositiveGuards": [
      {
        "word": "100%",
        "allowSuffixes": [
          "sRGB",
          "Adobe RGB",
          "DCI-P3",
          "NTSC"
        ],
        "reason": "色域参数属客观规格，不构成绝对化用语"
      },
      {
        "word": "第一",
        "allowSuffixes": [
          "：",
          "、",
          "，",
          ",",
          "步",
          "点",
          "次",
          "件",
          "个",
          "部分",
          "时间",
          "条",
          "句",
          "段",
          "张",
          "台",
          "款",
          "种",
          "轮",
          "遍",
          "层",
          "块",
          "套",
          "道",
          "关",
          "名",
          "位"
        ],
        "reason": "序数用法，不是绝对化排名"
      },
      {
        "word": "最好",
        "allowSuffixes": [
          "先",
          "还是",
          "别",
          "能",
          "在",
          "提前",
          "把",
          "用",
          "去",
          "问",
          "试",
          "看"
        ],
        "reason": "建议用法，不是绝对化比较"
      }
    ],
    "required": [
      {
        "key": "CONTACT",
        "label": "联系方式/到店引导",
        "hint": "附门店或顾问联系方式"
      }
    ],
    "style": {
      "tone": "朋友口吻、短句",
      "emojiPer100": 1,
      "hashtagStyle": "",
      "titlePattern": "无标题，首句即钩子"
    },
    "checklist": [
      "前 6 行是否把关键信息说完（防折叠）",
      "是否有一张实拍/场景图"
    ]
  },
  "poster": {
    "platform": "poster",
    "label": "门店海报",
    "capability": "RENDER_ONLY",
    "capabilityNote": "本地渲染 HTML→PNG，可打印/门店屏投放",
    "limits": {
      "titleMin": 6,
      "titleMax": 12,
      "bodyMin": 10,
      "bodyMax": 100,
      "tagsMin": 0,
      "tagsMax": 0,
      "paragraphMaxLines": 3,
      "images": {
        "min": 1,
        "max": 1,
        "ratio": "3:4",
        "minWidth": 1242
      }
    },
    "banned": [
      "最好",
      "最佳",
      "最强",
      "最低价",
      "最高级",
      "国家级",
      "顶级",
      "绝对",
      "100%",
      "全网最低",
      "第一品牌",
      "行业第一",
      "排名第一",
      "销量第一"
    ],
    "bannedReason": "极限词风险",
    "falsePositiveGuards": [
      {
        "word": "100%",
        "allowSuffixes": [
          "sRGB",
          "Adobe RGB",
          "DCI-P3",
          "NTSC"
        ],
        "reason": "色域参数属客观规格，不构成绝对化用语"
      },
      {
        "word": "第一",
        "allowSuffixes": [
          "：",
          "、",
          "，",
          ",",
          "步",
          "点",
          "次",
          "件",
          "个",
          "部分",
          "时间",
          "条",
          "句",
          "段",
          "张",
          "台",
          "款",
          "种",
          "轮",
          "遍",
          "层",
          "块",
          "套",
          "道",
          "关",
          "名",
          "位"
        ],
        "reason": "序数用法，不是绝对化排名"
      },
      {
        "word": "最好",
        "allowSuffixes": [
          "先",
          "还是",
          "别",
          "能",
          "在",
          "提前",
          "把",
          "用",
          "去",
          "问",
          "试",
          "看"
        ],
        "reason": "建议用法，不是绝对化比较"
      }
    ],
    "required": [],
    "style": {
      "tone": "短语、数字优先",
      "emojiPer100": 0,
      "hashtagStyle": "",
      "titlePattern": "3 秒可读"
    },
    "checklist": [
      "主标题是否 ≤12 字",
      "价格区是否写『以门店实际报价为准』",
      "是否标注活动期限",
      "是否预留二维码/来源码位",
      "是否 3 秒可读（短语、数字优先）"
    ]
  },
  "video": {
    "platform": "video",
    "label": "视频号",
    "capability": "MANUAL",
    "capabilityNote": "无开放发布接口；导出 45–60 秒口播脚本与分镜，人工拍摄",
    "limits": {
      "titleMin": 6,
      "titleMax": 12,
      "bodyMin": 100,
      "bodyMax": 1600,
      "tagsMin": 0,
      "tagsMax": 0,
      "paragraphMaxLines": 5,
      "images": {
        "min": 1,
        "max": 1,
        "ratio": "9:16",
        "minWidth": 1080
      }
    },
    "banned": [
      "最好",
      "最佳",
      "最强",
      "最低价",
      "最高级",
      "国家级",
      "顶级",
      "绝对",
      "100%",
      "全网最低",
      "史无前例",
      "永久",
      "包治",
      "第一品牌",
      "行业第一",
      "排名第一",
      "销量第一"
    ],
    "bannedReason": "极限词/绝对化用语，违反《广告法》第九条",
    "falsePositiveGuards": [
      {
        "word": "100%",
        "allowSuffixes": [
          "sRGB",
          "Adobe RGB",
          "DCI-P3",
          "NTSC"
        ],
        "reason": "色域参数属客观规格，不构成绝对化用语"
      },
      {
        "word": "第一",
        "allowSuffixes": [
          "：",
          "、",
          "，",
          ",",
          "步",
          "点",
          "次",
          "件",
          "个",
          "部分",
          "时间",
          "条",
          "句",
          "段",
          "张",
          "台",
          "款",
          "种",
          "轮",
          "遍",
          "层",
          "块",
          "套",
          "道",
          "关",
          "名",
          "位"
        ],
        "reason": "序数用法，不是绝对化排名"
      },
      {
        "word": "最好",
        "allowSuffixes": [
          "先",
          "还是",
          "别",
          "能",
          "在",
          "提前",
          "把",
          "用",
          "去",
          "问",
          "试",
          "看"
        ],
        "reason": "建议用法，不是绝对化比较"
      }
    ],
    "required": [
      {
        "key": "DURATION",
        "label": "口播时长",
        "hint": "45–60 秒，首 3 秒给钩子"
      }
    ],
    "style": {
      "tone": "口语、节奏快、像门店同事讲话",
      "emojiPer100": 0.5,
      "hashtagStyle": "",
      "titlePattern": "首 3 秒钩子"
    },
    "checklist": [
      "首 3 秒是否有钩子",
      "是否有 3–5 个分镜",
      "事实、条件、限制是否出现在脚本里",
      "结尾是否自然引导到店或私聊"
    ]
  },
  "wechat-mp": {
    "platform": "wechat-mp",
    "label": "微信公众号",
    "capability": "DRAFT_ONLY",
    "capabilityNote": "官方 API 可写草稿箱并发布，但需已认证账号与 IP 白名单；演示环境不真实调用",
    "limits": {
      "titleMin": 8,
      "titleMax": 64,
      "bodyMin": 800,
      "bodyMax": 3000,
      "tagsMin": 0,
      "tagsMax": 0,
      "paragraphMaxLines": 5,
      "images": {
        "min": 1,
        "max": 20,
        "ratio": "16:9",
        "coverSize": "900x383"
      }
    },
    "banned": [
      "最好",
      "最佳",
      "最强",
      "最低价",
      "最高级",
      "国家级",
      "顶级",
      "绝对",
      "100%",
      "全网最低",
      "史无前例",
      "永久",
      "包治",
      "第一品牌",
      "行业第一",
      "排名第一",
      "销量第一"
    ],
    "bannedReason": "极限词/绝对化用语，违反《广告法》第九条",
    "falsePositiveGuards": [
      {
        "word": "100%",
        "allowSuffixes": [
          "sRGB",
          "Adobe RGB",
          "DCI-P3",
          "NTSC"
        ],
        "reason": "色域参数属客观规格，不构成绝对化用语"
      },
      {
        "word": "第一",
        "allowSuffixes": [
          "：",
          "、",
          "，",
          ",",
          "步",
          "点",
          "次",
          "件",
          "个",
          "部分",
          "时间",
          "条",
          "句",
          "段",
          "张",
          "台",
          "款",
          "种",
          "轮",
          "遍",
          "层",
          "块",
          "套",
          "道",
          "关",
          "名",
          "位"
        ],
        "reason": "序数用法，不是绝对化排名"
      },
      {
        "word": "最好",
        "allowSuffixes": [
          "先",
          "还是",
          "别",
          "能",
          "在",
          "提前",
          "把",
          "用",
          "去",
          "问",
          "试",
          "看"
        ],
        "reason": "建议用法，不是绝对化比较"
      }
    ],
    "required": [
      {
        "key": "SOURCE_NOTE",
        "label": "信息来源标注",
        "hint": "文末注明『信息基准日 2026-10-17，以门店实际报价为准』"
      }
    ],
    "style": {
      "tone": "专业、克制",
      "emojiPer100": 0.3,
      "hashtagStyle": "",
      "titlePattern": "结论前置"
    },
    "checklist": [
      "首图是否 900x383",
      "摘要是否 ≤120 字",
      "价格是否带『以门店实际报价为准』"
    ]
  },
  "xiaohongshu": {
    "platform": "xiaohongshu",
    "label": "小红书",
    "capability": "MANUAL",
    "capabilityNote": "无开放内容发布接口；导出『一键复制包』由运营人工发布",
    "limits": {
      "titleMin": 8,
      "titleMax": 20,
      "bodyMin": 300,
      "bodyMax": 1000,
      "tagsMin": 3,
      "tagsMax": 5,
      "paragraphMaxLines": 3,
      "images": {
        "min": 3,
        "max": 9,
        "ratio": "3:4",
        "minWidth": 1080
      }
    },
    "banned": [
      "最好",
      "最佳",
      "最强",
      "最低价",
      "最高级",
      "国家级",
      "顶级",
      "绝对",
      "100%",
      "全网最低",
      "史无前例",
      "永久",
      "包治",
      "第一品牌",
      "行业第一",
      "排名第一",
      "销量第一"
    ],
    "bannedReason": "极限词/绝对化用语，违反《广告法》第九条",
    "falsePositiveGuards": [
      {
        "word": "100%",
        "allowSuffixes": [
          "sRGB",
          "Adobe RGB",
          "DCI-P3",
          "NTSC"
        ],
        "reason": "色域参数属客观规格，不构成绝对化用语"
      },
      {
        "word": "第一",
        "allowSuffixes": [
          "：",
          "、",
          "，",
          ",",
          "步",
          "点",
          "次",
          "件",
          "个",
          "部分",
          "时间",
          "条",
          "句",
          "段",
          "张",
          "台",
          "款",
          "种",
          "轮",
          "遍",
          "层",
          "块",
          "套",
          "道",
          "关",
          "名",
          "位"
        ],
        "reason": "序数用法，不是绝对化排名"
      },
      {
        "word": "最好",
        "allowSuffixes": [
          "先",
          "还是",
          "别",
          "能",
          "在",
          "提前",
          "把",
          "用",
          "去",
          "问",
          "试",
          "看"
        ],
        "reason": "建议用法，不是绝对化比较"
      }
    ],
    "required": [
      {
        "key": "AI_GENERATED_LABEL",
        "label": "AI 生成内容标识",
        "hint": "#AI生成"
      }
    ],
    "style": {
      "tone": "口语、第一人称",
      "emojiPer100": 1,
      "hashtagStyle": "#话题",
      "titlePattern": "痛点/结果前置"
    },
    "checklist": [
      "标题是否含具体人群或场景",
      "正文是否有一处可验证的事实依据",
      "是否留了到店钩子"
    ]
  }
};
