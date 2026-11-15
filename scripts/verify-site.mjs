import { readdir, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
const root = fileURLToPath(new URL("../", import.meta.url));
let published = 0;
for (const file of await readdir(join(root, "src/content/posts"))) {
  if (!file.endsWith(".md")) continue;
  const { data } = matter(
    await readFile(join(root, "src/content/posts", file), "utf8"),
  );
  const output = join(root, "dist/posts", file.slice(0, -3), "index.html");
  if (data.draft) {
    try {
      await access(output);
    } catch {
      continue;
    }
    throw new Error(`私有草稿被构建：${file}`);
  }
  try {
    await access(output);
  } catch {
    throw new Error(`公开文章缺失，停止部署：${file}`);
  }
  published++;
}
console.log(`公开内容检查通过：${published} 篇文章完整生成，草稿未生成页面。`);
