import { Marked } from "marked";
import { randomUUID } from "node:crypto";
import katex from "katex";
import { renderMarkdown } from "../../studio/lib/content.mjs";
export function renderPreview(body) {
  const formulas = [];
  const prefix = `YS${randomUUID().replaceAll("-", "")}FORMULA`;
  const render = (source, displayMode) => {
    const id = formulas.length;
    formulas.push(
      katex.renderToString(source, {
        throwOnError: false,
        displayMode,
        trust: false,
        strict: "ignore",
      }),
    );
    return `${prefix}${id}END`;
  };
  const marked = new Marked({
    async: false,
    extensions: [
      {
        name: "mathBlock",
        level: "block",
        start: (src) => src.indexOf("$$"),
        tokenizer(src) {
          const match = /^\$\$\s*\n?([\s\S]+?)\n?\$\$(?:\n|$)/.exec(src);
          if (match)
            return { type: "mathBlock", raw: match[0], text: match[1] };
        },
        renderer(token) {
          return `<div>${render(token.text, true)}</div>`;
        },
      },
      {
        name: "mathInline",
        level: "inline",
        start: (src) => src.indexOf("$"),
        tokenizer(src) {
          const match = /^\$([^\n$]+?)\$/.exec(src);
          if (match)
            return { type: "mathInline", raw: match[0], text: match[1] };
        },
        renderer(token) {
          return render(token.text, false);
        },
      },
    ],
  });
  const clean = renderMarkdown(marked.parse(String(body || "")));
  return clean.replace(
    new RegExp(`${prefix}(\\d+)END`, "g"),
    (_match, index) => formulas[Number(index)],
  );
}
