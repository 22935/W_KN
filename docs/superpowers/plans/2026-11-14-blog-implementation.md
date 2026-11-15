# WKN 博客实施计划

> 使用 executing-plans 在本会话顺序实施，每个阶段验证后继续。

**目标：** 完成纸上山河风格的 GitHub Pages 博客、本地创作与迁移工具、可追踪的分发工作流。

**架构：** Astro 静态生成、Pagefind 搜索；Node 本地 API 保存草稿、导入 CSDN 和管理分发准备任务。公开内容与本地私有数据分离。外部发布使用独立的 Wechatsync 集成，未经验证的平台不宣称支持自动发布。

**技术：** Astro、TypeScript、CSS、Node、Express、gray-matter、Cheerio、Turndown、marked、sanitize-html、Pagefind。

- [x] 1. 工程：package.json、astro.config.mjs、tsconfig.json、.gitignore；安装依赖并配置 GitHub 子路径。
- [x] 2. 内容：src/content.config.ts、src/lib/posts.ts、示例文章；过滤草稿，校验 metadata。
- [x] 3. 视觉：src/styles/global.css、src/components、src/layouts；实现响应式页眉、主题、搜索、页脚与山水首页。
- [x] 4. 页面：src/pages 下实现博客、文章、归档、标签、关于、RSS、404；验证真实导航和文章目录。
- [x] 5. 本地工具：studio/server.mjs、studio/lib/*.mjs、studio/web/*；本机会话验证、私有草稿、Markdown 预览、发布文件、Git 推送。
- [x] 6. 迁移：studio/lib/import.mjs；CSDN URL 白名单、HTML 正文转换、来源 ID 去重、图片下载与报告；拒绝非 CSDN 目标。
- [x] 7. 分发：平台账号 metadata、按账号生成独立交付文件、任务结果记录；集成 Wechatsync 启动接口，未收到远端结果维持待确认状态。
- [x] 8. 验证：node --test 检查迁移去重、恶意输入、草稿与发布状态；npm run check 和 npm run build；Playwright 检查桌面、手机、搜索、主题与编辑导入流程。
- [x] 9. 交付：.github/workflows/deploy.yml、README.md；说明真实迁移与部署所需 CSDN 主页和 GitHub 仓库、说明第三方限制。

首版示例内容明确标记，不虚构作者履历与访问数据。未提供的账号资料不阻塞本地工程实现，外部迁移和发布实测据实列为限制。

## 验证与边界

2026-11-14：18 项单元/API 检查、8 组浏览器流程、类型检查与生产构建通过。另用真实构建验证仓库子路径、迁移图片、文章脚本清理、公式与草稿隔离。第三方 SDK 在浏览器测试中使用替身；真实平台适配器与用户账号发布尚未实测，不等同于远端发布成功。GitHub 仓库尚未提供，因此没有推送或部署。
