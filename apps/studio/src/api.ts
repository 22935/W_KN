const fragment = new URLSearchParams(location.hash.slice(1));
const token = fragment.get("token");
if (token) {
  sessionStorage.setItem("wkn-session", token);
  history.replaceState(null, "", location.pathname + location.search);
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T = unknown>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch("/api" + path, {
    method,
    headers: {
      Authorization: `Bearer ${sessionStorage.getItem("wkn-session") || ""}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response
    .json()
    .catch(() => ({ error: "服务返回了无法读取的内容" }));
  if (!response.ok)
    throw new ApiError(
      data.error || `请求失败 ${response.status}`,
      response.status,
    );
  return data;
}
export async function download(path: string, name: string) {
  const response = await fetch("/api" + path, {
    headers: {
      Authorization: `Bearer ${sessionStorage.getItem("wkn-session") || ""}`,
    },
  });
  if (!response.ok) throw new Error("下载失败，请检查连接");
  const blob = await response.blob();
  downloadBlob(blob, name);
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function upload(file: File) {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return api<import("./types").Asset>("/v1/assets", "POST", {
    name: file.name,
    base64,
  });
}
export function errorText(error: unknown) {
  return error instanceof Error ? error.message : "操作失败，请重试";
}
