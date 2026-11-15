import { useState } from "react";
import {
  File,
  Image,
  FileText,
  Upload,
  Download,
  Trash2,
  LayoutGrid,
  List,
  Copy,
} from "lucide-react";
import type { ViewProps } from "../types";
import { Header, Button, Empty, SearchField } from "../components/Shared";
import { upload, download, api, errorText } from "../api";
export default function Resources({
  state,
  reload,
  notify,
  onTemplate,
}: ViewProps & { onTemplate: (kind: string, body: string) => void }) {
  const [tab, setTab] = useState("assets");
  const [search, setSearch] = useState("");
  const [list, setList] = useState(false);
  const [busy, setBusy] = useState(false);
  const assets = state.assets.filter((a) =>
    (a.name + a.mime).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <Header
        eyebrow="A LIBRARY OF POSSIBILITIES"
        title="一物一用，皆可成章"
        description="图片、论文原文、图解源文件与写作模板，都有自己的位置。"
      >
        <label className={`button ${busy ? "disabled" : ""}`}>
          <Upload size={16} />
          {busy ? "正在导入…" : "导入资源"}
          <input
            type="file"
            multiple
            accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.md,.markdown,.drawio"
            disabled={busy}
            onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = "";
              setBusy(true);
              try {
                for (const file of files) await upload(file);
                await reload();
                notify(`已导入 ${files.length} 份资源`);
              } catch (error) {
                notify(errorText(error));
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      </Header>
      <div className="library-toolbar">
        <div className="tabs">
          <button
            className={tab === "assets" ? "active" : ""}
            onClick={() => setTab("assets")}
          >
            资源文件 <span>{state.assets.length}</span>
          </button>
          <button
            className={tab === "templates" ? "active" : ""}
            onClick={() => setTab("templates")}
          >
            模板集 <span>{state.templates.length}</span>
          </button>
        </div>
        <div className="actions">
          <SearchField value={search} onChange={setSearch} />
          <button
            className="icon-button"
            aria-label={list ? "切换网格" : "切换列表"}
            onClick={() => setList(!list)}
          >
            {list ? <LayoutGrid size={18} /> : <List size={18} />}
          </button>
        </div>
      </div>
      {tab === "assets" ? (
        <>
          {assets.length ? (
            <div className={`assets-grid ${list ? "as-list" : ""}`}>
              {assets.map((asset) => {
                const used = state.documents.filter((d) =>
                  d.assetIds.includes(asset.id),
                );
                return (
                  <article className="asset-card" key={asset.id}>
                    <div className="asset-preview">
                      {asset.mime.startsWith("image/") ? (
                        <img
                          loading="lazy"
                          src={`/api/v1/assets/${asset.id}/file`}
                          alt={asset.name}
                        />
                      ) : asset.mime === "application/pdf" ? (
                        <FileText size={36} strokeWidth={1} />
                      ) : (
                        <File size={36} strokeWidth={1} />
                      )}
                    </div>
                    <div className="asset-info">
                      <h3 title={asset.name}>{asset.name}</h3>
                      <p>
                        {asset.mime.split("/")[1].toUpperCase()} ·{" "}
                        {asset.size > 1000000
                          ? `${(asset.size / 1000000).toFixed(1)} MB`
                          : `${Math.max(1, Math.round(asset.size / 1000))} KB`}
                      </p>
                      <span
                        className="caption"
                        title={used.map((d) => d.title).join("、")}
                      >
                        {used.length
                          ? `${used.length} 份文档引用`
                          : "尚未关联文档"}{" "}
                        · {asset.origin}
                      </span>
                    </div>
                    <div className="asset-actions">
                      <button
                        className="icon-button"
                        aria-label={`下载 ${asset.name}`}
                        onClick={() =>
                          void download(
                            `/v1/assets/${asset.id}/file?download=1`,
                            asset.name,
                          ).catch((e) => notify(errorText(e)))
                        }
                      >
                        <Download size={15} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`复制 ${asset.name} 引用`}
                        onClick={() =>
                          void navigator.clipboard
                            .writeText(`/api/v1/assets/${asset.id}/file`)
                            .then(() =>
                              notify("引用地址已复制，仅用于本地工作台"),
                            )
                            .catch(() => notify("无法访问剪贴板"))
                        }
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        className="icon-button danger"
                        aria-label={`删除资源 ${asset.name}`}
                        onClick={async () => {
                          if (!confirm("移除资源记录？被引用的资源会保留。"))
                            return;
                          try {
                            await api(`/v1/assets/${asset.id}`, "DELETE");
                            await reload();
                          } catch (e) {
                            notify(errorText(e));
                          }
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <Empty
              title="把灵感的素材，带进书斋"
              text="导入图片、PDF、Markdown 或 draw.io 源文件。"
            />
          )}
          <p className="caption resource-tip">
            <Image size={15} /> 图片 ≤ 5 MB · PDF ≤ 50 MB · 源文件 ≤ 5
            MB。draw.io 当前提供源文件管理，嵌入式编辑尚未接入。
          </p>
        </>
      ) : (
        <div className="template-grid">
          {state.templates
            .filter((t) => (t.title + t.description).includes(search))
            .map((template) => (
              <article key={template.id} className="template-card">
                <span className="type-label">
                  {template.kind.toUpperCase()} · 模板
                </span>
                <h3>{template.title}</h3>
                <p>{template.description}</p>
                <pre>{template.body.slice(0, 220)}</pre>
                <Button
                  secondary
                  onClick={() => onTemplate(template.kind, template.body)}
                >
                  使用这个模板 ↗
                </Button>
              </article>
            ))}
        </div>
      )}
    </>
  );
}
