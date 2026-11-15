import { lazy, Suspense, useEffect, useState } from "react";
import {
  ArrowLeft,
  Save,
  Download,
  History,
  ImagePlus,
  Send,
  Trash2,
  Paperclip,
  BookOpen,
} from "lucide-react";
import type { ContentDocument, ViewProps, Asset } from "../types";
import { kindLabels } from "../types";
import { Button, Modal } from "../components/Shared";
import MarkdownPreview from "../components/MarkdownPreview";
import {
  api,
  ApiError,
  errorText,
  upload,
  downloadBlob,
  download,
} from "../api";
const MermaidPreview = lazy(() => import("../components/MermaidPreview"));
type Draft = Omit<
  ContentDocument,
  "id" | "createdAt" | "updatedAt" | "version" | "schemaVersion"
> &
  Partial<
    Pick<
      ContentDocument,
      "id" | "createdAt" | "updatedAt" | "version" | "schemaVersion"
    >
  >;
const blank = (kind: ContentDocument["kind"]): Draft => ({
  title: "",
  body:
    kind === "diagram"
      ? "flowchart LR\n  A[提出问题] --> B[建立模型]\n  B --> C[实验验证]\n  C --> D[形成理解]"
      : "",
  kind,
  format: kind === "diagram" ? "mermaid" : "markdown",
  description: "",
  tags: [],
  status: "draft",
  projectId: null,
  assetIds: [],
  metadata: {
    date: new Date().toLocaleDateString("en-CA"),
    category: "技术探索",
  },
});
export default function Editor({
  state,
  reload,
  notify,
  initial,
  initialBody = "",
  kind = "article",
  setDirty,
  onBack,
}: ViewProps & {
  initial: ContentDocument | null;
  initialBody?: string;
  kind?: ContentDocument["kind"];
  setDirty: (dirty: boolean) => void;
  onBack: () => void;
}) {
  const [doc, setDoc] = useState<Draft>(
    () =>
      initial || {
        ...blank(kind),
        ...(initialBody ? { body: initialBody } : {}),
      },
  );
  const [dirty, setLocalDirty] = useState(!initial?.id);
  const [tab, setTab] = useState("overview");
  const [preview, setPreview] = useState(true);
  const [revisions, setRevisions] = useState<ContentDocument[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [properties, setProperties] = useState(false);
  const [conflict, setConflict] = useState<ContentDocument | null>(null);
  const [tagsText, setTagsText] = useState(doc.tags.join(", "));
  useEffect(() => {
    setDirty(dirty);
  }, [dirty, setDirty]);
  const update = (value: Partial<Draft>) => {
    setDoc((old) => ({ ...old, ...value }));
    setLocalDirty(true);
  };
  const meta = (key: string, value: string) =>
    update({ metadata: { ...doc.metadata, [key]: value } });
  async function save() {
    try {
      const saved = await api<ContentDocument>(
        doc.id ? `/v1/documents/${doc.id}` : "/v1/documents",
        doc.id ? "PUT" : "POST",
        { ...doc, expectedVersion: doc.version },
      );
      setDoc(saved);
      setLocalDirty(false);
      setDirty(false);
      await reload();
      notify("已保存到本机");
      return saved;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && doc.id) {
        try {
          setConflict(await api<ContentDocument>(`/v1/documents/${doc.id}`));
        } catch {
          // Keep the local draft intact even if the follow-up read fails.
        }
      }
      notify(errorText(e));
      return null;
    }
  }
  const attached = state.assets.filter((a) => doc.assetIds.includes(a.id));
  const pdf = attached.find((a) => a.mime === "application/pdf");
  const attach = async (file: File) => {
    try {
      const asset = await upload(file);
      update({
        assetIds: [...new Set([...doc.assetIds, asset.id])],
        ...(asset.mime.startsWith("image/")
          ? {
              body:
                doc.body +
                `\n\n![${asset.name.replace(/[\[\]]/g, "")}](/api/v1/assets/${asset.id}/file)\n`,
            }
          : {}),
      });
      await reload();
      notify("资源已导入，请保存文档以保留关联");
    } catch (e) {
      notify(errorText(e));
    }
  };
  return (
    <div className="editor-page">
      <div className="editor-heading">
        <button className="text-link" onClick={onBack}>
          <ArrowLeft size={16} />
          返回内容库
        </button>
        <div className="editor-save-state">
          <span className={`status-dot ${dirty ? "unsaved" : ""}`} />
          {dirty ? "有未保存修改" : `已保存 · v${doc.version || 1}`}
        </div>
        <div className="actions">
          <Button
            secondary
            onClick={() => {
              downloadBlob(
                new Blob([doc.body], { type: "text/plain;charset=utf-8" }),
                `${doc.title || "未命名"}.${doc.kind === "diagram" ? "mmd" : "md"}`,
              );
            }}
          >
            <Download size={15} />
            <span className="hide-small">导出</span>
          </Button>
          <Button
            onClick={async () => {
              await save();
            }}
          >
            <Save size={15} />
            保存
          </Button>
        </div>
      </div>
      <div className="editor-title">
        <p className="eyebrow">
          {kindLabels[doc.kind]} / A THOUGHT TAKING SHAPE
        </p>
        <label className="sr-only" htmlFor="document-title">
          文档标题
        </label>
        <input
          id="document-title"
          value={doc.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder={
            doc.kind === "paper" ? "输入论文标题" : "为这份思考，写一个名字"
          }
          maxLength={200}
        />
        <label className="sr-only" htmlFor="document-description">
          内容摘要
        </label>
        <textarea
          id="document-description"
          rows={2}
          value={doc.description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="一两句话，留住此刻的核心想法……"
          maxLength={500}
        />
      </div>
      <div className="editor-tools">
        <div className="tool-group">
          <button
            onClick={() => setProperties(!properties)}
            aria-expanded={properties}
          >
            文档属性
          </button>
          <label className="file-tool">
            <ImagePlus size={15} />
            添加资源
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.drawio,.md"
              onChange={(e) => {
                if (e.target.files?.[0]) void attach(e.target.files[0]);
                e.target.value = "";
              }}
            />
          </label>
          <button
            disabled={!doc.id}
            onClick={async () => {
              try {
                setRevisions(
                  await api<ContentDocument[]>(
                    `/v1/documents/${doc.id}/snapshots`,
                  ),
                );
                setShowHistory(true);
              } catch (e) {
                notify(errorText(e));
              }
            }}
          >
            <History size={15} />
            版本
          </button>
        </div>
        <button onClick={() => setPreview(!preview)} aria-pressed={preview}>
          {preview ? "收起预览" : "展开预览"}
        </button>
      </div>
      {properties && (
        <section className="properties-grid">
          <label>
            内容类型
            <select
              value={doc.kind}
              onChange={(e) => {
                const next = e.target.value as ContentDocument["kind"];
                update({
                  kind: next,
                  format: next === "diagram" ? "mermaid" : "markdown",
                });
              }}
            >
              {Object.entries(kindLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            所属项目
            <select
              value={doc.projectId || ""}
              onChange={(e) => update({ projectId: e.target.value || null })}
            >
              <option value="">不属于项目</option>
              {state.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            标签（逗号分隔）
            <input
              value={tagsText}
              onChange={(e) => {
                setTagsText(e.target.value);
                update({
                  tags: e.target.value
                    .split(/[,，]/)
                    .map((v) => v.trim())
                    .filter(Boolean),
                });
              }}
            />
          </label>
          <label>
            文档状态
            <select
              value={doc.status}
              onChange={(e) =>
                update({ status: e.target.value as Draft["status"] })
              }
            >
              <option value="draft">草稿</option>
              <option value="ready">就绪</option>
              <option value="archived">归档</option>
            </select>
          </label>
          {doc.kind === "paper" ? (
            <>
              <label>
                作者
                <input
                  value={doc.metadata.authors || ""}
                  onChange={(e) => meta("authors", e.target.value)}
                />
              </label>
              <label>
                DOI
                <input
                  value={doc.metadata.doi || ""}
                  onChange={(e) => meta("doi", e.target.value)}
                />
              </label>
              <label>
                年份
                <input
                  value={doc.metadata.year || ""}
                  onChange={(e) => meta("year", e.target.value)}
                />
              </label>
            </>
          ) : (
            <>
              <label>
                发布日期
                <input
                  type="date"
                  value={doc.metadata.date || ""}
                  onChange={(e) => meta("date", e.target.value)}
                />
              </label>
              <label>
                分类
                <input
                  value={doc.metadata.category || ""}
                  onChange={(e) => meta("category", e.target.value)}
                />
              </label>
              <label>
                原文来源
                <input
                  value={doc.metadata.source || ""}
                  onChange={(e) => meta("source", e.target.value)}
                />
              </label>
            </>
          )}
          <label>
            关联已有资源
            <select
              value=""
              onChange={(e) => {
                if (e.target.value)
                  update({
                    assetIds: [...new Set([...doc.assetIds, e.target.value])],
                  });
              }}
            >
              <option value="">选择资源…</option>
              {state.assets.map((a) => (
                <option value={a.id} key={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}
      {attached.length > 0 && (
        <div className="attached-resources">
          {attached.map((asset) => (
            <span className="resource-chip" key={asset.id}>
              <Paperclip size={12} />
              <button
                onClick={() =>
                  void download(
                    `/v1/assets/${asset.id}/file?download=1`,
                    asset.name,
                  ).catch((e) => notify(errorText(e)))
                }
              >
                {asset.name}
              </button>
              <button
                aria-label={`解除关联 ${asset.name}`}
                onClick={() =>
                  update({
                    assetIds: doc.assetIds.filter((id) => id !== asset.id),
                  })
                }
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {doc.kind === "paper" && (
        <div className="paper-layer-bar">
          <BookOpen size={18} />
          <span>分层阅读</span>
          <div className="tabs">
            {[
              ["overview", "一 · 概览"],
              ["structure", "二 · 结构"],
              ["reading", "三 · 精读"],
              ["body", "自由笔记"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={tab === id ? "active" : ""}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className={`editor-canvas ${preview ? "split" : ""}`}>
        <section className="source-pane">
          <div className="pane-label">
            <span>
              {doc.kind === "diagram"
                ? "MERMAID SOURCE"
                : doc.kind === "paper" && tab !== "body"
                  ? "READING NOTES · " + tab.toUpperCase()
                  : "MARKDOWN"}
            </span>
            <span>
              {
                (doc.kind === "paper" && tab !== "body"
                  ? String(doc.metadata[tab as keyof typeof doc.metadata] || "")
                  : doc.body
                ).length
              }{" "}
              字符
            </span>
          </div>
          <label className="sr-only" htmlFor="body-editor">
            {doc.kind === "paper" ? "论文分层笔记" : "正文源码"}
          </label>
          <textarea
            id="body-editor"
            spellCheck={false}
            value={
              doc.kind === "paper" && tab !== "body"
                ? String(doc.metadata[tab as keyof typeof doc.metadata] || "")
                : doc.body
            }
            onChange={(e) =>
              doc.kind === "paper" && tab !== "body"
                ? meta(tab, e.target.value)
                : update({ body: e.target.value })
            }
            placeholder={
              doc.kind === "paper"
                ? "研究问题是什么？方法如何组织？证据与局限在哪里？\n\n在这一层记录你的理解。"
                : "## 从这里开始\n\n写下你的第一句话。\n\n支持代码、表格和 $LaTeX$ 公式。"
            }
          />
        </section>
        {preview && (
          <section className="preview-pane">
            <div className="pane-label">
              <span>
                {doc.kind === "paper" && pdf
                  ? "PAPER READER"
                  : "READING PREVIEW"}
              </span>
              <span>{doc.kind === "diagram" ? "图形表达" : "纸上预览"}</span>
            </div>
            {doc.kind === "diagram" ? (
              <Suspense fallback={<p className="muted">正在载入图解…</p>}>
                <MermaidPreview body={doc.body} />
              </Suspense>
            ) : doc.kind === "paper" && pdf ? (
              <div className="pdf-reader">
                <object
                  data={`/api/v1/assets/${pdf.id}/file`}
                  type="application/pdf"
                >
                  <p>
                    此浏览器无法内嵌 PDF。
                    <button
                      className="text-link"
                      onClick={() =>
                        void download(`/v1/assets/${pdf.id}/file`, pdf.name)
                      }
                    >
                      下载后阅读
                    </button>
                  </p>
                </object>
                <p className="caption">
                  PDF 原文查看 · 页码批注与双语阅读尚未接入
                </p>
              </div>
            ) : (
              <MarkdownPreview
                body={
                  doc.kind === "paper" && tab !== "body"
                    ? String(
                        doc.metadata[tab as keyof typeof doc.metadata] || "",
                      )
                    : doc.body
                }
              />
            )}
          </section>
        )}
      </div>
      <div className="editor-bottom">
        <p>内容保存在本机。保存草稿不会自动公开。</p>
        <div className="actions">
          {doc.id && (
            <>
              <Button
                secondary
                onClick={async () => {
                  if (dirty) {
                    notify("请先保存当前修改，再创建版本快照");
                    return;
                  }
                  try {
                    await api(`/v1/documents/${doc.id}/snapshots`, "POST", {});
                    notify("版本快照已保留");
                  } catch (e) {
                    notify(errorText(e));
                  }
                }}
              >
                <History size={14} />
                保留快照
              </Button>
              <button
                className="icon-button danger"
                aria-label="删除文档"
                onClick={async () => {
                  if (!confirm("删除本地文档？已导出的公开文件会保留。"))
                    return;
                  try {
                    await api(`/v1/documents/${doc.id}`, "DELETE");
                    setDirty(false);
                    setLocalDirty(false);
                    await reload();
                    onBack();
                  } catch (e) {
                    notify(errorText(e));
                  }
                }}
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
          {["article", "note"].includes(doc.kind) && (
            <Button
              secondary
              onClick={async () => {
                if (
                  !confirm("将当前版本写入博客公开目录？提交推送后会对外可见。")
                )
                  return;
                const saved = await save();
                if (!saved) return;
                try {
                  const result = await api<{ message: string }>(
                    `/v1/documents/${saved.id}/publish`,
                    "POST",
                    { expectedVersion: saved.version },
                  );
                  setDoc(
                    await api<ContentDocument>(`/v1/documents/${saved.id}`),
                  );
                  await reload();
                  notify(result.message);
                } catch (e) {
                  notify(errorText(e));
                }
              }}
            >
              <Send size={14} />
              写入公开目录
            </Button>
          )}
        </div>
      </div>
      {showHistory && (
        <Modal label="版本快照" onClose={() => setShowHistory(false)}>
          <div className="section-heading">
            <h2>留住每一稿</h2>
            <button
              autoFocus
              className="text-link"
              onClick={() => setShowHistory(false)}
            >
              关闭 ×
            </button>
          </div>
          {revisions.length ? (
            revisions.map((revision, i) => (
              <div key={revision.id} className="revision-row">
                <div>
                  <strong>快照 {revisions.length - i}</strong>
                  <p>
                    {new Date(revision.createdAt || "").toLocaleString("zh-CN")}
                  </p>
                </div>
                <Button
                  secondary
                  onClick={() => {
                    if (dirty && !confirm("用快照替换未保存内容？")) return;
                    update({
                      body: revision.body,
                      metadata: { ...doc.metadata, ...revision.metadata },
                      title: revision.title,
                      description: revision.description,
                      tags: revision.tags,
                      assetIds: revision.assetIds,
                    });
                    setTagsText(revision.tags.join(", "));
                    setShowHistory(false);
                  }}
                >
                  载入为修改稿
                </Button>
              </div>
            ))
          ) : (
            <p className="muted">还没有快照。保存后点击“保留快照”。</p>
          )}
        </Modal>
      )}
      {conflict && (
        <Modal label="文档版本冲突" onClose={() => setConflict(null)}>
          <h2>这份文档已有新的一稿</h2>
          <p className="muted">
            当前修改仍保留在编辑器中。请先核对两个版本，下载本地稿后再载入最新稿。
          </p>
          <details>
            <summary>本地修改 · v{doc.version}</summary>
            <pre className="conflict-source">
              {[
                doc.title,
                doc.body,
                ...["overview", "structure", "reading"].map(
                  (key) => doc.metadata[key as keyof typeof doc.metadata] || "",
                ),
              ]
                .filter(Boolean)
                .join("\n\n")}
            </pre>
          </details>
          <details>
            <summary>已保存版本 · v{conflict.version}</summary>
            <pre className="conflict-source">
              {[
                conflict.title,
                conflict.body,
                ...["overview", "structure", "reading"].map(
                  (key) =>
                    conflict.metadata[key as keyof typeof conflict.metadata] ||
                    "",
                ),
              ]
                .filter(Boolean)
                .join("\n\n")}
            </pre>
          </details>
          <div className="actions">
            <Button
              secondary
              onClick={() =>
                downloadBlob(
                  new Blob([JSON.stringify(doc, null, 2)], {
                    type: "application/json;charset=utf-8",
                  }),
                  `${doc.title || "未命名"}-本地修改.json`,
                )
              }
            >
              下载本地修改
            </Button>
            <Button secondary onClick={() => setConflict(null)}>
              继续保留本地稿
            </Button>
            <Button
              onClick={() => {
                if (
                  !confirm("载入已保存的最新稿会替换当前未保存修改，确定继续？")
                )
                  return;
                setDoc(conflict);
                setTagsText(conflict.tags.join(", "));
                setLocalDirty(false);
                setDirty(false);
                setConflict(null);
              }}
            >
              载入最新稿
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
