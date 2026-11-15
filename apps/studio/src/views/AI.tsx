import { useState } from "react";
import {
  Copy,
  Feather,
  Languages,
  AlignLeft,
  Check,
  Trash2,
  Plus,
} from "lucide-react";
import type { ViewProps, Task } from "../types";
import { Header, Button, Empty } from "../components/Shared";
import { api, errorText, downloadBlob } from "../api";
const blank = {
  title: "",
  action: "polish" as Task["action"],
  documentId: null as string | null,
  inputVersion: null as number | null,
  input: "",
  prompt: "请保留原意、术语、公式和引用，改进以下文字的清晰度。",
  result: "",
  status: "pending" as Task["status"],
};
export default function AI({
  state,
  reload,
  notify,
  initialPrompt = "",
  setDirty,
}: ViewProps & { initialPrompt?: string; setDirty: (value: boolean) => void }) {
  const [task, setTaskState] = useState<Partial<Task> & typeof blank>({
    ...blank,
    prompt: initialPrompt || blank.prompt,
  });
  const [templateName, setTemplateName] = useState("");
  const setTask = (next: Partial<Task> & typeof blank) => {
    setTaskState(next);
    setDirty(true);
  };
  async function save() {
    try {
      const value = {
        ...task,
        status: task.result.trim() ? "manual-complete" : "pending",
      };
      const saved = await api<Task>(
        task.id ? `/v1/tasks/${task.id}` : "/v1/tasks",
        task.id ? "PUT" : "POST",
        { ...value, expectedVersion: task.version },
      );
      setTaskState(saved);
      setDirty(false);
      await reload();
      notify("辅助记录已保存");
    } catch (error) {
      notify(errorText(error));
    }
  }
  return (
    <>
      <Header
        eyebrow="A COMPANION FOR YOUR WORDS"
        title="以思为主，以智为辅"
        description="整理提示、准备上下文、归档润色与翻译结果，让工具服务于表达。"
      >
        <span className="capability-label">手动辅助 · 尚未连接模型</span>
      </Header>
      <div className="info-banner">
        <Feather size={19} />
        <p>
          当前可复制完整提示到你常用的 AI
          工具，再将结果带回砚山保存。这里不会向模型发送内容；供应商 API
          与密钥管理将在后续接入。
        </p>
      </div>
      <div className="ai-layout">
        <section className="panel ai-composer">
          <div className="section-heading">
            <h2>准备一次思考</h2>
            <button
              className="text-link"
              onClick={() => {
                if (
                  task.input &&
                  !confirm("清空当前表单？请先保存需要的内容。")
                )
                  return;
                setTask({ ...blank });
              }}
            >
              新记录 <Plus size={15} />
            </button>
          </div>
          <div className="action-options">
            {(
              [
                ["polish", "文字润色", Feather],
                ["translate", "双语翻译", Languages],
                ["summary", "结构摘要", AlignLeft],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                className={task.action === id ? "active" : ""}
                onClick={() => setTask({ ...task, action: id })}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </div>
          <label>
            记录名称
            <input
              required
              value={task.title}
              placeholder="例如：方法部分的英文润色"
              onChange={(e) => setTask({ ...task, title: e.target.value })}
            />
          </label>
          <label>
            引用文档
            <select
              value={task.documentId || ""}
              onChange={(e) => {
                const doc = state.documents.find(
                  (d) => d.id === e.target.value,
                );
                setTask({
                  ...task,
                  documentId: doc?.id || null,
                  inputVersion: doc?.version || null,
                  input: doc?.body || "",
                  title: task.title || doc?.title || "",
                });
              }}
            >
              <option value="">手动输入内容</option>
              {state.documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} · v{d.version}
                </option>
              ))}
            </select>
          </label>
          <label>
            提示模板
            <select
              value=""
              onChange={(e) => {
                const template = state.templates.find(
                  (t) => t.id === e.target.value,
                );
                if (template) setTask({ ...task, prompt: template.body });
              }}
            >
              <option value="">选择模板…</option>
              {state.templates
                .filter((t) => t.kind === "prompt")
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
            </select>
          </label>
          <label>
            任务说明
            <textarea
              value={task.prompt}
              rows={4}
              onChange={(e) => setTask({ ...task, prompt: e.target.value })}
            />
          </label>
          <label>
            输入内容
            <textarea
              value={task.input}
              rows={8}
              onChange={(e) => setTask({ ...task, input: e.target.value })}
              placeholder="粘贴需要处理的段落，或从上方选择文档。"
            />
          </label>
          <div className="actions">
            <Button
              secondary
              onClick={async () => {
                const text = `${task.prompt}\n\n---\n\n${task.input}`;
                try {
                  await navigator.clipboard.writeText(text);
                  notify("完整提示已复制");
                } catch {
                  downloadBlob(new Blob([text]), "yanshan-prompt.txt");
                  notify("剪贴板不可用，已下载提示文本");
                }
              }}
            >
              <Copy size={15} />
              复制完整提示
            </Button>
            <Button onClick={save}>保存记录</Button>
          </div>
          <label className="result-field">
            手动导入结果
            <textarea
              value={task.result}
              rows={8}
              onChange={(e) => setTask({ ...task, result: e.target.value })}
              placeholder="在外部 AI 工具完成后，将结果粘贴到这里。不会自动覆盖原文。"
            />
          </label>
          {task.result && (
            <p className="caption">
              <Check size={14} />
              保存后标为“手动结果已归档”，与原始文档独立。
            </p>
          )}
        </section>
        <aside>
          <section className="panel">
            <div className="section-heading">
              <h2>辅助记录</h2>
              <span className="caption">{state.tasks.length} 份</span>
            </div>
            {state.tasks.length ? (
              state.tasks.map((t) => (
                <div className="task-row" key={t.id}>
                  <button
                    onClick={() => {
                      if (
                        task.input &&
                        task.id !== t.id &&
                        !confirm("载入其他记录？请先保存当前内容。")
                      )
                        return;
                      setTask(t);
                    }}
                  >
                    <strong>{t.title}</strong>
                    <span>
                      {t.status === "manual-complete"
                        ? "手动结果已归档"
                        : "待手动处理"}
                    </span>
                  </button>
                  <button
                    className="icon-button danger"
                    aria-label={`删除记录 ${t.title}`}
                    onClick={async () => {
                      if (!confirm("删除这份辅助记录？")) return;
                      try {
                        await api(`/v1/tasks/${t.id}`, "DELETE");
                        if (task.id === t.id) setTask({ ...blank });
                        await reload();
                      } catch (e) {
                        notify(errorText(e));
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            ) : (
              <Empty
                title="还没有辅助记录"
                text="准备一份提示，保留输入与结果。"
              />
            )}
          </section>
          <section className="panel prompt-save">
            <p className="eyebrow">YOUR OWN RECIPE</p>
            <h2>把好用的提示留下</h2>
            <label>
              模板名称
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="例如：严谨的学术翻译"
              />
            </label>
            <Button
              secondary
              disabled={!templateName.trim()}
              onClick={async () => {
                try {
                  await api("/v1/templates", "POST", {
                    title: templateName,
                    kind: "prompt",
                    body: task.prompt,
                    description: "自定义提示模板",
                  });
                  setTemplateName("");
                  await reload();
                  notify("提示模板已加入资源库");
                } catch (e) {
                  notify(errorText(e));
                }
              }}
            >
              保存当前任务说明
            </Button>
          </section>
        </aside>
      </div>
    </>
  );
}
