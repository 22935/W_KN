export type DocumentKind = "article" | "note" | "paper" | "diagram";
export interface DocumentMetadata {
  date?: string;
  category?: string;
  source?: string;
  cover?: string;
  featured?: boolean;
  sample?: boolean;
  publicId?: string;
  doi?: string;
  authors?: string;
  year?: string;
  overview?: string;
  structure?: string;
  reading?: string;
}
export interface ContentDocument {
  id: string;
  schemaVersion: number;
  version: number;
  title: string;
  kind: DocumentKind;
  body: string;
  format: "markdown" | "mermaid";
  description: string;
  tags: string[];
  status: "draft" | "ready" | "archived";
  projectId: string | null;
  assetIds: string[];
  metadata: DocumentMetadata;
  createdAt: string;
  updatedAt: string;
  legacyDraft?: boolean;
  publishedVersion?: number;
}
export interface Entity {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}
export const SCHEMA_VERSION: number;
export const kinds: DocumentKind[];
export interface ContentBlock {
  id: string;
  schemaVersion: 1;
  type:
    | "paragraph"
    | "heading"
    | "code"
    | "image"
    | "formula"
    | "table"
    | "quote"
    | "mermaid"
    | "drawing"
    | "callout"
    | "raw";
  text?: string;
  attributes: Record<string, unknown>;
  children: ContentBlock[];
}
export interface Annotation {
  documentId: string;
  documentVersion: number;
  locator:
    | { kind: "layer"; layer: "overview" | "structure" | "reading" }
    | {
        kind: "pdf";
        page: number;
        quote?: string;
        rect?: [number, number, number, number];
      };
  body: string;
}
