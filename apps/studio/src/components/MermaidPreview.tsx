import { useEffect, useRef, useState } from "react";
let serial = 0;
export default function MermaidPreview({ body }: { body: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
          flowchart: { htmlLabels: false },
          suppressErrorRendering: true,
        });
        const result = await mermaid.render(
          `ysdiagram${++serial}`,
          body || "flowchart LR\n A[从一个想法开始]",
        );
        if (active && ref.current) {
          ref.current.innerHTML = result.svg;
          setError("");
        }
      } catch {
        if (active) setError("图解语法尚未完整，请检查节点、箭头和引号。");
      }
    }, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [body]);
  return (
    <div className="diagram-preview">
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      <div ref={ref} />
      <p className="caption">MERMAID · 可编辑的思考路径</p>
    </div>
  );
}
