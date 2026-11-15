import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  unlink,
  rename,
  access,
} from "node:fs/promises";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { DatabaseSync } from "node:sqlite";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function exportBackup(platform) {
  const snapshot = join(platform.directory, `snapshot-${randomUUID()}.sqlite`);
  platform.db.exec(`VACUUM INTO '${snapshot.replaceAll("'", "''")}'`);
  try {
    const entries = {
      "yanshan.sqlite": new Uint8Array(await readFile(snapshot)),
    };
    async function collect(path, prefix) {
      for (const entry of await readdir(path, { withFileTypes: true }).catch(
        (e) => {
          if (e.code === "ENOENT") return [];
          throw e;
        },
      )) {
        if (entry.isSymbolicLink()) continue;
        const relative = `${prefix}/${entry.name}`;
        if (entry.isDirectory())
          await collect(join(path, entry.name), relative);
        else if (entry.isFile())
          entries[relative] = new Uint8Array(
            await readFile(join(path, entry.name)),
          );
      }
    }
    await collect(join(platform.directory, "assets"), "assets");
    await collect(join(platform.directory, "deliveries"), "deliveries");
    const manifest = {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      files: Object.fromEntries(
        Object.entries(entries).map(([key, bytes]) => [
          key,
          { size: bytes.length, sha256: hash(bytes) },
        ]),
      ),
      excludes: ["profiles", "migration", "repository-public-assets"],
    };
    entries["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
    return Buffer.from(zipSync(entries));
  } finally {
    await unlink(snapshot);
  }
}
export async function restoreBackup(directory, filename) {
  await mkdir(directory, { recursive: true });
  const raw = await readFile(filename);
  if (raw.length > 250_000_000) throw new Error("备份包超过 250 MB");
  let total = 0;
  const entries = unzipSync(raw, {
    filter: (file) => {
      total += file.originalSize;
      if (total > 500_000_000) throw new Error("备份解压大小超限");
      return true;
    },
  });
  const manifest = JSON.parse(
    strFromU8(entries["manifest.json"] || new Uint8Array()),
  );
  if (
    manifest.schemaVersion !== 1 ||
    !manifest.files ||
    !entries["yanshan.sqlite"]
  )
    throw new Error("不支持的备份格式");
  for (const [key, info] of Object.entries(manifest.files)) {
    if (
      (key !== "yanshan.sqlite" &&
        !/^(assets|deliveries)\/[a-zA-Z0-9_.\/-]+$/.test(key)) ||
      key.split("/").some((p) => p === ".." || p === "")
    )
      throw new Error("备份路径无效");
    const bytes = entries[key];
    if (!bytes || bytes.length !== info.size || hash(bytes) !== info.sha256)
      throw new Error("备份完整性校验失败");
  }
  if (!manifest.files["yanshan.sqlite"]) throw new Error("缺少数据库清单");
  const temp = join(directory, `restore-${randomUUID()}.sqlite`);
  await writeFile(temp, entries["yanshan.sqlite"]);
  try {
    const probe = new DatabaseSync(temp);
    try {
      if (
        probe.prepare("PRAGMA integrity_check").get().integrity_check !==
          "ok" ||
        probe.prepare("PRAGMA user_version").get().user_version !== 1
      )
        throw new Error("数据库校验失败");
    } finally {
      probe.close();
    }
    const current = join(directory, "yanshan.sqlite");
    try {
      await access(current);
      const old = new DatabaseSync(current);
      try {
        old.exec("PRAGMA wal_checkpoint(TRUNCATE)");
        old.exec(
          `VACUUM INTO '${join(directory, `pre-restore-${Date.now()}.sqlite`).replaceAll("'", "''")}'`,
        );
      } finally {
        old.close();
      }
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    for (const [key] of Object.entries(manifest.files)) {
      if (key === "yanshan.sqlite") continue;
      const segments = key.split("/");
      const name = segments.pop();
      const folder = join(directory, ...segments);
      await mkdir(folder, { recursive: true });
      await writeFile(join(folder, name), entries[key]);
    }
    for (const suffix of ["-wal", "-shm"])
      await unlink(current + suffix).catch((e) => {
        if (e.code !== "ENOENT") throw e;
      });
    await rename(temp, current);
  } finally {
    await unlink(temp).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
  }
}
