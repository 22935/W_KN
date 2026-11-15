import { useEffect, useState } from "react";
import { api, errorText } from "../api";
export default function MarkdownPreview({ body }: { body: string }) {
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      api<{ html: string }>("/v1/preview", "POST", { body })
        .then((r) => {
          if (active) {
            setHtml(r.html);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(errorText(e));
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [body]);
  return (
    <div className="preview prose">
      {error ? (
        <p role="alert">预览不可用：{error}</p>
      ) : html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="muted">写下文字，预览会在这里展开。</p>
      )}
    </div>
  );
}
