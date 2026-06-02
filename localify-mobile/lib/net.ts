// Low-level networking helpers shared by the connection store and hooks.
// Kept free of store imports so it can be imported anywhere without cycles.

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('http') ? trimmed : `http://${trimmed}`;
}

// AbortSignal.timeout() isn't available in Hermes; use AbortController instead.
export async function fetchWithTimeout(
  input: RequestInfo,
  timeoutMs: number,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Probe a candidate server by hitting a cheap endpoint. Returns true if it
// answers with a 2xx within the timeout.
export async function probeServer(baseUrl: string, timeoutMs = 4000): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${baseUrl}/api/tracks`, timeoutMs);
    return res.ok;
  } catch {
    return false;
  }
}
