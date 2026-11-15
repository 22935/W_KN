# 第三方组件与参考项目

本项目公开博客和本地工作台采用独立实现。没有将完整第三方博客主题或多平台分发项目复制进源代码。

- Astro、Pagefind、KaTeX、Express、Cheerio、Turndown、marked、sanitize-html、Playwright 等依赖的许可详见各 npm 包及安装后的 LICENSE 文件。
- Fuwari：博客功能参考（Astro、文章目录、主题、静态搜索），未复制其界面代码。仓库：https://github.com/saicaca/fuwari
- Wechatsync：可选外部分发集成。通过其网页 SDK 的 `window.syncPost` 接口转交用户明确选择的文章。仓库：https://github.com/wechatsync/Wechatsync
- article-syncjs：用户点击确认后，在独立本地端口的交付页面中从上游 CDN 加载，不在创作台会话所在页面加载。SDK 路径与接口来自上游 README：https://github.com/wechatsync/article-syncjs

Wechatsync 的部分文档较旧，平台兼容性需要本机验证。没有把网页接口调用当成远端已发布的证明。其许可证信息需要针对具体代码核对；当前未复制其适配器源代码。

山水 SVG 插画、版式和工作台页面为本项目创建。字体使用 Google Fonts 提供的 Noto Serif SC，同时配置本机宋体回退；字体网络访问失败不影响基本可读性。
