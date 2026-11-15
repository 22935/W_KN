import { useState } from "react";
import {
  FileText,
  BookOpen,
  Network,
  ArrowUpRight,
  FolderPlus,
  Trash2,
} from "lucide-react";
import { type ViewProps, kindLabels } from "../types";
import {
  Header,
  NewButton,
  Empty,
  SearchField,
  dateText,
  Button,
} from "../components/Shared";
import { api, errorText } from "../api";
export default function Library({
  state,
  open,
  reload,
  notify,
  onNew,
  kind,
}: ViewProps & { onNew: (kind?: string) => void; kind?: "paper" | "diagram" }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [project, setProject] = useState("all");
  const [newProject, setNewProject] = useState("");
  const docs = state.documents.filter(
    (d) =>
      (!kind || d.kind === kind) &&
      (filter === "all" || d.kind === filter) &&
      (project === "all" || d.projectId === project) &&
      (d.title + d.tags.join(" ") + d.description)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const icons = {
    article: FileText,
    note: FileText,
    paper: BookOpen,
    diagram: Network,
  };
  const title =
    kind === "paper"
      ? "在阅读中，见山见己"
      : kind === "diagram"
        ? "让抽象，变得可见"
        : "把思考，收在一处";
  return (
    <>
      <Header
        eyebrow={
          kind === "paper"
            ? "THE RESEARCH SHELF"
            : kind === "diagram"
              ? "THINK IN DIAGRAMS"
              : "YOUR KNOWLEDGE GARDEN"
        }
        title={title}
        description={
          kind === "paper"
            ? "论文、分层笔记与研究线索，从一次认真阅读开始。"
            : kind === "diagram"
              ? "用图形梳理路径，用结构讲清人工智能。"
              : "文章、笔记、论文与图解，共用一座安静的内容库。"
        }
      >
        <NewButton onClick={() => onNew(kind)}>
          {kind === "paper"
            ? "记录论文"
            : kind === "diagram"
              ? "新建图解"
              : "新建内容"}
        </NewButton>
      </Header>
      <div className="library-toolbar">
        <div className="tabs">
          {(kind
            ? [[kind, kindLabels[kind]]]
            : [
                ["all", "全部"],
                ["article", "文章"],
                ["note", "笔记"],
                ["paper", "论文"],
                ["diagram", "图解"],
              ]
          ).map(([id, label]) => (
            <button
              key={id}
              className={filter === id || kind === id ? "active" : ""}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <SearchField value={search} onChange={setSearch} />
      </div>
      <div className="library-layout">
        <aside className="project-rail">
          <h3>
            项目集 <span>{state.projects.length}</span>
          </h3>
          <button
            className={project === "all" ? "active" : ""}
            onClick={() => setProject("all")}
          >
            所有项目
          </button>
          {state.projects.map((p) => (
            <div className="project-item" key={p.id}>
              <button
                title={p.description}
                className={project === p.id ? "active" : ""}
                onClick={() => setProject(p.id)}
              >
                {p.name}
              </button>
              <button
                className="icon-button"
                aria-label={`删除项目 ${p.name}`}
                onClick={async () => {
                  if (!confirm("移除这个空项目？有文档的项目会保留。")) return;
                  try {
                    await api(`/v1/projects/${p.id}`, "DELETE");
                    setProject("all");
                    await reload();
                  } catch (e) {
                    notify(errorText(e));
                  }
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("/v1/projects", "POST", { name: newProject });
                setNewProject("");
                await reload();
              } catch (error) {
                notify(errorText(error));
              }
            }}
          >
            <label className="sr-only" htmlFor="project-name">
              新项目名称
            </label>
            <input
              id="project-name"
              value={newProject}
              onChange={(e) => setNewProject(e.target.value)}
              placeholder="新项目名称"
              required
              maxLength={100}
            />
            <Button type="submit" secondary>
              <FolderPlus size={14} />
              创建项目
            </Button>
          </form>
          <p className="caption">
            按课题、课程或兴趣
            <br />
            整理属于自己的知识。
          </p>
        </aside>
        <div>
          {docs.length ? (
            <div className="document-grid">
              {docs.map((doc) => {
                const Icon = icons[doc.kind];
                return (
                  <button
                    className="document-card"
                    key={doc.id}
                    onClick={() => open(doc)}
                  >
                    <div className={`card-art ${doc.kind}`}>
                      <Icon size={40} strokeWidth={1} />
                      <span>{doc.kind.toUpperCase()}</span>
                      {doc.kind === "diagram" && (
                        <div className="diagram-lines" />
                      )}
                    </div>
                    <div className="card-body">
                      <div className="card-meta">
                        <span>{kindLabels[doc.kind]}</span>
                        <span>
                          {doc.status === "archived"
                            ? "归档"
                            : doc.metadata.publicId
                              ? "已导出"
                              : doc.status === "ready"
                                ? "就绪"
                                : "草稿"}
                        </span>
                      </div>
                      <h3>{doc.title}</h3>
                      <p>
                        {doc.description ||
                          doc.tags.join(" · ") ||
                          "从一份思考，走向新的理解。"}
                      </p>
                      <div className="card-footer">
                        <span>
                          {dateText(doc.updatedAt)} · v{doc.version}
                        </span>
                        <ArrowUpRight size={16} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <Empty
              title="这一页，等你来写"
              text="可以新建内容，或调整搜索与筛选条件。"
              action={<NewButton onClick={() => onNew(kind)} />}
            />
          )}
          <p className="list-count">共 {docs.length} 份内容 · 保存在本机</p>
        </div>
      </div>
    </>
  );
}
