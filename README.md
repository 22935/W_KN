# 山外山 · WKN Journal

W.KN 的个人博客，以及配套的本地创作工作台。GitHub 仓库：https://github.com/22935/W_KN 。公开地址：https://22935.github.io/W_KN/ 。米白纸感、墨绿山水、朱砂点缀；文章使用 Markdown 保存，博客可免费部署到 GitHub Pages。

## 启动

建议使用 **Node.js 24 LTS**。依赖已锁定在 `package-lock.json`。

```powershell
npm ci
npm run dev
```

博客开发地址：`http://127.0.0.1:4321/W_KN/`。默认配置已对应 `22935/W_KN`，GitHub Actions 会按实际 Pages 配置覆盖。

全文搜索需要生产索引，使用以下命令体验完整博客：

```powershell
npm run build
npm run preview
```

另开一个终端启动创作台：

```powershell
npm run studio
```

**打开终端输出的完整地址**，其中包含本次启动的会话密钥。仅打开 `http://127.0.0.1:4310/` 不会进入已认证会话。重启工作台后请使用新链接。

端口冲突时，在 PowerShell 中设置 `$env:STUDIO_PORT='4311'` 再运行。请保持绑定在本机回环地址，不要将本地工作台映射到公网。

## 已实现

- 博客首页、文章列表、分类与标签筛选、分页、归档、关于页、404。
- 明暗主题、响应式导航、键盘搜索、静态全文索引、RSS、站点地图与分享元信息。
- 中文阅读排版、桌面目录与移动端折叠目录、阅读进度、代码高亮与复制、表格、KaTeX 公式、前后篇导航。
- 本地 Markdown 编辑与预览、私有草稿、图片插入、删除文章、写入博客内容目录、提交文章并 Git 推送。
- CSDN 详情链接批量导入、主页可见链接发现、HTML / Markdown 文件导入、来源去重、CSDN 图片本地化、逐篇迁移报告。
- 同平台多个账号的独立 Chrome / Chromium 会话、批量生成交付 ZIP、内容版本去重、分发记录、人工发布地址记录。
- CSDN / 掘金 / 知乎浏览器编辑器辅助填入，及 Wechatsync 网页 SDK 的隔离交付入口。

当前公开内容为已迁移的本人 CSDN 文章。原先 6 篇排版示例已移入 `docs/examples/posts/`，不进入博客和搜索。详细迁移范围与未完成项见 [迁移报告](docs/migration/2026-11-15-csdn.md)。

## 功能边界

GitHub Pages 只承载静态博客。编辑、迁移、图片处理和分发任务在自己的电脑上运行，需要本地工作台保持启动。

| 能力 | 当前状态 |
| --- | --- |
| 博客构建、页面交互与静态搜索 | 已在本地浏览器验证 |
| Markdown / CSDN HTML 迁移、去重与图片处理 | 有自动化测试；还需用你的真实文章核对 |
| 多账号隔离目录与内容分发交付文件 | 已实现，交付文件及同平台双账号任务已测试 |
| 浏览器自动填入编辑器 | 实验能力；未用你的真实账号验证，平台改版时可能失败 |
| Wechatsync 转交 | 依据上游接口实现；本地测试使用模拟 SDK，不代表所有平台的真实发布已通过 |
| 无人值守自动完成所有平台的最终发布 | 不作此承诺；登录、验证码、图片重传、审核和最终提交可能需要在平台中操作 |
| GitHub Pages | 已配置目标 `22935/W_KN` 和 Actions 工作流；请以 Actions 与实际公开地址为准 |

工作台不会把“已打开页面”“已生成文件”或“已填入正文”显示为远端发布成功。你手动确认的链接会标为“作者确认已发布”，并说明未独立核验远端可见性。

## 换成自己的站点

编辑 `src/config.ts` 中的站名、作者、介绍、社交地址。导航、页脚、关于页会读取配置；首页主视觉文案在 `src/pages/index.astro`。当前站名为“山外山”，作者标识为 WKN。

