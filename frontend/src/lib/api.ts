export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Only send Content-Type: application/json when there's actually a body -
  // Fastify's JSON body parser rejects a request that declares this
  // content type but has an empty body with a 400, which silently broke
  // every bodyless POST/PATCH/DELETE call (logout, block/unblock, deletes).
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    ...(init?.body !== undefined ? { headers: { "Content-Type": "application/json" } } : {}),
    ...init,
  });

  if (!res.ok) {
    let message = `Ошибка запроса (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.error === "string") message = body.error;
    } catch {
      // ignore parse errors, keep default message
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function upload<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`/api${path}`, { method: "POST", credentials: "include", body: formData });

  if (!res.ok) {
    let message = `Ошибка запроса (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.error === "string") message = body.error;
    } catch {
      // ignore parse errors, keep default message
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

/** POSTs without a body and saves the response as a file download (filename taken from Content-Disposition). */
async function downloadPost(path: string, fallbackName: string): Promise<void> {
  const res = await fetch(`/api${path}`, { method: "POST", credentials: "include" });
  if (!res.ok) {
    let message = `Ошибка запроса (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.error === "string") message = body.error;
    } catch {
      // keep default message
    }
    throw new ApiError(res.status, message);
  }

  let filename = fallbackName;
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (match) {
    try {
      filename = decodeURIComponent(match[1]);
    } catch {
      // keep fallback
    }
  }

  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "DELETE", body: body ? JSON.stringify(body) : undefined }),
  upload,
  downloadPost,
};
