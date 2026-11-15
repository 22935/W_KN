import { Marked } from "marked";

const formulaPattern =
  /^ {0,3}\$\$[ \t]*\n([\s\S]*?)\n\$\$[ \t]*(?:\n|$)|^ {0,3}\$\$([^\n]+?)\$\$[ \t]*(?:\n|$)/;
const fencePattern = /^ {0,3}(`{3,}|~{3,})([^\n]*)\n/;
const lexer = new Marked({
  extensions: [
    {
      name: "canvasFormula",
      level: "block",
      start: (source) => source.indexOf("$$"),
      tokenizer(source) {
        const match = formulaPattern.exec(source);
        if (match) return { type: "canvasFormula", raw: match[0] };
      },
    },
  ],
});

const block = (type, source) => ({
  id: globalThis.crypto.randomUUID(),
  type,
  source,
});
export const joinBlocks = (blocks) => blocks.map((b) => b.source).join("");

function classify(token) {
  if (token.type === "canvasFormula") return "formula";
  if (token.type === "heading" && /^ {0,3}#{1,6} /.test(token.raw))
    return "heading";
  if (token.type === "code" && fencePattern.test(token.raw)) {
    return token.lang?.trim() === "mermaid" ? "mermaid" : "code";
  }
  if (
    token.type === "blockquote" &&
    /^> (?:\[!NOTE\]|\*\*提示\*\*)\n/.test(token.raw)
  )
    return "callout";
  if (token.type === "paragraph") {
    return /^!\[[^\]\n]*\]\([^\n]+\)\s*$/.test(token.raw)
      ? "image"
      : "paragraph";
  }
  return "raw";
}

/** Lossless by construction: never accept a lexer normalization as source text. */
export function splitMarkdown(source) {
  if (!source) return [];
  try {
    const tokens = lexer.lexer(source);
    const blocks = [];
    for (const token of tokens) {
      if (token.type === "space" && blocks.length)
        blocks.at(-1).source += token.raw;
      else blocks.push(block(classify(token), token.raw));
    }
    if (blocks.length <= 250 && joinBlocks(blocks) === source) return blocks;
  } catch {
    // A raw block remains editable even when the lexer cannot interpret it.
  }
  return [block("raw", source)];
}

export function readBlock(value) {
  if (value.fields) return value.fields;
  const source = value.source;
  if (value.type === "formula") {
    const match = formulaPattern.exec(source);
    return { text: match ? (match[1] ?? match[2]) : source.trimEnd() };
  }
  if (value.type === "code" || value.type === "mermaid") {
    const open = fencePattern.exec(source);
    if (open) {
      const rest = source.slice(open[0].length);
      const close = new RegExp(
        `\\n? {0,3}${open[1][0]}{${open[1].length},}[ \\t]*(?:\\n)*$`,
      );
      return { text: rest.replace(close, ""), language: open[2].trim() };
    }
  }
  if (value.type === "heading") {
    const match =
      /^ {0,3}(#{1,6})[ \t]+([^\n]*?)(?:[ \t]+#+[ \t]*)?(?:\n|$)/.exec(source);
    if (match) return { text: match[2], level: match[1].length };
  }
  if (value.type === "callout")
    return {
      text: source
        .trimEnd()
        .split("\n")
        .slice(1)
        .map((line) => line.replace(/^> ?/, ""))
        .join("\n"),
    };
  return { text: source.replace(/\n+$/, "") };
}

export function editBlock(value, fields) {
  const data = { ...readBlock(value), ...fields };
  const text = String(data.text);
  const suffix = value.separator ?? /\n*$/.exec(value.source)[0];
  let source;
  switch (value.type) {
    case "heading":
      source = `${"#".repeat(Math.max(1, Math.min(6, data.level || 2)))} ${text.replaceAll("\n", " ")}`;
      break;
    case "formula":
      source = `$$\n${text}\n$$`;
      break;
    case "mermaid":
    case "code": {
      const longest = Array.from(text.matchAll(/`+/g)).reduce(
        (max, match) => Math.max(max, match[0].length),
        0,
      );
      const fence = "`".repeat(Math.max(3, longest + 1));
      const language =
        value.type === "mermaid"
          ? "mermaid"
          : String(data.language || "").replace(/[^\w+-]/g, "");
      source = `${fence}${language}\n${text}\n${fence}`;
      break;
    }
    case "callout":
      source = `> **提示**\n${text
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")}`;
      break;
    default:
      source = text;
  }
  return { ...value, source: source + suffix, separator: suffix, fields: data };
}

export function createBlock(type) {
  const sources = {
    paragraph: "\n\n",
    heading: "## 新标题\n\n",
    formula: "$$\nx^2 + y^2 = z^2\n$$\n\n",
    code: "```python\n\n```\n\n",
    callout: "> **提示**\n> \n\n",
    mermaid:
      "```mermaid\nflowchart LR\n  A[提出问题] --> B[建立模型]\n  B --> C[验证理解]\n```\n\n",
    image: "![图片说明]()\n\n",
    raw: "\n\n",
  };
  if (!Object.hasOwn(sources, type)) throw new Error("未知组件类型");
  return block(type, sources[type]);
}

/** Repair only boundaries involved in an edit; no-op switching never calls this. */
export function separateBlocks(blocks) {
  return blocks.map((b, index) => {
    if (index === blocks.length - 1) return b;
    const end = /\n*$/.exec(b.source)[0].length;
    const start = /^\n*/.exec(blocks[index + 1].source)[0].length;
    return end + start < 2
      ? { ...b, source: b.source + "\n".repeat(2 - end - start) }
      : b;
  });
}

export function moveBlock(blocks, activeId, overId) {
  const from = blocks.findIndex((b) => b.id === activeId);
  const to = blocks.findIndex((b) => b.id === overId);
  if (from < 0 || to < 0 || from === to) return blocks;
  const moved = blocks.slice();
  moved.splice(to, 0, moved.splice(from, 1)[0]);
  return separateBlocks(moved);
}