文章文件在 `src/content/posts/`：

```markdown
---
title: 我的第一篇文章
description: 用一句话介绍这篇文章。
date: 2026-11-14
category: 随笔手记
tags: [记录, 生活]
cover: images/river.svg
sample: false
draft: false
---

## 正文从这里开始

写下你的文字。
```

不希望公开的草稿请保存在工作台，工作台会写入 `.local/`。手动放进 `src/content/posts/` 的文件即使设置 `draft: true` 不参与网站构建，源文件仍可能随 Git 提交公开。

### 图片

工作台的“插入图片”支持 PNG、JPEG、GIF、WebP，最大 5 MB。图片先放在 `.local/assets/`；文章写入公开内容目录时，仅复制正文引用的图片到 `src/assets/imported/`，由 Astro 生成适合仓库子路径的资源。

封面可以使用 `images/river.svg`、`images/moon.svg`、`images/mountains.svg` 或 HTTPS 图片链接。迁移图片作为封面时，使用 `images/imported/文件名`，工作台会复制到公开资源目录。

不要依赖 CSDN 防盗链图片长期可用。外部非 CSDN 图片保留原链接，并在迁移报告中提示人工核对。

## CSDN 迁移

1. 在创作台进入“内容迁移”。
2. 输入自己的 CSDN 主页，发现当前页面可见文章；也可以直接粘贴多条详情链接，每行一条。
3. 导入为本地草稿，检查逐篇报告。主页发现只扫描返回的 HTML，**不代表已遍历全部历史分页**。
4. 如果遇到登录或验证限制，在浏览器保存本人文章的完整 HTML 后导入；已有 Markdown 可以直接导入。
5. 检查日期、代码、表格、图片和摘要，确认后写入博客目录。

Markdown 优先读取 Front Matter；无 Front Matter 时，使用一级标题或文件名作为标题，日期默认为导入当天。CSDN 来源 ID 相同的文章不会覆盖已编辑的本地草稿。若确实需要重新导入，可先导出备份，再删除旧草稿。

本人 CSDN 主页为 https://blog.csdn.net/Hismybestlove 。2026-11-15 已核对 78 个文章链接，成功迁移当前可读的 5 篇与 55 张图片；后续读取遇到 HTTP 521 安全验证，73 篇待验证或导入导出文件后继续。公式图片已转为本地 KaTeX，不再依赖 CSDN 公式服务。

## 多平台与多账号

1. 在“平台与账号”中添加平台和备注名。账号记录只是目标标识，不等于已经登录。
2. 点击“打开登录窗口”，在隔离的浏览器中登录。每个账号的会话放在 `.local/profiles/账号ID/`，同平台不同账号不会共用一个目录。
3. 在“分发任务”中选择文章，勾选账号。
4. 稳定模式生成 ZIP，包含 Markdown、HTML、图片和清单；实验模式进一步打开对应编辑器、尝试填入标题与正文。
5. 在平台检查图片和排版，完成平台要求的元数据、保存、审核或发布。
6. 最终文章可见后，在任务中记录地址。网络中断或失败后先核对远端，再使用“核对后重新准备”。

图片自动上传到各平台尚未实现，浏览器辅助模式会提示重新上传本地图片。微信公众号编辑器依赖登录后的动态地址，当前提供独立窗口、交付文件与扩展交付。

浏览器辅助使用已安装的 Chrome；没有 Chrome 时可安装项目使用的 Chromium：

```powershell
npx playwright install chromium
```

可选的 Wechatsync 通过官方网页 `syncPost` 接口启动。确认分享后，文章会被交给另一个本地端口的页面，该页面只接收所选文章，不接收工作台会话、其他草稿、账号列表或浏览器资料。交付页有效期 30 分钟；其 SDK 需要网络和兼容版本的浏览器扩展，平台成功状态要在扩展与平台内核对。来源和许可说明见 `THIRD_PARTY.md`。

