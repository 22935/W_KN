import {
  ArrowUpRight,
  BookOpen,
  Feather,
  Network,
  Library,
  Plus,
} from "lucide-react";
import type { ViewProps } from "../types";
import { kindLabels } from "../types";
import { dateText, Empty } from "../components/Shared";
export default function Overview({
  state,
  open,
  onNew,
  navigate,
}: ViewProps & { onNew: () => void; navigate: (view: string) => void }) {
  const stats = [
    ["篇内容", state.documents.length, Feather],
    [
      "篇论文",
      state.documents.filter((d) => d.kind === "paper").length,
      BookOpen,
    ],
    [
      "份图解",
      state.documents.filter((d) => d.kind === "diagram").length,
      Network,
    ],
    ["件资源", state.assets.length, Library],
  ] as const;
  return (
    <>
      <div className="overview-intro">
        <div>
          <p className="eyebrow">YOUR QUIET PLACE TO CREATE</p>
          <h1>
            心有所思，
            <br />
            笔下<span>有山。</span>
            <sup>
              砚<br />山
            </sup>
          </h1>
          <p>
            在文字与图形之间，安放每一次探索。
            <br />
            从一页笔记开始，让思考慢慢成形。
          </p>
          <button className="button" onClick={onNew}>
            <Plus size={17} />
            开始一篇新作
            <ArrowUpRight size={16} />
          </button>
          <div className="hero-foot">
            <span className="status-dot" />
            本地保存，自在创作
            <span className="hairline" />
            YANSHAN STUDIO
          </div>
        </div>
        <div className="ink-landscape" aria-hidden="true">
          <svg viewBox="0 0 650 310">
            <defs>
              <linearGradient id="mountain-wash" x2="0" y2="1">
                <stop stopColor="#7c9787" stopOpacity=".45" />
                <stop offset="1" stopColor="#9caf9c" stopOpacity=".07" />
              </linearGradient>
            </defs>
            <circle cx="486" cy="70" r="29" fill="#b97558" opacity=".54" />
            <path
              d="M0 236Q45 170 75 194L178 80 231 147 306 65 404 188 450 139 554 226 650 193V310H0Z"
              fill="url(#mountain-wash)"
            />
            <path
              d="M0 285L131 183 209 239 332 131 424 221 491 174 650 271V310H0"
              fill="#587362"
              opacity=".22"
            />
            <path
              d="M50 309L194 237 270 281 391 219 475 281 580 255 650 294"
              fill="none"
              stroke="#6b8272"
              strokeWidth="1"
              opacity=".5"
            />
            <path
              d="M159 111L179 82 202 117M292 82L306 68 326 93"
              fill="none"
              stroke="#526c5d"
              opacity=".4"
            />
            <path
              d="M0 265Q150 253 300 273T650 255"
              fill="none"
              stroke="#f4f1ea"
              strokeWidth="18"
              opacity=".7"
            />
          </svg>
          <span className="vertical-note">以笔为径 · 与山同行</span>
          <span className="landscape-caption">THE LANDSCAPE OF THOUGHT</span>
        </div>
      </div>
      <div className="stat-row">
        {stats.map(([label, value, Icon], i) => (
          <div className="stat" key={label}>
            <span className="stat-index">0{i + 1}</span>
            <Icon size={18} />
            <strong>{String(value).padStart(2, "0")}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="overview-grid">
        <section>
          <div className="section-heading">
            <div>
              <p className="eyebrow">PICK UP WHERE YOU LEFT OFF</p>
              <h2>继续，未尽的思考</h2>
            </div>
            <button className="text-link" onClick={() => navigate("library")}>
              内容库
              <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="document-rows">
            {state.documents.length ? (
              state.documents
                .slice()
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .slice(0, 5)
                .map((doc, i) => (
                  <button
                    key={doc.id}
                    className="document-row"
                    onClick={() => open(doc)}
                  >
                    <span className="row-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <span className="type-label">
                        {kindLabels[doc.kind]}{" "}
                        {doc.metadata.publicId ? "· 已导出" : "· 本地"}
                      </span>
                      <h3>{doc.title}</h3>
                      <p>
                        {doc.description ||
                          doc.tags.join(" / ") ||
                          "一份正在生长的思考"}
                      </p>
                    </div>
                    <time>{dateText(doc.updatedAt)}</time>
                    <ArrowUpRight size={17} />
                  </button>
                ))
            ) : (
              <Empty
                action={
                  <button className="text-link" onClick={onNew}>
                    写下第一句话 →
                  </button>
                }
              />
            )}
          </div>
        </section>
        <aside className="side-notes">
          <div className="note-card">
            <p className="eyebrow">A SMALL INVITATION</p>
            <span className="quote-mark">“</span>
            <h3>
              知之愈明，
              <br />
              行之愈笃。
            </h3>
            <p>
              读一篇论文，画一幅图解，
              <br />
              把抽象的知识变成自己的理解。
            </p>
            <button className="text-link" onClick={() => navigate("papers")}>
              去论文书架
              <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="status-card">
            <span className="status-dot" />
            <div>
              <strong>你的书斋，正在生长</strong>
              <p>
                内容与资源保存在本机
                <br />
                建议在设置中定期导出备份
              </p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
