export interface FetchWithAbortOptions extends RequestInit { timeout?: number }

export async function fetchWithAbort(url: string, options: FetchWithAbortOptions = {}): Promise<Response> {
  const { timeout = 8000, ...rest } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...rest, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}


