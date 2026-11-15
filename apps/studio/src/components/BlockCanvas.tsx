import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Undo2, Redo2, Type } from "lucide-react";
import {
  splitMarkdown,
  joinBlocks,
  createBlock,
  editBlock,
  moveBlock,
  separateBlocks,
  type CanvasBlock,
} from "@yanshan/content/canvas";
import BlockCard, { palette } from "./CanvasBlockCard";
import "./BlockCanvas.css";
export default function BlockCanvas({
  body,
  onChange,
}: {
  body: string;
  onChange: (source: string) => void;
}) {
  const [blocks, setBlocks] = useState(() => splitMarkdown(body));
  const current = useRef(blocks);
  const history = useRef<{
    past: CanvasBlock[][];
    future: CanvasBlock[][];
    key: string;
    time: number;
  }>({ past: [], future: [], key: "", time: 0 });
  const [notice, setNotice] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  useEffect(() => {
    if (body === joinBlocks(current.current)) return;
    const next = splitMarkdown(body);
    current.current = next;
    history.current = { past: [], future: [], key: "", time: 0 };
    setBlocks(next);
    setNotice("已载入最新正文");
  }, [body]);

  const focus = (id: string, handle = false) =>
    requestAnimationFrame(() =>
      root.current
        ?.querySelector<HTMLElement>(
          `[data-block-id="${id}"] ${handle ? ".canvas-drag" : "textarea"}`,
        )
        ?.focus({ preventScroll: handle }),
    );
  const commit = (next: CanvasBlock[], message: string, editKey = "") => {
    const h = history.current;
    if (!editKey || h.key !== editKey || Date.now() - h.time > 1000)
      h.past = [...h.past.slice(-59), current.current];
    h.future = [];
    h.key = editKey;
    h.time = Date.now();
    current.current = separateBlocks(next);
    setBlocks(current.current);
    onChange(joinBlocks(current.current));
    setNotice(message);
  };
  const restore = (undo: boolean) => {
    const h = history.current;
    const source = undo ? h.past : h.future;
    if (!source.length) return;
    const next = source.pop()!;
    (undo ? h.future : h.past).push(current.current);
    h.key = "";
    current.current = next;
    setBlocks(next);
    onChange(joinBlocks(next));
    setNotice(undo ? "已撤销画布操作" : "已重做画布操作");
  };
  const reorder = (active: string, over: string) => {
    const next = moveBlock(current.current, active, over);
    if (next === current.current) return;
    commit(
      next,
      `组件已移至第 ${next.findIndex((b) => b.id === active) + 1} 位`,
    );
    focus(active, true);
  };
  const dragEnd = ({ active, over }: DragEndEvent) => {
    if (over) reorder(String(active.id), String(over.id));
  };
  return (
    <div ref={root} className="writing-canvas">
      <div className="canvas-toolbar">
        <div>
          <p className="eyebrow">COMPOSE, ONE THOUGHT AT A TIME</p>
          <h2>让思绪，有序成章</h2>
        </div>
        <div className="canvas-history">
          <button
            aria-label="撤销画布操作"
            title="撤销画布操作"
            disabled={!history.current.past.length}
            onClick={() => restore(true)}
          >
            <Undo2 size={17} />
          </button>
          <button
            aria-label="重做画布操作"
            title="重做画布操作"
            disabled={!history.current.future.length}
            onClick={() => restore(false)}
          >
            <Redo2 size={17} />
          </button>
        </div>
      </div>
      <div className="canvas-palette" aria-label="添加写作组件">
        {palette.map(([type, label, Icon]) => (
          <button
            key={type}
            aria-label={`添加${label}`}
            onClick={() => {
              const next = createBlock(type);
              commit([...current.current, next], `已添加${label}`);
              focus(next.id);
            }}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <p className="canvas-help">
        拖动左侧手柄编排文章，或用上下箭头移动。删除与排序可撤销。
      </p>
      <div className="sr-only" role="status" aria-live="polite">
        {notice}
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={dragEnd}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "按空格选中组件，使用上下方向键移动，空格放下，Esc 取消。",
          },
          announcements: {
            onDragStart: () => "组件已选中，使用上下方向键移动。",
            onDragOver: () => "组件位置已调整。",
            onDragEnd: () => "组件已放下。",
            onDragCancel: () => "已取消拖动。",
          },
        }}
      >
        <SortableContext
          items={blocks.map((b) => b.id)}
          strategy={verticalListSortingStrategy}
        >
          <ol className="canvas-block-list" aria-label="文章组件">
            {blocks.map((block, index) => (
              <BlockCard
                key={block.id}
                block={block}
                index={index}
                count={blocks.length}
                change={(fields) =>
                  commit(
                    current.current.map((b) =>
                      b.id === block.id ? editBlock(b, fields) : b,
                    ),
                    "组件内容已修改",
                    block.id,
                  )
                }
                move={(direction) =>
                  reorder(block.id, blocks[index + direction].id)
                }
                duplicate={() => {
                  const copy = { ...block, id: crypto.randomUUID() };
                  const next = current.current.slice();
                  next.splice(index + 1, 0, copy);
                  commit(next, "已复制组件");
                  focus(copy.id);
                }}
                remove={() => {
                  const next = current.current.filter((b) => b.id !== block.id);
                  commit(next, "已移除组件，可以撤销恢复");
                  if (next.length)
                    focus(next[Math.min(index, next.length - 1)].id, true);
                }}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {!blocks.length && (
        <div className="canvas-empty">
          <Type size={28} strokeWidth={1} />
          <h3>从一段文字，开始一页新作</h3>
          <p>选择上方组件，将想法、公式和图解慢慢串联。</p>
        </div>
      )}
      <p className="canvas-footnote">
        同一份文字，两种书写方式 · 切换源码不会自动改写文章
      </p>
    </div>
  );
}
