import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openPlatform } from "../packages/storage/index.mjs";
import { renderPreview } from "../apps/api/preview.mjs";

test("SQLite migrates legacy drafts once, persists shared edits and rejects stale writes", async () => {
  const root = await mkdtemp(join(tmpdir(), "yanshan-store-"));
  let db;
  try {
    await writeFile(
      join(root, "state.json"),
      JSON.stringify({
        drafts: [
          {
            id: "draft-old",
            title: "旧文章",
            body: "原始 $x$",
            date: "2024-01-02",
          },
        ],
        accounts: [],
        jobs: [],
      }),
    );
    db = await openPlatform(root);
    const old = db.get("document", "draft-old");
    assert.equal(old.body, "原始 $x$");
    const changed = db.saveDocument(
      { ...old, body: "修改后" },
      old.id,
      old.version,
    );
    assert.equal(changed.version, 2);
    assert.throws(
      () => db.saveDocument({ ...old, body: "过期" }, old.id, old.version),
      (e) => e.status === 409,
    );
    assert.equal(db.legacyRead().drafts[0].body, "修改后");
    db.close();
    db = await openPlatform(root);
    assert.equal(db.get("document", "draft-old").body, "修改后");
    assert.equal(db.list("document").length, 1);
    assert.match(
      await readFile(join(root, "state.pre-sqlite.json"), "utf8"),
      /原始/,
    );
  } finally {
    db?.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("invalid legacy state is never replaced with an empty database", async () => {
  const root = await mkdtemp(join(tmpdir(), "yanshan-invalid-"));
  try {
    await writeFile(join(root, "state.json"), "{bad");
    await assert.rejects(() => openPlatform(root));
    assert.equal(await readFile(join(root, "state.json"), "utf8"), "{bad");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("legacy distribution maps image links without rewriting untouched documents", async () => {
  const root = await mkdtemp(join(tmpdir(), "yanshan-legacy-assets-"));
  let db;
  try {
    db = await openPlatform(root);
    const asset = db.save("asset", {
      name: "示意图.png",
      key: "0123456789abcdef01234567.png",
      mime: "image/png",
    });
    const doc = db.saveDocument({
      title: "带图文章",
      status: "ready",
      body: `![图](/api/v1/assets/${asset.id}/file)`,
      assetIds: [asset.id],
    });
    const state = db.legacyRead();
    assert.equal(state.drafts[0].body, `![图](/images/imported/${asset.key})`);
    state.accounts.push({ id: "account-1", platform: "csdn" });
    db.legacyWrite(state);
    assert.equal(db.get("document", doc.id).version, doc.version);
    assert.equal(db.get("document", doc.id).body, doc.body);
    state.drafts[0].title = "旧编辑器修改标题";
    db.legacyWrite(state);
    const saved = db.get("document", doc.id);
    assert.equal(saved.title, "旧编辑器修改标题");
    assert.equal(saved.status, "ready");
    assert.deepEqual(saved.assetIds, [asset.id]);
    db.saveDocument({ ...saved, kind: "paper" }, saved.id, saved.version);
    assert.equal(db.legacyRead().drafts.length, 0);
  } finally {
    db?.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("referenced resources and projects cannot be silently removed; snapshots remain immutable", async () => {
  const root = await mkdtemp(join(tmpdir(), "yanshan-reference-"));
  let db;
  try {
    db = await openPlatform(root);
    const asset = db.save("asset", {
      name: "论文.pdf",
      key: "pdf-key",
      size: 10,
    });
    const project = db.save("project", { name: "研究" });
    const doc = db.saveDocument({
      title: "论文",
      kind: "paper",
      assetIds: [asset.id],
      projectId: project.id,
    });
    const rev = db.snapshot(doc.id);
    const changed = db.saveDocument(
      { ...doc, body: "新版本" },
      doc.id,
      doc.version,
    );
    assert.equal(db.get("revision", rev.id).body, "");
    assert.equal(changed.body, "新版本");
    const linked = db.saveDocument({
      title: "论文精读中的图片",
      kind: "paper",
      metadata: { reading: `![图](/api/v1/assets/${asset.id}/file)` },
    });
    assert.deepEqual(linked.assetIds, [asset.id]);
    assert.throws(
      () => db.remove("asset", asset.id),
      (e) => e.status === 409,
    );
    assert.throws(
      () => db.remove("project", project.id),
      (e) => e.status === 409,
    );
    assert.throws(() =>
      db.saveDocument({
        title: "坏引用",
        assetIds: ["00000000-0000-4000-8000-000000000000"],
      }),
    );
  } finally {
    db?.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("formula preview respects code fences and removes unsafe HTML", () => {
  const html = renderPreview(
    '## 标题\n\n$x^2$\n\n```js\nconst price="$x$";\n```\n\n<script>alert(1)</script>',
  );
  assert.ok(html.includes("katex"));
  assert.ok(
    html.includes("price=&quot;$x$&quot;") || html.includes('price="$x$"'),
  );
  assert.ok(!html.includes("<script"));
});
