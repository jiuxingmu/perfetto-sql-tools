const appBase = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');

/**
 * 与 Vite `base`（即 import.meta.env.BASE_URL）一致，供 BrowserRouter basename 使用。
 * 根路径部署时返回 undefined，子路径如 /perfetto/ 构建后返回 /perfetto。
 */
export function getRouterBasename(): string | undefined {
  const b = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  return b === '' ? undefined : b;
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${appBase}/api${normalized}`;
}
