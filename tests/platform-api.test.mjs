import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { exportBackup, restoreBackup } from "../packages/storage/backup.mjs";
import { openPlatform } from "../packages/storage/index.mjs";
import { zipSync, strToU8 } from "fflate";
test("platform API: version conflicts, authenticated assets, publishing and manual AI semantics", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "yanshan-api-"));
  await mkdir(join(root, "src/content/posts"), { recursive: true });
  await writeFile(
    join(root, "src/content/posts/private.md"),
    '---\ntitle: "私有测试草稿"\ndate: "2026-11-15"\ndraft: true\n---\n不应作为公开文章导入',
  );
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL("../apps/api/server.mjs", import.meta.url))],
    {
      env: { ...process.env, WKN_PROJECT_ROOT: root, STUDIO_PORT: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  t.after(async () => {
    child.kill();
    await new Promise((r) => {
      if (child.exitCode !== null) return r();
      child.once("exit", r);
    });
    await rm(root, { recursive: true, force: true });
  });
  const { origin, token } = await new Promise((resolve, reject) => {
    let text = "";
    const timer = setTimeout(
      () => reject(new Error("API startup timeout")),
      15000,
    );
    child.stdout.on("data", (chunk) => {
      text += chunk;
      const match = text.match(
        /(http:\/\/127\.0\.0\.1:\d+)\/#token=([a-f0-9]+)/,
      );
      if (match) {
        clearTimeout(timer);
        resolve({ origin: match[1], token: match[2] });
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error("API exited " + code));
    });
    child.stderr.on("data", (chunk) => (text += chunk));
  });
  const request = async (
    path,
    body,
    method = body === undefined ? "GET" : "POST",
  ) => {
    const res = await fetch(origin + "/api/v1" + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: res.status, data: await res.json() };
  };
  assert.equal((await fetch(origin + "/api/v1/state")).status, 401);
  const initialState = await request("/state");
  assert.equal(initialState.status, 200);
  assert.equal(initialState.data.documents.length, 0);
  const bad = await request("/documents", { title: " " });
  assert.equal(bad.status, 400);
  const project = (await request("/projects", { name: "测试课题" })).data;
  const png =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ0kAAAAASUVORK5CYII=";
  const asset = (await request("/assets", { name: "test.png", base64: png }))
    .data;
  assert.equal(asset.mime, "image/png");
  assert.equal(
    (await fetch(`${origin}/api/v1/assets/${asset.id}/file`)).status,
    401,
  );
  const session = await request("/session", {});
  assert.equal(session.status, 200);
  const file = await fetch(`${origin}/api/v1/assets/${asset.id}/file`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(file.status, 200);
  assert.equal(file.headers.get("Content-Type"), "image/png");
  const doc = (
    await request("/documents", {
      title: "真实草稿",
      projectId: project.id,
      assetIds: [asset.id],
      body: `## 内容\n\n$x^2$\n\n![图](/api/v1/assets/${asset.id}/file)`,
    })
  ).data;
  assert.equal(
    (await request(`/assets/${asset.id}`, undefined, "DELETE")).status,
    409,
  );
  const saved = (
    await request(
      `/documents/${doc.id}`,
      { ...doc, body: doc.body + "\n新内容", expectedVersion: doc.version },
      "PUT",
    )
  ).data;
  assert.equal(
    (
      await request(
        `/documents/${doc.id}`,
        { ...doc, expectedVersion: doc.version },
        "PUT",
      )
    ).status,
    409,
  );
  await request(`/documents/${doc.id}/snapshots`, {});
  assert.equal(
    (await request(`/documents/${doc.id}/snapshots`)).data[0].body,
    saved.body,
  );
  const preview = await request("/preview", {
    body: "$$x^2$$\n\n<script>alert(1)</script>",
  });
  assert.ok(preview.data.html.includes("katex"));
  assert.ok(!preview.data.html.includes("<script"));
  const published = await request(`/documents/${doc.id}/publish`, {
    expectedVersion: saved.version,
  });
  assert.equal(published.status, 200);
  const markdown = await readFile(join(root, published.data.file), "utf8");
  assert.ok(!markdown.includes("/api/"));
  assert.ok(markdown.includes("../../assets/imported/"));
  const task = await request("/tasks", {
    title: "人工润色",
    input: "正文",
    result: "手动结果",
    status: "manual-complete",
  });
  assert.equal(task.data.status, "manual-complete");
  assert.equal(
    (await request("/tasks", { title: "假自动任务", status: "published" }))
      .status,
    400,
  );
  const backup = await fetch(origin + "/api/v1/backup", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(backup.status, 200);
  assert.ok((await backup.arrayBuffer()).byteLength > 100);
});
test("backup restores exact data and rejects traversal without changing the existing database", async () => {
  const root = await mkdtemp(join(tmpdir(), "yanshan-backup-"));
  let db;
  let restored;
  try {
    db = await openPlatform(join(root, "a"));
    const doc = db.saveDocument({ title: "备份正文", body: "不能丢失" });
    const zip = await exportBackup(db);
    await writeFile(join(root, "backup.zip"), zip);
    db.close();
    db = null;
    await restoreBackup(join(root, "b"), join(root, "backup.zip"));
    restored = await openPlatform(join(root, "b"));
    assert.equal(restored.get("document", doc.id).body, "不能丢失");
    restored.close();
    restored = null;
    const evil = zipSync({
      "manifest.json": strToU8(
        JSON.stringify({
          schemaVersion: 1,
          files: {
            "../escape": { size: 1, sha256: "" },
            "yanshan.sqlite": { size: 1, sha256: "" },
          },
        }),
      ),
      "yanshan.sqlite": new Uint8Array([1]),
      "../escape": new Uint8Array([1]),
    });
    await writeFile(join(root, "evil.zip"), evil);
    await assert.rejects(
      () => restoreBackup(join(root, "b"), join(root, "evil.zip")),
      /路径/,
    );
    restored = await openPlatform(join(root, "b"));
    assert.equal(restored.get("document", doc.id).body, "不能丢失");
  } finally {
    db?.close();
    restored?.close();
    await rm(root, { recursive: true, force: true });
  }
});
