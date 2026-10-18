import { Bot, User, Info } from "lucide-react";
import type { ChatMsg } from "@/lib/engine";
import Md from "./Md";
import EvidencePanel from "./EvidencePanel";
import { Button } from "@/components/ui/button";

export default function ChatMessage({
  msg,
  onChip,
}: {
  msg: ChatMsg;
  onChip?: (text: string) => void;
}) {
  const isAgent = msg.role === "agent";
  const isSystem = msg.role === "system";

  return (
    <div className={`flex gap-2.5 ${isAgent || isSystem ? "" : "flex-row-reverse"}`}>
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isSystem
            ? "bg-slate-500/15 text-slate-600"
            : isAgent
              ? "bg-red-700/10 text-red-700"
              : "bg-blue-600/10 text-blue-700"
        }`}
      >
        {isSystem ? <Info className="h-4 w-4" /> : isAgent ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
      </div>
      <div className={`min-w-0 max-w-full flex-1 ${isAgent || isSystem ? "" : "flex flex-col items-end"}`}>
        {msg.title && (
          <div className="mb-1 text-xs font-semibold text-muted-foreground">{msg.title}</div>
        )}
        <div
          className={`rounded-xl px-3.5 py-2.5 shadow-sm ${
            isSystem
              ? "border border-dashed bg-card"
              : isAgent
                ? "border bg-card"
                : "bg-blue-600/[0.06] border border-blue-600/15"
          }`}
        >
          <Md text={msg.body} />
          {msg.evidenceIds && msg.evidenceIds.length > 0 && (
            <div className="mt-2">
              <EvidencePanel fileIds={msg.evidenceIds} />
            </div>
          )}
        </div>
        {msg.chips && onChip && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {msg.chips.map((c) => (
              <Button
                key={c}
                variant="outline"
                size="sm"
                className="h-7 rounded-full text-xs"
                onClick={() => onChip(c)}
              >
                {c}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
