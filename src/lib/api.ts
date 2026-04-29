const appBase = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${appBase}/api${normalized}`;
}
