export type CanvasBlockType =
  | "paragraph"
  | "heading"
  | "formula"
  | "code"
  | "callout"
  | "mermaid"
  | "image"
  | "raw";
export interface CanvasBlock {
  id: string;
  type: CanvasBlockType;
  source: string;
  /** Transient editing fields retain intentional trailing newlines in inputs. */
  fields?: BlockFields;
  separator?: string;
}
export interface BlockFields {
  text: string;
  language?: string;
  level?: number;
}
export function splitMarkdown(source: string): CanvasBlock[];
export function joinBlocks(blocks: CanvasBlock[]): string;
export function createBlock(type: CanvasBlockType): CanvasBlock;
export function readBlock(block: CanvasBlock): BlockFields;
export function editBlock(
  block: CanvasBlock,
  fields: Partial<BlockFields>,
): CanvasBlock;
export function separateBlocks(blocks: CanvasBlock[]): CanvasBlock[];
export function moveBlock(
  blocks: CanvasBlock[],
  activeId: string,
  overId: string,
): CanvasBlock[];
