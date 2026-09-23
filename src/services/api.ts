export const API_BASE = (import.meta.env.VITE_API_BASE || 'https://animeworld-india-api-njtl.onrender.com').replace(/\/$/, '');

export function apiUrl(path: string): string {
  if (!path) return path;
  if (path.startsWith('/api')) {
    if (API_BASE) {
      return `${API_BASE}${path}`;
    }
    return `https://animeworld-india-api-njtl.onrender.com${path}`;
  }
  if (path.startsWith('/')) {
    return `${API_BASE}${path}`;
  }
  return path;
}

export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(input), init as any);
}
