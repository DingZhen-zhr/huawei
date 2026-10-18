// 轻量 Markdown 渲染：段落 / 标题 / 列表 / 表格 / 粗体 / 行内代码
import React from "react";

function inline(text: string, keyPrefix: string): React.ReactNode[] {
  // **bold** 与 `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**"))
      return (
        <strong key={`${keyPrefix}-${i}`} className="font-semibold text-foreground">
          {p.slice(2, -2)}
        </strong>
      );
    if (p.startsWith("`") && p.endsWith("`"))
      return (
        <code key={`${keyPrefix}-${i}`} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">
          {p.slice(1, -1)}
        </code>
      );
    return <React.Fragment key={`${keyPrefix}-${i}`}>{p}</React.Fragment>;
  });
}

export default function Md({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let tblIdx = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 表格
    if (line.trim().startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = lines[i]
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      tblIdx++;
      blocks.push(
        <div key={`tbl-${tblIdx}`} className="my-2 overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="bg-muted/70">
                {rows[0]?.map((c, j) => (
                  <th key={j} className="px-2.5 py-1.5 font-medium">
                    {inline(c, `th-${tblIdx}-${j}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(1).map((r, ri) => (
                <tr key={ri} className="border-t">
                  {r.map((c, ci) => (
                    <td key={ci} className="px-2.5 py-1.5 align-top">
                      {inline(c, `td-${tblIdx}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // 无序列表
    if (/^\s*-\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*-\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="my-1.5 list-disc space-y-1 pl-5">
          {items.map((it, j) => (
            <li key={j}>{inline(it, `li-${i}-${j}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // 有序列表
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="my-1.5 list-decimal space-y-1 pl-5">
          {items.map((it, j) => (
            <li key={j}>{inline(it, `oli-${i}-${j}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // 小标题
    if (line.startsWith("### ")) {
      blocks.push(
        <h4 key={`h-${i}`} className="mt-3 mb-1 font-semibold">
          {inline(line.slice(4), `h-${i}`)}
        </h4>
      );
      i++;
      continue;
    }

    // 空行
    if (!line.trim()) {
      i++;
      continue;
    }

    // 普通段落（合并到下一个空行前）
    const para: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^\s*[-\d]/.test(lines[i]) && !lines[i].trim().startsWith("|") && !lines[i].startsWith("### ")) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={`p-${i}`} className="my-1.5 leading-relaxed">
        {para.map((pl, j) => (
          <React.Fragment key={j}>
            {j > 0 && <br />}
            {inline(pl, `pp-${i}-${j}`)}
          </React.Fragment>
        ))}
      </p>
    );
  }

  return <div className="text-[13.5px] text-foreground/90">{blocks}</div>;
}
