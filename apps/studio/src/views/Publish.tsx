import { useEffect, useState } from "react";
import {
  Github,
  GitBranch,
  ArrowUpRight,
  Upload,
  UserRound,
  Import,
  PackageCheck,
} from "lucide-react";
import type { ViewProps } from "../types";
import { Header, Button, External, Empty } from "../components/Shared";
import { api, errorText } from "../api";
interface Legacy {
  accounts: { id: string; name: string; platform: string }[];
  jobs: {
    id: string;
    title: string;
    status: string;
    accountName: string;
    message: string;
  }[];
}
export default function Publish({ state, notify, reload, open }: ViewProps) {
  const [legacy, setLegacy] = useState<Legacy | null>(null);
  const [result, setResult] = useState("");
  useEffect(() => {
    api<Legacy>("/state")
      .then(setLegacy)
      .catch((e) => notify(errorText(e)));
  }, [notify]);
  const docs = state.documents.filter((d) => d.metadata.publicId);
  return (
    <>
      <Header
        eyebrow="LET YOUR IDEAS TRAVEL"
        title="写于此，行向远方"
        description="公开版本、仓库同步与多平台交付，在这里分别核对。"
      >
        <External href="https://github.com/22935/W_KN/actions">
          查看站点部署
        </External>
      </Header>
      <div className="publish-grid">
        <section className="panel git-panel">
          <div className="section-heading">
            <h2>
              <GitBranch size={20} /> 仓库同步
            </h2>
            <span className="capability-label">GitHub + Gitee</span>
          </div>
          <p>
            将已导出的文章与引用图片提交到当前分支，再分别推送到两个远端。源码推送与
            Pages 部署各自核对。
          </p>
          <pre className="git-output">
            {state.git.status || "仓库没有未提交的内容变更"}
          </pre>
          <Button
            disabled={!state.git.hasRemote}
            onClick={async () => {
              if (
                !confirm(
                  "提交公开内容并推送当前 Git 分支到 GitHub / Gitee？请先核对文章版本。",
                )
              )
                return;
              try {
                const res = await api<{ message: string }>(
                  "/git/push",
                  "POST",
                  {},
                );
                setResult(res.message);
                notify(res.message);
                await reload();
              } catch (e) {
                notify(errorText(e));
              }
            }}
          >
            <Upload size={16} />
            提交公开内容并同步
          </Button>
          {result && (
            <p className="inline-report" role="status">
              {result}
            </p>
          )}
        </section>
        <section className="panel">
          <p className="eyebrow">PUBLISHING TOOLKIT</p>
          <h2>沿用可靠的交付流程</h2>
          <div className="toolkit-links">
            <a href="/legacy/?view=imports">
              <Import size={21} />
              <div>
                <strong>CSDN 内容迁移</strong>
                <p>链接 / Markdown / 完整 HTML 导入</p>
              </div>
              <ArrowUpRight size={16} />
            </a>
            <a href="/legacy/?view=accounts">
              <UserRound size={21} />
              <div>
                <strong>平台与账号</strong>
                <p>{legacy?.accounts.length || 0} 个账号 · 独立浏览器会话</p>
              </div>
              <ArrowUpRight size={16} />
            </a>
            <a href="/legacy/?view=deliveries">
              <PackageCheck size={21} />
              <div>
                <strong>多平台分发</strong>
                <p>交付包、编辑器辅助与结果核对</p>
              </div>
              <ArrowUpRight size={16} />
            </a>
          </div>
          <p className="caption">
            浏览器填入与文件准备不代表远端发布成功。图片上传、验证码与最终提交可能仍需人工接续。
          </p>
        </section>
      </div>
      <div className="section-heading">
        <div>
          <p className="eyebrow">PUBLIC EXPORTS</p>
          <h2>已写入公开目录</h2>
        </div>
        <span className="caption">{docs.length} 份内容</span>
      </div>
      {docs.length ? (
        <div className="document-rows">
          {docs.map((doc) => (
            <button
              className="document-row"
              key={doc.id}
              onClick={() => open(doc)}
            >
              <Github size={20} />
              <div>
                <h3>{doc.title}</h3>
                <p>
                  {doc.metadata.publicId} · 当前编辑版本 v{doc.version}
                </p>
              </div>
              <span className="type-label">公开源文件</span>
              <ArrowUpRight size={16} />
            </button>
          ))}
        </div>
      ) : (
        <Empty
          title="还没有公开导出"
          text="在写作页保存并核对后，选择“写入公开目录”。"
        />
      )}
    </>
  );
}
