import { z } from "zod";
export const SCHEMA_VERSION = 1;
export const kinds = ["article", "note", "paper", "diagram"];
const text = z.string().max(2000000);
export const documentSchema = z.object({
  title: z.string().trim().min(1, "请填写标题").max(200),
  kind: z.enum(kinds).default("article"),
  body: text.default(""),
  format: z.enum(["markdown", "mermaid"]).default("markdown"),
  description: z.string().max(500).default(""),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  status: z.enum(["draft", "ready", "archived"]).default("draft"),
  projectId: z.string().max(100).nullable().default(null),
  assetIds: z.array(z.string().uuid()).max(200).default([]),
  metadata: z
    .object({
      date: z.string().max(30).optional(),
      category: z.string().max(60).optional(),
      source: z.string().max(2000).optional(),
      cover: z.string().max(2000).optional(),
      featured: z.boolean().optional(),
      sample: z.boolean().optional(),
      publicId: z.string().max(100).optional(),
      doi: z.string().max(200).optional(),
      authors: z.string().max(1000).optional(),
      year: z.string().max(10).optional(),
      overview: text.optional(),
      structure: text.optional(),
      reading: text.optional(),
    })
    .default({}),
});
export const projectSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(1000).default(""),
});
export const templateSchema = z.object({
  title: z.string().trim().min(1).max(100),
  kind: z.enum(["prompt", "mermaid", "writing"]).default("prompt"),
  body: text,
  description: z.string().max(500).default(""),
});
export const taskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  action: z.enum(["polish", "translate", "summary"]).default("polish"),
  documentId: z.string().nullable().default(null),
  inputVersion: z.number().int().positive().nullable().default(null),
  input: text.default(""),
  prompt: text.default(""),
  result: text.default(""),
  status: z.enum(["pending", "manual-complete"]).default("pending"),
});
export const siteSchema = z.object({
  name: z.string().trim().min(1).max(40),
  englishName: z.string().trim().min(1).max(60),
  description: z.string().max(300),
});
// Versioned contracts for later block editing and anchored paper annotations.
export const blockSchema = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    schemaVersion: z.literal(1),
    type: z.enum([
      "paragraph",
      "heading",
      "code",
      "image",
      "formula",
      "table",
      "quote",
      "mermaid",
      "drawing",
      "callout",
      "raw",
    ]),
    text: text.optional(),
    attributes: z.record(z.unknown()).default({}),
    children: z.array(blockSchema).default([]),
  }),
);
export const annotationSchema = z.object({
  documentId: z.string().uuid(),
  documentVersion: z.number().int().positive(),
  locator: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("layer"),
      layer: z.enum(["overview", "structure", "reading"]),
    }),
    z.object({
      kind: z.literal("pdf"),
      page: z.number().int().positive(),
      quote: z.string().max(10000).optional(),
      rect: z
        .tuple([
          z.number().min(0).max(1),
          z.number().min(0).max(1),
          z.number().min(0).max(1),
          z.number().min(0).max(1),
        ])
        .optional(),
    }),
  ]),
  body: text,
});
export function toLegacy(doc, assets = []) {
  let body = doc.body;
  for (const asset of assets) {
    if (!asset.mime?.startsWith("image/")) continue;
    body = body.replaceAll(
      `/api/v1/assets/${asset.id}/file`,
      `/images/imported/${asset.key.replace("public:", "")}`,
    );
  }
  return {
    ...doc.metadata,
    title: doc.title,
    body,
    description: doc.description,
    tags: doc.tags,
    id: doc.id,
    date: doc.metadata.date || doc.createdAt.slice(0, 10),
    category: doc.metadata.category || "技术探索",
    updatedAt: doc.updatedAt,
  };
}
export function fromLegacy(post) {
  return documentSchema.parse({
    title: post.title,
    body: post.body,
    description: post.description || "",
    tags: post.tags || [],
    metadata: {
      date: post.date,
      category: post.category,
      source: post.source,
      cover: post.cover,
      featured: post.featured,
      sample: post.sample,
      publicId: post.publicId,
    },
  });
}
