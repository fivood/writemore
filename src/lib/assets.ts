/**
 * 解析 public/ 目录下的静态资源路径，同时兼容：
 * - Vite 本地开发 (/writemore/)
 * - GitHub Pages 部署 (/writemore/)
 * - Tauri 桌面端 (根目录 /)
 */
export function publicAsset(relPath: string): string {
  const clean = relPath.replace(/^\/+/, '');
  if (typeof window !== 'undefined') {
    const isTauri = '__TAURI_INTERNALS__' in window;
    if (isTauri || !window.location.pathname.startsWith('/writemore')) {
      return `./${clean}`;
    }
  }
  return `${import.meta.env.BASE_URL}${clean}`;
}
