import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { documentSchema, fromLegacy, toLegacy } from "../content/index.mjs";

export const failure = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const parse = (row) => (row ? JSON.parse(row.payload) : null);
export async function openPlatform(directory) {
  await mkdir(directory, { recursive: true });
  const db = new DatabaseSync(join(directory, "yanshan.sqlite"));
  try {
    db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;",
    );
    const version = db.prepare("PRAGMA user_version").get().user_version;
    if (version > 1) throw failure("数据库版本较新，请使用对应版本的砚山", 409);
    db.exec(`CREATE TABLE IF NOT EXISTS entities(id TEXT PRIMARY KEY,kind TEXT NOT NULL,payload TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS entities_kind ON entities(kind);
   CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,payload TEXT NOT NULL);
   PRAGMA user_version=1;`);
    const stmt = {
      get: db.prepare("SELECT payload FROM entities WHERE kind=? AND id=?"),
      list: db.prepare(
        "SELECT payload FROM entities WHERE kind=? ORDER BY rowid DESC",
      ),
      put: db.prepare(
        "INSERT INTO entities(id,kind,payload) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload WHERE kind=excluded.kind",
      ),
      del: db.prepare("DELETE FROM entities WHERE kind=? AND id=?"),
      setting: db.prepare("SELECT payload FROM settings WHERE key=?"),
      set: db.prepare(
        "INSERT OR REPLACE INTO settings(key,payload) VALUES(?,?)",
      ),
    };
    const transaction = (fn) => {
      db.exec("BEGIN IMMEDIATE");
      try {
        const result = fn();
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    };
    const get = (kind, id) => parse(stmt.get.get(kind, id));
    const list = (kind) => stmt.list.all(kind).map(parse);
    const setting = (key, fallback) => parse(stmt.setting.get(key)) ?? fallback;
    const set = (key, value) => stmt.set.run(key, JSON.stringify(value));
    function save(kind, input, id = randomUUID(), expected) {
      const old = get(kind, id);
      if (old && expected !== undefined && old.version !== expected)
        throw failure("文档已有新版本，请先重新载入或导出当前内容", 409);
      if (!old && db.prepare("SELECT 1 FROM entities WHERE id=?").get(id))
        throw failure("记录标识冲突", 409);
      const now = new Date().toISOString();
      const record = {
        ...input,
        id,
        schemaVersion: 1,
        version: (old?.version || 0) + 1,
        createdAt: old?.createdAt || now,
        updatedAt: now,
      };
      stmt.put.run(id, kind, JSON.stringify(record));
      return record;
    }
    function saveDocument(input, id, expected) {
      const value = documentSchema.parse(input);
      const linked = [
        value.body,
        ...["overview", "structure", "reading"].map(
          (key) => value.metadata[key] || "",
        ),
      ].join("\n");
      value.assetIds = [
        ...new Set([
          ...value.assetIds,
          ...Array.from(
            linked.matchAll(/\/api\/v1\/assets\/([a-f0-9-]+)\/file/g),
            (match) => match[1],
          ),
        ]),
      ];
      if (value.projectId && !get("project", value.projectId))
        throw failure("关联项目不存在");
      for (const assetId of value.assetIds)
        if (!get("asset", assetId)) throw failure("引用的资源不存在");
      const old = id ? get("document", id) : null;
      return save(
        "document",
        {
          ...value,
          ...(value.kind === "article" &&
          (old?.legacyDraft || !value.metadata.publicId)
            ? { legacyDraft: true }
            : {}),
          ...(old?.publishedVersion
            ? { publishedVersion: old.publishedVersion }
            : {}),
        },
        id,
        expected,
      );
    }
    function remove(kind, id) {
      if (!get(kind, id)) throw failure("记录不存在", 404);
      if (
        kind === "asset" &&
        [...list("document"), ...list("revision")].some(
          (d) =>
            d.assetIds.includes(id) || d.body.includes(`/api/v1/assets/${id}/`),
        )
      )
        throw failure("资源正在被文档或版本快照引用，请先保留所需资源", 409);
      if (
        kind === "project" &&
        list("document").some((d) => d.projectId === id)
      )
        throw failure("项目仍包含文档，请先移动文档", 409);
      stmt.del.run(kind, id);
    }
    function snapshot(id) {
      const doc = get("document", id);
      if (!doc) throw failure("文档不存在", 404);
      return save("revision", {
        ...doc,
        documentId: id,
        documentVersion: doc.version,
        hash: createHash("sha256").update(JSON.stringify(doc)).digest("hex"),
      });
    }
    const legacyRead = () => {
      const assets = list("asset");
      return {
        ...setting("legacy", { accounts: [], jobs: [] }),
        drafts: list("document")
          .filter((d) => d.legacyDraft)
          .map((doc) => toLegacy(doc, assets)),
      };
    };
    function legacyWrite(next) {
      return transaction(() => {
        const assets = list("asset");
        for (const doc of list("document").filter((d) => d.legacyDraft))
          if (!next.drafts.some((d) => d.id === doc.id))
            stmt.del.run("document", doc.id);
        for (const post of next.drafts) {
          const old = get("document", post.id);
          const converted = fromLegacy(post);
          if (
            !old ||
            JSON.stringify(toLegacy(old, assets)) !== JSON.stringify(post)
          )
            save(
              "document",
              {
                ...old,
                ...converted,
                status: old?.status || converted.status,
                metadata: { ...old?.metadata, ...converted.metadata },
                assetIds: old?.assetIds || [],
                projectId: old?.projectId || null,
                legacyDraft: true,
              },
              post.id,
              old?.version,
            );
        }
        const { drafts, ...state } = next;
        set("legacy", state);
      });
    }
    if (!setting("legacy-migrated", false)) {
      let state = { drafts: [], accounts: [], jobs: [] };
      try {
        const original = await readFile(join(directory, "state.json"), "utf8");
        state = JSON.parse(original);
        for (const key of ["drafts", "accounts", "jobs"])
          if (!Array.isArray(state[key]))
            throw failure("旧数据格式不完整，迁移已停止");
        await writeFile(join(directory, "state.pre-sqlite.json"), original, {
          flag: "wx",
        }).catch((e) => {
          if (e.code !== "EEXIST") throw e;
        });
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      transaction(() => {
        for (const draft of state.drafts)
          save(
            "document",
            { ...fromLegacy(draft), legacyDraft: true },
            draft.id,
          );
        const { drafts, ...legacy } = state;
        set("legacy", legacy);
        set("legacy-migrated", true);
      });
    }
    return {
      directory,
      db,
      get,
      list,
      save,
      saveDocument,
      remove,
      snapshot,
      transaction,
      setting,
      set,
      legacyRead,
      legacyWrite,
      close: () => db.close(),
    };
  } catch (error) {
    db.close();
    throw error;
  }
}