## 部署到 GitHub Pages

需要一个你有权限推送的 GitHub 仓库。若当前目录尚无 Git 仓库，在项目根目录执行（将地址替换为自己的仓库）：

```powershell
git init -b main
git add .
git commit -m "feat: create personal journal"
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin main
```

操作前确认 `.gitignore` 生效，**不要提交 `.local/`**。其中包含私有草稿、账号会话与任务数据。已有 Git 仓库时不要重复初始化或覆盖远端配置。

在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。`.github/workflows/deploy.yml` 会在 `main` / `master` 推送时测试、构建并部署，也可手动运行。

工作流通过 `configure-pages` 自动配置站点域名和仓库子路径，兼容 `用户名.github.io` 与普通项目仓库。推送源码不等于部署完成，请以 Actions 的部署结果为准。

本地模拟项目仓库路径：

```powershell
$env:SITE_URL='https://yourname.github.io'
$env:BASE_PATH='/your-repository/'
npm run build
npm run preview
```

自定义域名时设置 GitHub Pages 的 Custom domain，并按实际域名调整 `SITE_URL` / `BASE_PATH`。

首次上线需要提交整个项目。本地工作台的 Git 按钮只提交文章和迁移图片，不会替你提交代码、覆盖远端设置或处理已有暂存内容。

## 检查与测试

```powershell
npm test
npm run check
npm run build
npm run test:e2e
npm run test:deployment
```

浏览器测试需要 Chrome 或已安装的 Playwright Chromium。测试使用临时目录，不会把测试文章、账号与任务写入你的 `.local/`。截图保存在 `test-results/`，此目录已忽略。

`test:deployment` 会临时创建带标记的测试文章和图片，实际验证 GitHub 仓库子路径、图片构建、脚本清理与草稿隔离；结束时移除这些测试文件并恢复默认构建。运行时请避免同时启动另一次构建。

测试覆盖：Markdown 往返、日期校验、CSDN 解析与来源去重、脚本清理、抓取地址白名单、图片失败与路径、并发保存、同平台双账号任务、版本去重、状态语义、第三方交付隔离、桌面与手机导航、全文搜索、主题、编辑插图、草稿保存及公开文件生成。

## 目录

```text
src/components/       博客组件
src/content/posts/    公开文章源文件
src/layouts/          页面框架与搜索交互
src/pages/            静态路由、文章、RSS
src/styles/           博客样式
public/images/        原创山水 SVG
studio/lib/           导入、发布、任务、图片、本地数据模块
studio/web/           创作台界面
studio/server.mjs     本地 API 与会话验证
.local/               私有数据，不提交 Git
tests/                自动化与浏览器测试
.github/workflows/    GitHub Pages 部署
docs/superpowers/     已确认设计与实施记录
```

本项目没有硬编码平台密码、Cookie 或 GitHub Token。Git 推送使用本机已配置的认证。

## 同步 GitHub 与 Gitee

本机保留 `origin` 为 GitHub。在拿到自己的实际 Gitee 地址后添加第二个远端：

```powershell
git remote add gitee https://gitee.com/你的用户名/你的仓库.git
npm run sync
```

当前已配置并验证的 Gitee 远端为 `https://gitee.com/mythksw/W_KN.git`，`main` 与 GitHub 同步到提交 `94a10fc`。

`npm run sync` 不自动提交，只将当前分支同一提交依次推送到 GitHub 与 Gitee；不强制推送。工作台“提交内容并推送”同样使用两个远端，分别显示结果。Gitee 失败时会报告“部分推送完成”，不会隐藏 GitHub 已成功的结果。重试 `npm run sync` 无须重复提交。

Gitee 仓库若有不同历史，需要先正常合并，再同步。Gitee 镜像不等于已配置 Gitee Pages，本项目公开站点由 GitHub Pages 承载。GitHub 网页上直接产生的提交也需要本机拉取后再运行同步；当前未配置在 GitHub 保存 Gitee 私钥的云端镜像流程。

