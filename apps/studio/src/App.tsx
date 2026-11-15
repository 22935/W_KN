import { useCallback, useEffect, useRef, useState } from "react";
import {
  Feather,
  LayoutDashboard,
  Library,
  BookOpen,
  Network,
  Sparkles,
  Send,
  Settings,
  Search,
  Sun,
  Moon,
  Menu,
  ArrowUpRight,
  RefreshCw,
  X,
} from "lucide-react";
import type { ContentDocument, State } from "./types";
import { api, ApiError, errorText } from "./api";
import Overview from "./views/Overview";
import LibraryView from "./views/Library";
import Editor from "./views/Editor";
import Resources from "./views/Resources";
import AI from "./views/AI";
import Publish from "./views/Publish";
import SettingsView from "./views/Settings";
import { Button, Modal } from "./components/Shared";
const navigation = [
  ["overview", "书斋总览", LayoutDashboard],
  ["editor", "落笔写作", Feather],
  ["library", "内容库", Library],
  ["papers", "论文书架", BookOpen],
  ["diagrams", "图解工坊", Network],
  ["resources", "资源与模板", Library],
  ["ai", "AI 助手", Sparkles],
  ["publish", "发布中心", Send],
  ["settings", "偏好设置", Settings],
] as const;
export default function App() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [unauthorized, setUnauthorized] = useState(false);
  const [view, setView] = useState("overview");
  const [selection, setSelection] = useState<ContentDocument | null>(null);
  const [kind, setKind] = useState<ContentDocument["kind"]>("article");
  const [nonce, setNonce] = useState(0);
  const [notice, setNotice] = useState("");
  const [menu, setMenu] = useState(false);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("yanshan-theme") || "light",
  );
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const dirty = useRef(false);
  const notify = useCallback((message: string) => setNotice(message), []);
  const setDirty = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);
  const reload = useCallback(async () => {
    const value = await api<State>("/v1/state");
    setState(value);
    setError("");
  }, []);
  useEffect(() => {
    api("/v1/session", "POST", {})
      .then(reload)
      .catch((e) => {
        setError(errorText(e));
        setUnauthorized(e instanceof ApiError && e.status === 401);
      });
  }, [reload]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("yanshan-theme", theme);
  }, [theme]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, []);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((x) => !x);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setMenu(false);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);
  const canLeave = () =>
    !dirty.current ||
    confirm("当前有未保存修改，确定离开？可以先保存或导出正文。");
  const navigate = (target: string) => {
    if (!canLeave()) return;
    dirty.current = false;
    setView(target);
    setMenu(false);
    if (target === "editor") {
      setSelection(null);
      setTemplateBody("");
      setKind("article");
      setNonce((n) => n + 1);
    }
  };
  const open = (doc: ContentDocument) => {
    if (!canLeave()) return;
    dirty.current = false;
    setSelection(doc);
    setKind(doc.kind);
    setView("editor");
    setNonce((n) => n + 1);
    setSearchOpen(false);
    setMenu(false);
  };
  const onNew = (value = "article", body?: string) => {
    if (!canLeave()) return;
    dirty.current = false;
    setSelection(null);
    setTemplateBody(body || "");
    setKind(value as ContentDocument["kind"]);
    setView("editor");
    setNonce((n) => n + 1);
  };
  if (!state)
    return (
      <div className="session-screen">
        <div className="brand-seal">砚</div>
        <p className="eyebrow">YANSHAN / PRIVATE STUDIO</p>
        <h1>
          {unauthorized
            ? "从你的书斋入口进入"
            : error
              ? "书斋暂时无法连接"
              : "正在展开你的书斋"}
        </h1>
        <p>{error || "读取本地内容与资源…"}</p>
        {unauthorized ? (
          <p>
            在终端运行 <code>npm run studio</code>，打开输出的完整会话链接。
          </p>
        ) : error ? (
          <Button
            onClick={async () => {
              try {
                await api("/v1/session", "POST", {});
                await reload();
              } catch (e) {
                setError(errorText(e));
              }
            }}
          >
            重新连接
          </Button>
        ) : null}
      </div>
    );
  const common = { state, reload, notify, open };
  return (
    <>
      <a className="skip-link" href="#workspace-main">
        跳至工作区
      </a>
      {menu && (
        <button
          className="mobile-scrim"
          aria-label="关闭导航"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? "is-open" : ""}`}>
        <a
          className="studio-brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("overview");
          }}
        >
          <span className="brand-seal">砚</span>
          <span>
            {state.site.name}
            <small>{state.site.englishName} STUDIO</small>
          </span>
        </a>
        <p className="nav-caption">创作与研究 / WORKSPACE</p>
        <nav aria-label="工作台导航">
          {navigation.map(([id, label, Icon], i) => (
            <div key={id}>
              {i === 6 && <div className="nav-divider" />}
              <button
                className={view === id ? "active" : ""}
                aria-current={view === id ? "page" : undefined}
                onClick={() => navigate(id)}
              >
                <Icon size={18} strokeWidth={1.65} />
                <span>{label}</span>
                {id === "library" && <small>{state.documents.length}</small>}
                {id === "ai" && <span className="new-dot" />}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-status">
            <span className="status-dot" />
            <span>本地运行 · 内容归你</span>
          </div>
          <a
            href="https://22935.github.io/W_KN/"
            target="_blank"
            rel="noreferrer"
          >
            翻开公开博客
            <ArrowUpRight size={15} />
          </a>
          <p>纸上有山河，心中有天地。</p>
          <span className="sidebar-decoration" aria-hidden="true">
            山
          </span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-menu"
              aria-label="打开导航"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={20} />
            </button>
            <span className="breadcrumb">
              砚山书斋 <span>/</span>{" "}
              {navigation.find(([id]) => id === view)?.[1]}
            </span>
          </div>
          <div className="topbar-actions">
            <button
              className="search-trigger"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={16} />
              <span>寻找灵感</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              className="icon-button"
              aria-label="刷新数据"
              onClick={() => void reload().catch((e) => notify(errorText(e)))}
            >
              <RefreshCw size={16} />
            </button>
            <button
              className="icon-button"
              aria-label="切换主题"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <span className="avatar">W</span>
          </div>
        </header>
        <main
          id="workspace-main"
          className={`main-content ${view === "editor" ? "is-editor" : ""}`}
        >
          {view === "overview" && (
            <Overview {...common} onNew={() => onNew()} navigate={navigate} />
          )}
          {view === "library" && <LibraryView {...common} onNew={onNew} />}
          {view === "papers" && (
            <LibraryView {...common} kind="paper" onNew={onNew} />
          )}
          {view === "diagrams" && (
            <LibraryView {...common} kind="diagram" onNew={onNew} />
          )}
          {view === "editor" && (
            <Editor
              key={nonce}
              {...common}
              initial={selection}
              initialBody={templateBody}
              kind={kind}
              setDirty={setDirty}
              onBack={() => navigate("library")}
            />
          )}
          {view === "resources" && (
            <Resources
              {...common}
              onTemplate={(value, body) => {
                if (value === "prompt") {
                  setPrompt(body);
                  navigate("ai");
                } else onNew(value === "mermaid" ? "diagram" : "article", body);
              }}
            />
          )}
          {view === "ai" && (
            <AI
              key={prompt}
              {...common}
              initialPrompt={prompt}
              setDirty={setDirty}
            />
          )}
          {view === "publish" && <Publish {...common} />}
          {view === "settings" && (
            <SettingsView {...common} setDirty={setDirty} />
          )}
        </main>
        <footer className="workspace-footer">
          <span>{state.site.name} · 思有所归，写有所成</span>
          <span>
            LOCAL FIRST <i /> MADE FOR YOUR MIND
          </span>
        </footer>
      </div>
      {notice && (
        <div className="notice" role="status">
          {notice}
          <button aria-label="关闭提示" onClick={() => setNotice("")}>
            <X size={15} />
          </button>
        </div>
      )}
      {searchOpen && (
        <Modal
          label="搜索内容"
          className="search-modal"
          onClose={() => setSearchOpen(false)}
        >
          <div className="search-modal-input">
            <Search size={21} />
            <input
              autoFocus
              placeholder="搜索文档标题、标签与摘要…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              className="icon-button"
              aria-label="关闭搜索"
              onClick={() => setSearchOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
          <div className="search-results">
            {state.documents
              .filter((d) =>
                (d.title + d.description + d.tags.join(" "))
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .slice(0, 15)
              .map((doc) => (
                <button key={doc.id} onClick={() => open(doc)}>
                  <strong>{doc.title}</strong>
                  <span>{doc.description || doc.tags.join(" · ")}</span>
                </button>
              ))}
          </div>
          <p className="caption">搜索本机内容库 · Esc 关闭</p>
        </Modal>
      )}
    </>
  );
}
