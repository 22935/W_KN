import { lazy, Suspense, useMemo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowUp,
  ArrowDown,
  GripVertical,
  Copy,
  Trash2,
  Type,
  Heading2,
  Sigma,
  Code2,
  Quote,
  Network,
  Image,
  FileCode2,
} from "lucide-react";
import katex from "katex";
import {
  readBlock,
  type CanvasBlock,
  type CanvasBlockType,
  type BlockFields,
} from "@yanshan/content/canvas";
import MarkdownPreview from "./MarkdownPreview";
const MermaidPreview = lazy(() => import("./MermaidPreview"));
export const palette = [
  ["paragraph", "段落", Type],
  ["heading", "标题", Heading2],
  ["formula", "公式", Sigma],
  ["code", "代码", Code2],
  ["callout", "提示卡", Quote],
  ["mermaid", "Mermaid", Network],
  ["image", "图片", Image],
  ["raw", "原始 Markdown", FileCode2],
] as const;
const labels = Object.fromEntries(
  palette.map(([type, label]) => [type, label]),
);
const fieldLabels: Record<CanvasBlockType, string> = {
  paragraph: "段落内容",
  heading: "标题内容",
  formula: "公式 LaTeX",
  code: "代码内容",
  callout: "提示卡内容",
  mermaid: "Mermaid 源码",
  image: "图片 Markdown",
  raw: "原始 Markdown 内容",
};

function Formula({ text }: { text: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(text, {
        displayMode: true,
        throwOnError: true,
        trust: false,
        maxExpand: 1000,
      });
    } catch {
      return null;
    }
  }, [text]);
  return html ? (
    <div
      className="canvas-formula"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  ) : (
    <p className="canvas-warning" role="status">
      公式尚未完整，请检查 LaTeX 源码。
    </p>
  );
}

export default function BlockCard({
  block,
  index,
  count,
  change,
  move,
  duplicate,
  remove,
}: {
  block: CanvasBlock;
  index: number;
  count: number;
  change: (fields: Partial<BlockFields>) => void;
  move: (direction: number) => void;
  duplicate: () => void;
  remove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });
  const fields = readBlock(block);
  const code = ["code", "mermaid", "formula", "raw", "image"].includes(
    block.type,
  );
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`canvas-block ${isDragging ? "is-dragging" : ""}`}
      data-kind={block.type}
      data-block-id={block.id}
    >
      <div className="canvas-block-bar">
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="canvas-drag"
          aria-label={`拖动第${index + 1}块 · ${labels[block.type]}`}
          title="拖动排序；键盘按空格选中，方向键移动，Esc 取消"
        >
          <GripVertical size={17} />
        </button>
        <span className="canvas-block-number">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="canvas-block-label">{labels[block.type]}</span>
        <div className="canvas-block-actions">
          <button
            aria-label={`上移第${index + 1}块`}
            disabled={index === 0}
            onClick={() => move(-1)}
          >
            <ArrowUp size={14} />
          </button>
          <button
            aria-label={`下移第${index + 1}块`}
            disabled={index === count - 1}
            onClick={() => move(1)}
          >
            <ArrowDown size={14} />
          </button>
          <button aria-label={`复制第${index + 1}块`} onClick={duplicate}>
            <Copy size={14} />
          </button>
          <button
            aria-label={`删除第${index + 1}块`}
            className="danger"
            onClick={remove}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="canvas-block-content">
        {block.type === "heading" && (
          <label className="canvas-inline-field">
            标题层级
            <select
              aria-label="标题层级"
              value={fields.level || 2}
              onChange={(e) => change({ level: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  H{n}
                </option>
              ))}
            </select>
          </label>
        )}
        {block.type === "code" && (
          <label className="canvas-inline-field">
            语言
            <input
              aria-label="代码语言"
              value={fields.language || ""}
              onChange={(e) => change({ language: e.target.value })}
              placeholder="python / javascript"
              maxLength={40}
            />
          </label>
        )}
        <label className="sr-only" htmlFor={`field-${block.id}`}>
          {fieldLabels[block.type]}
        </label>
        <textarea
          id={`field-${block.id}`}
          className={`${code ? "canvas-monospace" : ""} ${block.type === "heading" ? "canvas-heading-input" : ""}`}
          rows={
            block.type === "heading"
              ? 1
              : block.type === "mermaid" || block.type === "raw"
                ? 5
                : 3
          }
          spellCheck={!code}
          value={fields.text}
          onChange={(e) => change({ text: e.target.value })}
          placeholder={
            block.type === "paragraph"
              ? "把想法写在这里，支持 Markdown 行内格式…"
              : block.type === "callout"
                ? "给读者的一点提示，或写下变量的含义…"
                : block.type === "image"
                  ? "![图片说明](/api/v1/assets/资源ID/file)"
                  : "在这里继续…"
          }
        />
        {block.type === "formula" && (
          <>
            <Formula text={fields.text} />
            <p className="canvas-field-hint">
              用下一块提示卡解释符号与假设，让公式更易理解。
            </p>
          </>
        )}
        {block.type === "mermaid" && (
          <Suspense
            fallback={<p className="canvas-field-hint">正在展开图解…</p>}
          >
            <MermaidPreview body={fields.text} />
          </Suspense>
        )}
        {block.type === "image" && (
          <>
            <p className="canvas-field-hint">
              可用上方“添加资源”上传图片，或粘贴资源库中复制的引用。
            </p>
            <MarkdownPreview body={block.source} />
          </>
        )}
        {block.type === "raw" && (
          <p className="canvas-field-hint">
            保留原始语法，可直接编辑；预览仍会清理不安全的 HTML。
          </p>
        )}
      </div>
    </li>
  );
}
