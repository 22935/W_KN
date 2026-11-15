import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import matter from "gray-matter";
import * as canvas from "../packages/content/canvas.mjs";

test("canvas exposes source-preserving editing operations", () => {
  for (const name of [
    "splitMarkdown",
    "joinBlocks",
    "createBlock",
    "readBlock",
    "editBlock",
    "moveBlock",
    "separateBlocks",
  ])
    assert.equal(typeof canvas[name], "function", name);
});

test("all migrated articles and difficult Markdown survive an untouched canvas byte for byte", async () => {
  const dir = new URL("../src/content/posts/", import.meta.url);
  const sources = await Promise.all(
    (await readdir(dir))
      .filter((f) => f.endsWith(".md"))
      .map((f) => readFile(new URL(f, dir), "utf8")),
  );
  sources.push(...sources.map((source) => matter(source).content));
  sources.push(
    "",
    "\r\n# CRLF\r\n\r\ntext  \r\n",
    "\n\n",
    "[link][id]\n\n[id]: https://example.com\n",
    "<script>alert(1)</script>\n\n| a | b |\n| - | - |\n| 1 | 2 |",
    "```python\nx = '$$'\n\nprint(x)\n```\n\n$$\na^2\n$$\n",
    "~~~js\n```\n~~~\n",
    "## 中文\n\n> 一段引文\n>\n> 下一段\n\n- [x] task\n  - child\n",
  );
  for (const source of sources)
    assert.equal(canvas.joinBlocks(canvas.splitMarkdown(source)), source);
});

test("formula, Mermaid and code remain editable without consuming adjacent content", () => {
  const source =
    "## 模型\n\n$$\nx^2\n$$\n\n```mermaid\nflowchart LR\n A-->B\n```\n\n```python\nx = '$$'\n```\n\n| a | b |\n| - | - |\n| 1 | 2 |\n";
  const blocks = canvas.splitMarkdown(source);
  assert.deepEqual(
    blocks.map((b) => b.type),
    ["heading", "formula", "mermaid", "code", "raw"],
  );
  assert.equal(canvas.readBlock(blocks[1]).text, "x^2");
  const edited = canvas.editBlock(blocks[1], { text: "\\sum_i x_i" });
  assert.equal(edited.id, blocks[1].id);
  assert.match(edited.source, /\$\$\n\\sum_i x_i\n\$\$/);
  assert.equal(
    canvas
      .joinBlocks([blocks[0], edited, ...blocks.slice(2)])
      .includes("x = '$$'"),
    true,
  );
});

test("new components and reordered end-of-file paragraphs keep separate Markdown boundaries", () => {
  const blocks = canvas.splitMarkdown("first\n\nsecond");
  const moved = canvas.moveBlock(blocks, blocks[1].id, blocks[0].id);
  assert.deepEqual(
    canvas
      .splitMarkdown(canvas.joinBlocks(moved))
      .map((b) => canvas.readBlock(b).text),
    ["second", "first"],
  );
  assert.equal(canvas.joinBlocks(blocks), "first\n\nsecond");
  for (const type of [
    "paragraph",
    "heading",
    "formula",
    "code",
    "callout",
    "mermaid",
    "image",
    "raw",
  ])
    assert.equal(canvas.createBlock(type).type, type);
  const code = canvas.editBlock(canvas.createBlock("code"), {
    text: "```\nconsole.log(1)\n```",
    language: "js",
  });
  const reparsed = canvas.splitMarkdown(code.source);
  assert.equal(reparsed.length, 1);
  assert.equal(canvas.readBlock(reparsed[0]).text, "```\nconsole.log(1)\n```");
  assert.equal(canvas.readBlock(reparsed[0]).language, "js");
  const combined = canvas.separateBlocks([
    ...blocks,
    canvas.createBlock("heading"),
  ]);
  assert.equal(canvas.splitMarkdown(canvas.joinBlocks(combined)).length, 3);
});

test("typing newlines at the end of a paragraph does not eat the cursor's new line or accumulate separators", () => {
  const paragraph = canvas.splitMarkdown("原文\n\n下一段")[0];
  const first = canvas.editBlock(paragraph, { text: "原文\n" });
  assert.equal(canvas.readBlock(first).text, "原文\n");
  const second = canvas.editBlock(first, { text: "原文\n下一行\n" });
  assert.equal(canvas.readBlock(second).text, "原文\n下一行\n");
  assert.equal(second.source, "原文\n下一行\n\n\n");
});
