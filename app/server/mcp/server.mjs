#!/usr/bin/env node
// 最小可用 MCP Server（stdio / JSON-RPC 2.0 / 零依赖）
// 用法：node server/mcp/server.mjs
// 能力：platform_list / platform_get_spec / platform_adapt / platform_review / platform_publish / platform_collect
import readline from "node:readline";
import { listPlatforms, getSpec, adapt, review, publish, collect } from "./core.mjs";

const PROTOCOL_VERSIONS = ["2024-11-05", "2025-03-26", "2025-06-18"];
const SERVER_INFO = { name: "huawei-store-platform-adapter", version: "0.1.0" };

const TOOLS = [
  {
    name: "platform_list",
    description: "列出已接入的平台适配器及其发布能力（MANUAL / DRAFT_ONLY / RENDER_ONLY / FULL_API）",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "platform_get_spec",
    description: "读取平台规则卡：字数、标签、图片比例、极限词、必备声明、文风。文案生成与合规审核共用同一份规则。",
    inputSchema: {
      type: "object",
      properties: { platform: { type: "string", description: "xiaohongshu | wechat-mp | moments | poster" } },
      required: ["platform"],
      additionalProperties: false,
    },
  },
  {
    name: "platform_adapt",
    description: "把平台无关的 ContentPackage 适配为可发布草稿（确定性变换，不调用 LLM）",
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string" },
        package: {
          type: "object",
          description: "ContentPackage：{ id, brief, audience, evidence[], variants[{platform,title,body,tags[],images[],cta}] }",
        },
      },
      required: ["platform", "package"],
      additionalProperties: false,
    },
  },
  {
    name: "platform_review",
    description: "按平台规则卡审核草稿，返回可定位的 Issue 列表与 pass / pass_with_warnings / revise 结论",
    inputSchema: {
      type: "object",
      properties: { draft: { type: "object", description: "platform_adapt 的输出" } },
      required: ["draft"],
      additionalProperties: false,
    },
  },
  {
    name: "platform_publish",
    description: "生成发布交接包（copyText / 图片规格 / 来源码 / 人工步骤）。演示环境不向真实平台发起写操作。",
    inputSchema: {
      type: "object",
      properties: {
        draft: { type: "object" },
        mode: { type: "string", enum: ["handoff", "api"], description: "默认 handoff" },
      },
      required: ["draft"],
      additionalProperties: false,
    },
  },
  {
    name: "platform_collect",
    description: "回填曝光/到店/咨询/成交，按主题计算归因率与内容权重建议（反馈闭环）",
    inputSchema: {
      type: "object",
      properties: {
        posts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              postId: { type: "string" },
              platform: { type: "string" },
              topic: { type: "string" },
              views: { type: "number" },
              leads: { type: "number" },
              consults: { type: "number" },
              deals: { type: "number" },
            },
          },
        },
        baseline: { type: "object", description: "{ topic: 旧权重 }" },
      },
      required: ["posts"],
      additionalProperties: false,
    },
  },
];

function callTool(name, args = {}) {
  switch (name) {
    case "platform_list":
      return listPlatforms();
    case "platform_get_spec":
      return getSpec(args.platform);
    case "platform_adapt": {
      const draft = adapt(args.package, args.platform);
      return { draft, review: review(draft) };
    }
    case "platform_review":
      return review(args.draft);
    case "platform_publish":
      return publish(args.draft, { mode: args.mode || "handoff" });
    case "platform_collect":
      return collect({ posts: args.posts, baseline: args.baseline });
    default:
      throw new Error(`未知工具：${name}`);
  }
}

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}
const ok = (id, result) => send({ jsonrpc: "2.0", id, result });
const fail = (id, code, message, data) => send({ jsonrpc: "2.0", id, error: { code, message, ...(data ? { data } : {}) } });

function handle(msg) {
  const { id, method, params } = msg || {};
  const isNotification = id === undefined || id === null;

  try {
    switch (method) {
      case "initialize": {
        const requested = params?.protocolVersion;
        const version = PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS.at(-1);
        return ok(id, {
          protocolVersion: version,
          capabilities: { tools: { listChanged: false }, resources: {}, prompts: {} },
          serverInfo: SERVER_INFO,
          instructions:
            "华为门店平台适配 MCP。先用 platform_get_spec 取规则卡，再用 platform_adapt 生成草稿并立即 platform_review；不通过就改文案重审，最多 2 轮。",
        });
      }
      case "notifications/initialized":
      case "notifications/cancelled":
        return;
      case "ping":
        return ok(id, {});
      case "tools/list":
        return ok(id, { tools: TOOLS });
      case "tools/call": {
        const name = params?.name;
        const args = params?.arguments || {};
        if (!TOOLS.some((t) => t.name === name)) return fail(id, -32602, `未知工具：${name}`);
        try {
          const result = callTool(name, args);
          return ok(id, {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            structuredContent: result,
            isError: false,
          });
        } catch (e) {
          return ok(id, { content: [{ type: "text", text: `执行失败：${e.message}` }], isError: true });
        }
      }
      case "resources/list":
        return ok(id, { resources: [] });
      case "prompts/list":
        return ok(id, { prompts: [] });
      default:
        if (isNotification) return;
        return fail(id, -32601, `未实现的方法：${method}`);
    }
  } catch (e) {
    if (!isNotification) fail(id, -32603, e.message);
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  const text = line.trim();
  if (!text) return;
  let msg;
  try {
    msg = JSON.parse(text);
  } catch {
    return fail(null, -32700, "Parse error");
  }
  if (Array.isArray(msg)) msg.forEach(handle);
  else handle(msg);
});

process.stderr.write(`[mcp] ${SERVER_INFO.name} v${SERVER_INFO.version} ready (stdio)\n`);
