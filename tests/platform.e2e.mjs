import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, cp, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const project = fileURLToPath(new URL("../", import.meta.url));
test(
  "砚山工作台：真实模块流程、版本、资源与移动布局",
  { timeout: 180000 },
  async (t) => {
    const root = await mkdtemp(join(tmpdir(), "yanshan-browser-"));
    await cp(
      join(project, "src/content/posts"),
      join(root, "src/content/posts"),
      { recursive: true },
    );
    await cp(
      join(project, "src/assets/imported"),
      join(root, "src/assets/imported"),
      { recursive: true },
    );
    const child = spawn(
      process.execPath,
      [join(project, "apps/api/server.mjs")],
      {
        env: { ...process.env, WKN_PROJECT_ROOT: root, STUDIO_PORT: "0" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let browser;
    let context;
    t.after(async () => {
      await context?.close();
      await browser?.close();
      child.kill();
      await new Promise((r) => {
        if (child.exitCode !== null) return r();
        child.once("exit", r);
      });
      await rm(root, { recursive: true, force: true });
    });
    const url = await new Promise((resolve, reject) => {
      let text = "";
      const timer = setTimeout(
        () => reject(new Error("启动超时 " + text)),
        20000,
      );
      child.stdout.on("data", (chunk) => {
        text += chunk;
        const match = text.match(/http:\/\/127\.0\.0\.1:\d+\/#token=[a-f0-9]+/);
        if (match) {
          clearTimeout(timer);
          resolve(match[0]);
        }
      });
      child.stderr.on("data", (chunk) => (text += chunk));
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error("启动失败 " + code + " " + text));
      });
    });
    try {
      browser = await chromium.launch({ channel: "chrome", headless: true });
    } catch {
      browser = await chromium.launch({ headless: true });
    }
    context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    await mkdir(join(project, "test-results"), { recursive: true });
    const nav = async (name) => {
      if (await page.locator(".mobile-menu").isVisible())
        await page
          .getByRole("button", { name: "打开导航", exact: true })
          .click();
      await page
        .getByRole("navigation", { name: "工作台导航" })
        .getByRole("button", { name, exact: false })
        .click();
    };
    await page.goto(url);
    await page
      .getByRole("heading", { name: "心有所思，" })
      .waitFor()
      .catch(() => page.locator(".overview-intro").waitFor());
    await page.screenshot({
      path: join(project, "test-results/yanshan-overview.png"),
      fullPage: true,
    });
    await t.test("文章写作、公式预览、保存与版本快照", async () => {
      await page.getByRole("button", { name: "开始一篇新作" }).click();
      await page.getByLabel("文档标题", { exact: true }).fill("砚山验收文章");
      await page
        .getByLabel("正文源码", { exact: true })
        .fill(
          '## 可理解的公式\n\n$x^2 + y^2 = z^2$\n\n```python\nprint("hello")\n```',
        );
      await page.locator(".preview .katex").waitFor();
      await page.getByRole("button", { name: "保存", exact: true }).click();
      await page.getByText("已保存 · v1", { exact: true }).waitFor();
      await page.getByRole("button", { name: "保留快照", exact: true }).click();
      await page.getByRole("button", { name: "版本", exact: true }).click();
      await page.getByRole("button", { name: "载入为修改稿" }).waitFor();
      await page.getByRole("button", { name: "关闭 ×", exact: true }).click();
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: join(project, "test-results/yanshan-editor.png"),
        fullPage: true,
      });
      await nav("内容库");
      await page.getByRole("button", { name: /砚山验收文章/ }).click();
      assert.equal(
        await page.getByLabel("正文源码", { exact: true }).inputValue(),
        '## 可理解的公式\n\n$x^2 + y^2 = z^2$\n\n```python\nprint("hello")\n```',
      );
    });
    await t.test("冲突保留本地修改，并允许核对和载入最新稿", async () => {
      await page.evaluate(async () => {
        const headers = {
          Authorization: `Bearer ${sessionStorage.getItem("wkn-session")}`,
          "Content-Type": "application/json",
        };
        const state = await (await fetch("/api/v1/state", { headers })).json();
        const doc = state.documents.find((d) => d.title === "砚山验收文章");
        const response = await fetch(`/api/v1/documents/${doc.id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({
            ...doc,
            body: "另一个窗口保存的新稿",
            expectedVersion: doc.version,
          }),
        });
        if (!response.ok) throw new Error("模拟另一处保存失败");
      });
      await page
        .getByLabel("正文源码", { exact: true })
        .fill("当前窗口未保存的修改");
      await page.getByRole("button", { name: "保存", exact: true }).click();
      const modal = page.getByRole("dialog", { name: "文档版本冲突" });
      await modal.waitFor();
      await modal.getByText(/已保存版本 ·/).click();
      await modal.getByText(/另一个窗口保存的新稿/).waitFor();
      assert.equal(
        await page.getByLabel("正文源码", { exact: true }).inputValue(),
        "当前窗口未保存的修改",
      );
      await modal.getByRole("button", { name: "继续保留本地稿" }).click();
      await page.getByRole("button", { name: "保存", exact: true }).click();
      await modal.getByRole("button", { name: "载入最新稿" }).click();
      assert.equal(
        await page.getByLabel("正文源码", { exact: true }).inputValue(),
        "另一个窗口保存的新稿",
      );
    });
    await t.test("论文三层笔记与 PDF 资源", async () => {
      await nav("论文书架");
      await page.getByRole("button", { name: "记录论文" }).click();
      await page
        .getByLabel("文档标题", { exact: true })
        .fill("Attention 论文阅读笔记");
      await page
        .getByLabel("论文分层笔记")
        .fill("研究问题：如何理解注意力机制？");
      await page.getByRole("button", { name: "二 · 结构" }).click();
      await page.getByLabel("论文分层笔记").fill("方法、实验、局限。");
      await page.locator(".file-tool input").setInputFiles({
        name: "paper.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF"),
      });
      await page
        .locator(".resource-chip")
        .filter({ hasText: "paper.pdf" })
        .waitFor();
      await page.getByRole("button", { name: "保存", exact: true }).click();
      await page.getByText("已保存 · v1", { exact: true }).waitFor();
      await nav("论文书架");
      await page
        .getByRole("button", { name: /Attention 论文阅读笔记/ })
        .click();
      assert.equal(
        await page.getByLabel("论文分层笔记").inputValue(),
        "研究问题：如何理解注意力机制？",
      );
      await page.getByRole("button", { name: "二 · 结构" }).click();
      assert.equal(
        await page.getByLabel("论文分层笔记").inputValue(),
        "方法、实验、局限。",
      );
      assert.equal(
        await page.locator('object[type="application/pdf"]').count(),
        1,
      );
    });
    await t.test("Mermaid 渲染、保存与重开", async () => {
      await nav("图解工坊");
      await page.getByRole("button", { name: "新建图解" }).click();
      await page.getByLabel("文档标题", { exact: true }).fill("模型训练流程图");
      await page.locator(".diagram-preview svg").waitFor();
      await page.getByRole("button", { name: "保存", exact: true }).click();
      await page.getByText("已保存 · v1", { exact: true }).waitFor();
      await nav("图解工坊");
      await page.getByRole("button", { name: /模型训练流程图/ }).click();
      await page.locator(".diagram-preview svg").waitFor();
      await page.screenshot({
        path: join(project, "test-results/yanshan-diagram.png"),
        fullPage: true,
      });
    });
    await t.test("AI 手动结果与模板归档", async () => {
      await nav("AI 助手");
      await page.getByLabel("记录名称").fill("段落学术润色");
      await page.getByLabel("输入内容", { exact: true }).fill("需要润色的原文");
      await page
        .getByLabel("手动导入结果")
        .fill("人工粘贴的结果，不是自动调用。");
      await page.getByRole("button", { name: "保存记录", exact: true }).click();
      await page
        .locator(".task-row")
        .filter({ hasText: "段落学术润色" })
        .waitFor();
      assert.match(
        await page.locator(".task-row").innerText(),
        /手动结果已归档/,
      );
      await page.getByLabel("模板名称").fill("我的论文润色模板");
      await page.getByRole("button", { name: "保存当前任务说明" }).click();
      await nav("资源与模板");
      await page.getByRole("button", { name: /模板集/ }).click();
      await page.getByRole("heading", { name: "我的论文润色模板" }).waitFor();
    });
    await t.test("会话、主题、手机导航与横向溢出", async () => {
      await page.getByRole("button", { name: "切换主题", exact: true }).click();
      assert.equal(
        await page.locator("html").getAttribute("data-theme"),
        "dark",
      );
      await page.reload();
      await page.locator(".overview-intro").waitFor();
      assert.equal(
        await page.locator("html").getAttribute("data-theme"),
        "dark",
      );
      await page.getByRole("button", { name: "切换主题", exact: true }).click();
      await page.setViewportSize({ width: 375, height: 812 });
      for (const name of [
        "书斋总览",
        "内容库",
        "论文书架",
        "图解工坊",
        "资源与模板",
        "AI 助手",
        "发布中心",
        "偏好设置",
      ]) {
        await nav(name);
        await page.waitForTimeout(100);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          name + " 不应横向溢出",
        );
      }
      await nav("书斋总览");
      await page.waitForFunction(
        () =>
          document.querySelector(".sidebar").getBoundingClientRect().right <= 1,
      );
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: join(project, "test-results/yanshan-mobile.png"),
        fullPage: true,
      });
      const anonymous = await browser.newContext();
      const guest = await anonymous.newPage();
      await guest.goto(new URL("/", url).href);
      await guest
        .getByRole("heading", { name: "从你的书斋入口进入" })
        .waitFor();
      await anonymous.close();
      assert.deepEqual(errors, []);
    });
  },
);
