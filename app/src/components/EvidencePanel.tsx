import { useEffect, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText } from "lucide-react";
import { KB_FILES, fetchKbFile, type Evidence } from "@/lib/kb";

export default function EvidencePanel({ fileIds }: { fileIds: string[] }) {
  const [items, setItems] = useState<Evidence[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    (async () => {
      const out: Evidence[] = [];
      for (const id of fileIds) {
        const file = KB_FILES.find((f) => f.id === id);
        if (!file) continue;
        try {
          const text = await fetchKbFile(file.path);
          const lines = text.split("\n");
          const hits = lines.filter((l) =>
            file.keywords.some((k) => l.toLowerCase().includes(k.toLowerCase()))
          );
          const excerpt = (hits.length ? hits : lines.slice(0, 8)).slice(0, 10).join("\n");
          out.push({ file, excerpt, fullText: text });
        } catch (e) {
          out.push({ file, excerpt: `读取失败：${e instanceof Error ? e.message : e}` });
        }
      }
      if (alive) {
        setItems(out);
        setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [fileIds]);

  if (!fileIds.length) return null;

  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <FileText className="h-3.5 w-3.5" />
        知识库证据（点击展开真实文件摘录）
        {!loaded && <span className="text-[11px]">· 读取中…</span>}
      </div>
      <Accordion type="multiple" className="w-full">
        {items.map((ev) => (
          <AccordionItem key={ev.file.id} value={ev.file.id} className="border-b-0">
            <AccordionTrigger className="py-1.5 text-left hover:no-underline">
              <span className="flex flex-wrap items-center gap-1.5 text-[12px]">
                <Badge variant="secondary" className="text-[10.5px] font-normal">
                  {ev.file.board}
                </Badge>
                <span className="font-medium">{ev.file.label}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="mb-1 truncate text-[10.5px] text-muted-foreground">{ev.file.path}</div>
              <ScrollArea className="max-h-44 rounded bg-background/80 p-2">
                <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-foreground/80">
                  {ev.excerpt}
                </pre>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
