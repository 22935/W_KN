import express from "express";
import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { join, extname } from "node:path";
import { createHash } from "node:crypto";
import { renderPreview } from "./preview.mjs";
import {
  documentSchema,
  projectSchema,
  templateSchema,
  taskSchema,
  siteSchema,
  fromLegacy,
  toLegacy,
} from "../../packages/content/index.mjs";
import { failure } from "../../packages/storage/index.mjs";
import { exportBackup } from "../../packages/storage/backup.mjs";
import {
  listPublicPosts,
  writePublicPost,
  gitStatus,
} from "../../packages/publishers/index.mjs";
import { saveUploadedImage } from "../../studio/lib/assets.mjs";

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res)).catch(next);
const types = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".pdf": "application/pdf",
  ".md": "text/plain",
  ".markdown": "text/plain",
  ".drawio": "text/plain",
};
const defaultSite = {
  name: "砚山",
  englishName: "YANSHAN",
  description: "让文字有形，让思考成山。写作、阅读与研究，在此相逢。",
};
export async function mountPlatform(app, { store, root }) {
  const p = store.platform;
  const publicPosts = (await listPublicPosts(root)).filter(
    (post) => !post.draft,
  );
  const imageAssets = new Map();
  for (const filename of await readdir(join(root, ".local/assets")).catch(
    () => [],
  )) {
    if (!/^[a-f0-9]{24}\.(png|jpg|gif|webp|avif)$/.test(filename)) continue;
    if (!p.list("asset").some((a) => a.key === filename)) {
      const bytes = await readFile(join(root, ".local/assets", filename));
      p.save("asset", {
        name: filename,
        key: filename,
        mime: types[extname(filename)],
        size: bytes.length,
        origin: "旧工作台资源",
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  }

  for (const filename of await readdir(join(root, "src/assets/imported")).catch(
    () => [],
  )) {
    if (!/^[a-f0-9]{24}\.(png|jpg|gif|webp|avif)$/.test(filename)) continue;
    let asset = p.list("asset").find((a) => a.key === `public:${filename}`);
    if (!asset) {
      const bytes = await readFile(join(root, "src/assets/imported", filename));
      asset = p.save("asset", {
        name: filename,
        key: `public:${filename}`,
        mime: types[extname(filename)],
        size: bytes.length,
        origin: "CSDN 迁移",
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
    imageAssets.set(filename, asset.id);
  }
  for (const post of publicPosts) {
    const existing = p
      .list("document")
      .find(
        (d) =>
          d.metadata.publicId === post.id ||
          (post.source &&
            d.metadata.source?.replace(/\/$/, "") ===
              post.source.replace(/\/$/, "")),
      );
    if (existing) {
      if (!existing.metadata.publicId)
        p.saveDocument(
          {
            ...existing,
            metadata: { ...existing.metadata, publicId: post.id },
          },
          existing.id,
          existing.version,
        );
      continue;
    }
    const assetIds = [
      ...new Set(
        [
          ...post.body.matchAll(
            /(?:assets\/imported|images\/imported)\/([a-f0-9]{24}\.[a-z]+)/g,
          ),
        ]
          .map((m) => imageAssets.get(m[1]))
          .filter(Boolean),
      ),
    ];
    const doc = p.saveDocument({
      ...fromLegacy({ ...post, publicId: post.id }),
      assetIds,
      status: "ready",
    });
    p.save(
      "document",
      { ...doc, publishedVersion: doc.version },
      doc.id,
      doc.version,
    );
  }
  if (!p.setting("templates-seeded", false)) {
    for (const value of [
      {
        title: "技术文章 · 从问题到实践",
        kind: "writing",
        description: "内置写作模板",
        body: "## 问题与背景\n\n## 核心思路\n\n## 公式与图解\n\n## 实现与实验\n\n## 小结与参考",
      },
      {
        title: "模型训练流程",
        kind: "mermaid",
        description: "内置图解模板",
        body: "flowchart LR\n  A[数据集] --> B[预处理]\n  B --> C[模型训练]\n  C --> D[验证与评估]\n  D --> E[部署与反馈]",
      },
      {
        title: "学术润色",
        kind: "prompt",
        description: "保留术语、公式和引用，提升表达清晰度",
        body: "请润色以下学术内容。保留原意、术语、数学公式和引用，不添加未经证实的结论。先给出修改建议，再给出修订正文。",
      },
      {
        title: "论文结构阅读",
        kind: "prompt",
        description: "从研究问题、方法、实验和局限组织笔记",
        body: "根据提供的论文片段，分别整理研究问题、核心方法、证据与实验、局限和待核对内容。没有原文依据的部分明确标为未知。",
      },
    ])
      p.save("template", value);
    p.set("templates-seeded", true);
  }
  const router = express.Router();
  router.get(
    "/state",
    wrap(async (_req, res) =>
      res.json({
        schemaVersion: 1,
        documents: p.list("document"),
        projects: p.list("project"),
        assets: p.list("asset").map(({ key, ...a }) => a),
        templates: p.list("template"),
        tasks: p.list("task"),
        site: p.setting("site", defaultSite),
        capabilities: {
          storage: "sqlite",
          mode: "local",
          ai: "manual",
          latex: false,
          drawio: "source-files",
          server: false,
        },
        git: await gitStatus(root),
      }),
    ),
  );
  router.get("/documents/:id", (req, res) => {
    const doc = p.get("document", req.params.id);
    if (!doc) throw failure("文档不存在", 404);
    res.json(doc);
  });
  router.post("/documents", (req, res) =>
    res.json(p.saveDocument(documentSchema.parse(req.body))),
  );
  router.put("/documents/:id", (req, res) => {
    if (!p.get("document", req.params.id)) throw failure("文档不存在", 404);
    if (!Number.isInteger(req.body.expectedVersion))
      throw failure("缺少预期版本号");
    res.json(p.saveDocument(req.body, req.params.id, req.body.expectedVersion));
  });
  router.delete("/documents/:id", (req, res) => {
    p.remove("document", req.params.id);
    res.json({
      deleted: true,
      message: "已移除私有文档；已导出的公开文章需在发布中心另行管理。",
    });
  });
  router.post("/documents/:id/snapshots", (req, res) =>
    res.json(p.snapshot(req.params.id)),
  );
  router.get("/documents/:id/snapshots", (req, res) =>
    res.json(p.list("revision").filter((r) => r.documentId === req.params.id)),
  );
  for (const [path, kind, schema] of [
    ["projects", "project", projectSchema],
    ["templates", "template", templateSchema],
    ["tasks", "task", taskSchema],
  ]) {
    router.post(`/${path}`, (req, res) => {
      const input = schema.parse(req.body);
      if (
        kind === "task" &&
        input.documentId &&
        !p.get("document", input.documentId)
      )
        throw failure("关联文档不存在");
      res.json(p.save(kind, input));
    });
    router.put(`/${path}/:id`, (req, res) => {
      if (!p.get(kind, req.params.id)) throw failure("记录不存在", 404);
      if (!Number.isInteger(req.body.expectedVersion))
        throw failure("缺少预期版本号");
      res.json(
        p.save(
          kind,
          schema.parse(req.body),
          req.params.id,
          req.body.expectedVersion,
        ),
      );
    });
    router.delete(`/${path}/:id`, (req, res) => {
      p.remove(kind, req.params.id);
      res.json({ deleted: true });
    });
  }
  router.post("/preview", (req, res) => {
    let value = String(req.body.body || "").replace(
      /(?:\.\.\/\.\.\/assets\/imported|\/?images\/imported)\/([a-f0-9]{24}\.[a-z]+)/g,
      (_m, file) => {
        const asset = p
          .list("asset")
          .find((a) => a.key === file || a.key === `public:${file}`);
        return asset
          ? `/api/v1/assets/${asset.id}/file`
          : `/images/imported/${file}`;
      },
    );
    res.json({ html: renderPreview(value) });
  });
  router.post(
    "/assets",
    wrap(async (req, res) => {
      const name = String(req.body.name || "")
        .replace(/[\\/\u0000-\u001f]/g, "_")
        .slice(0, 200);
      const ext = extname(name).toLowerCase();
      const mime = types[ext];
      if (!mime || !name)
        throw failure(
          "支持 PNG / JPEG / GIF / WebP / PDF / Markdown / draw.io 文件",
        );
      const base64 = String(req.body.base64 || "");
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw failure("文件编码无效");
      const bytes = Buffer.from(base64, "base64");
      if (bytes.length > (ext === ".pdf" ? 50_000_000 : 5_000_000))
        throw failure("文件超过大小限制", 413);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const duplicate = p.list("asset").find((a) => a.sha256 === sha256);
      if (duplicate) return res.json({ ...duplicate, key: undefined });
      let key = `${sha256.slice(0, 24)}${ext}`;
      if (mime.startsWith("image/")) {
        const saved = await saveUploadedImage(
          join(root, ".local/assets"),
          base64,
        );
        key = saved.filename;
      } else {
        if (ext === ".pdf" && bytes.subarray(0, 5).toString() !== "%PDF-")
          throw failure("不是有效 PDF 文件");
        if (
          ext === ".drawio" &&
          !/<mxfile[\s>]|<mxGraphModel[\s>]/.test(bytes.toString("utf8"))
        )
          throw failure("不是 draw.io 源文件");
        if (ext !== ".pdf" && bytes.includes(0))
          throw failure("文本文件内容无效");
        await mkdir(join(root, ".local/assets"), { recursive: true });
        await writeFile(join(root, ".local/assets", key), bytes);
      }
      const { key: _key, ...asset } = p.save("asset", {
        name,
        key,
        mime,
        size: bytes.length,
        sha256,
        origin: "本机导入",
      });
      res.json(asset);
    }),
  );
  router.get(
    "/assets/:id/file",
    wrap(async (req, res) => {
      const asset = p.get("asset", req.params.id);
      if (!asset) throw failure("资源不存在", 404);
      const path = asset.key.startsWith("public:")
        ? join(root, "src/assets/imported", asset.key.slice(7))
        : join(root, ".local/assets", asset.key);
      const bytes = await readFile(path);
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      res.type(asset.mime);
      if (req.query.download === "1" || asset.mime === "text/plain")
        res.attachment(asset.name);
      res.send(bytes);
    }),
  );
  router.delete(
    "/assets/:id",
    wrap(async (req, res) => {
      p.remove("asset", req.params.id);
      res.json({ deleted: true });
    }),
  );
  router.post(
    "/documents/:id/publish",
    wrap(async (req, res) => {
      const doc = p.get("document", req.params.id);
      if (!doc) throw failure("文档不存在", 404);
      if (doc.kind !== "article" && doc.kind !== "note")
        throw failure("首阶段仅发布文章与笔记，图解和论文请先导出为文章");
      if (req.body.expectedVersion !== doc.version)
        throw failure("发布版本已变化，请重新核对", 409);
      let body = doc.body;
      for (const asset of p.list("asset")) {
        const path = `/api/v1/assets/${asset.id}/file`;
        if (!body.includes(path)) continue;
        if (!asset.mime.startsWith("image/"))
          throw failure("正文包含私有非图片资源，请移除链接或先公开导出");
        body = body.replaceAll(
          path,
          `/images/imported/${asset.key.replace("public:", "")}`,
        );
      }
      if (body.includes("/api/"))
        throw failure("正文仍包含私有接口链接，请先核对");
      const result = await writePublicPost(
        root,
        { ...toLegacy(doc), body },
        doc.metadata.publicId,
      );
      p.snapshot(doc.id);
      const saved = p.saveDocument(
        { ...doc, metadata: { ...doc.metadata, publicId: result.id } },
        doc.id,
        doc.version,
      );
      p.save(
        "document",
        { ...saved, publishedVersion: doc.version },
        doc.id,
        saved.version,
      );
      res.json({
        ...result,
        message: "已写入公开目录，尚需提交推送并等待站点构建。",
      });
    }),
  );
  router.put("/settings/site", (req, res) => {
    const site = siteSchema.parse(req.body);
    p.set("site", site);
    res.json(site);
  });
  router.post(
    "/settings/site/export",
    wrap(async (_req, res) => {
      await writeFile(
        join(root, "src/site.json"),
        JSON.stringify(p.setting("site", defaultSite), null, 2) + "\n",
      );
      res.json({ message: "品牌配置已写入公开站源文件，提交推送后生效。" });
    }),
  );
  router.get(
    "/backup",
    wrap(async (_req, res) =>
      res
        .attachment(`yanshan-${new Date().toISOString().slice(0, 10)}.zip`)
        .send(await exportBackup(p)),
    ),
  );
  app.use("/api/v1", router);
}
