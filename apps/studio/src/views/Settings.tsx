import { useState } from "react";
import { Download, Database, Server, Palette, ShieldCheck } from "lucide-react";
import type { ViewProps } from "../types";
import { Header, Button } from "../components/Shared";
import { api, errorText, download } from "../api";
export default function Settings({
  state,
  reload,
  notify,
  setDirty,
}: ViewProps & { setDirty: (value: boolean) => void }) {
  const [site, setSiteState] = useState(state.site);
  const setSite = (value: typeof site) => {
    setSiteState(value);
    setDirty(true);
  };
  return (
    <>
      <Header
        eyebrow="MAKE THIS SPACE YOURS"
        title="书斋有序，创作自在"
        description="管理品牌、数据与备份，清楚了解每一项能力的运行位置。"
      />
      <div className="settings-grid">
        <section className="panel">
          <h2>
            <Palette size={20} />
            站点品牌
          </h2>
          <label>
            中文名
            <input
              value={site.name}
              maxLength={40}
              onChange={(e) => setSite({ ...site, name: e.target.value })}
            />
          </label>
          <label>
            英文名
            <input
              value={site.englishName}
              maxLength={60}
              onChange={(e) =>
                setSite({ ...site, englishName: e.target.value })
              }
            />
          </label>
          <label>
            描述
            <textarea
              value={site.description}
              maxLength={300}
              rows={4}
              onChange={(e) =>
                setSite({ ...site, description: e.target.value })
              }
            />
          </label>
          <div className="actions">
            <Button
              onClick={async () => {
                try {
                  await api("/v1/settings/site", "PUT", site);
                  setDirty(false);
                  await reload();
                  notify("工作台品牌已保存");
                } catch (e) {
                  notify(errorText(e));
                }
              }}
            >
              保存品牌
            </Button>
            <Button
              secondary
              onClick={async () => {
                if (!confirm("把已保存的品牌写入公开站源文件？")) return;
                try {
                  const result = await api<{ message: string }>(
                    "/v1/settings/site/export",
                    "POST",
                    {},
                  );
                  notify(result.message);
                } catch (e) {
                  notify(errorText(e));
                }
              }}
            >
              导出到博客
            </Button>
          </div>
        </section>
        <section className="panel backup-panel">
          <h2>
            <Database size={20} />
            数据与备份
          </h2>
          <p>
            私有内容保存在 <code>.local/yanshan.sqlite</code>，文件资源保存在{" "}
            <code>.local/assets/</code>。旧数据迁移前的备份位于{" "}
            <code>.local/state.pre-sqlite.json</code>。
          </p>
          <Button
            secondary
            onClick={async () => {
              try {
                await download(
                  "/v1/backup",
                  `yanshan-${new Date().toLocaleDateString("en-CA")}.zip`,
                );
                notify("备份已导出，请保存在个人安全位置");
              } catch (e) {
                notify(errorText(e));
              }
            }}
          >
            <Download size={16} />
            导出数据与资源
          </Button>
          <p className="caption">
            备份包含数据库、本地资源和交付文件。浏览器账号登录资料、CSDN
            抓取缓存及仓库中已有的公开图片另行保留，不包含在这个备份内。
          </p>
          <h3>恢复方法</h3>
          <p>
            停止工作台，按 README 设置 <code>YANSHAN_RESTORE</code>{" "}
            为备份包路径后重新启动。恢复前会核对清单、数据库和路径，并保留当前数据库备份。
          </p>
        </section>
        <section className="panel">
          <h2>
            <ShieldCheck size={20} />
            当前能力
          </h2>
          <dl className="capability-list">
            {[
              ["数据存储", "SQLite · 本地持久化"],
              ["文章写作", "组件画布、拖拽、Markdown、公式与快照"],
              ["论文阅读", "PDF 原文与三层阅读笔记"],
              ["图解", "Mermaid 编辑 · draw.io 源文件管理"],
              ["AI", "提示模板与手动结果归档"],
              ["LaTeX 编译", "规划中 · 尚未接入"],
              ["多平台发布", "保留现有辅助交付流程"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="panel">
          <h2>
            <Server size={20} />
            本地与服务器
          </h2>
          <p>
            GitHub Pages
            承载公开阅读；本机服务运行完整工作台。私有内容、论文批注和账号资料不会随静态站发布。
          </p>
          <p>
            服务器版本将沿用当前 API 和 SQLite
            数据格式，通过备份迁移。公网认证、HTTPS
            代理和部署编排尚未交付，当前请继续在本机使用。
          </p>
          <span className="capability-label">
            LOCAL FIRST / CONTENT IS YOURS
          </span>
        </section>
      </div>
    </>
  );
}
