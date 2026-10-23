import { API_BASE_URL } from "./api";

export type Role = "user" | "assistant";

export interface Fact {
  model: string;
  text: string;
  source: string;
}

export interface AskCard {
  id: string;
  model: string;
  shortName: string;
  family?: string;
  priceLabel: string;
  overBy?: number;
  reason: string;
  limitation: string;
  priceStatus: "active" | "conflict" | "reference" | "missing";
  priceKind?: "within" | "over" | "unknown" | "stale" | "conflict";
  screenSize?: number | null;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  facts?: Fact[];
  options?: string[];
  cards?: AskCard[];
  slots?: Record<string, string | number | null>;
  platform?: string;
  issues?: { level: string; rule: string; message: string }[];
  warning?: string;
}

export interface ChatReply {
  reply: string;
  options: string[];
  issues?: { level: string; rule: string; message: string }[];
  facts: Fact[];
  slots: Record<string, string | number | null>;
  cards?: AskCard[];
  warning?: string;
}

export async function sendChat(
  messages: Message[],
  mode: "guide" | "content" = "guide",
  platform?: string,
  deviceId?: string,
): Promise<ChatReply> {
  const res = await fetch(`${API_BASE_URL}/api/ask`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode,
      platform,
      deviceId,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `请求失败 ${res.status}`);
  return data;
}
