import type { ContentDocument } from "@yanshan/content";
export type { ContentDocument };
export interface BaseEntity {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface Asset extends BaseEntity {
  name: string;
  mime: string;
  size: number;
  origin: string;
}
export interface Project extends BaseEntity {
  name: string;
  description: string;
}
export interface Template extends BaseEntity {
  title: string;
  kind: "prompt" | "mermaid" | "writing";
  body: string;
  description: string;
}
export interface Task extends BaseEntity {
  title: string;
  action: "polish" | "translate" | "summary";
  documentId: string | null;
  inputVersion: number | null;
  input: string;
  prompt: string;
  result: string;
  status: "pending" | "manual-complete";
}
export interface State {
  schemaVersion: number;
  documents: ContentDocument[];
  assets: Asset[];
  projects: Project[];
  templates: Template[];
  tasks: Task[];
  site: { name: string; englishName: string; description: string };
  capabilities: Record<string, unknown>;
  git: { ready: boolean; status: string; hasRemote: boolean };
}
export interface ViewProps {
  state: State;
  reload: () => Promise<void>;
  notify: (text: string) => void;
  open: (doc: ContentDocument) => void;
}
export const kindLabels = {
  article: "文章",
  note: "笔记",
  paper: "论文",
  diagram: "图解",
};
