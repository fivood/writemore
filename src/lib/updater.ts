import { useEffect, useState } from 'react';
import type { Update } from '@tauri-apps/plugin-updater';
import { dayKey } from './util';

declare const __APP_VERSION__: string;
export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
const GITHUB_REPO = 'fivood/writemore';
const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const WEB_CHECK_KEY = 'update_last_check';

export interface UpdateInfo {
  version: string;
  /** Release 页面；桌面端能应用内安装时为空 */
  url: string;
}

/** 桌面端先问 Tauri 插件（能应用内安装），没有就查 GitHub 最新 Release。网络错误会抛出 */
async function checkForUpdate(): Promise<{ info: UpdateInfo; tauri?: Update } | null> {
  if (IS_TAURI) {
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) return { info: { version: update.version, url: '' }, tauri: update };
    } catch { /* latest.json 不存在或网络错误，走 GitHub */ }
  }
  const r = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!r.ok) return null;
  const data = await r.json();
  if (!IS_TAURI) localStorage.setItem(WEB_CHECK_KEY, dayKey());
  return (data.tag_name as string).replace(/^v/, '') !== APP_VERSION
    ? { info: { version: data.tag_name, url: data.html_url } }
    : null;
}

export function useUpdater(showToast: (msg: string) => void) {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [installed, setInstalled] = useState(false);
  const [tauri, setTauri] = useState<Update | null>(null);

  function found(r: Awaited<ReturnType<typeof checkForUpdate>>) {
    if (!r) return false;
    setTauri(r.tauri ?? null);
    setInfo(r.info);
    return true;
  }

  // 启动后自动检查：桌面端每次，网页版每天一次；失败不打扰
  useEffect(() => {
    if (!IS_TAURI && localStorage.getItem(WEB_CHECK_KEY) === dayKey()) return;
    const timer = setTimeout(() => { checkForUpdate().then(found).catch(() => {}); }, IS_TAURI ? 3000 : 0);
    return () => clearTimeout(timer);
  }, []);

  async function install() {
    if (!tauri) return;
    setDownloading(true);
    setProgress(0);
    try {
      let downloaded = 0;
      let total = 0;
      await tauri.downloadAndInstall(event => {
        if (event.event === 'Started') total = event.data.contentLength ?? 0;
        else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          if (total > 0) setProgress(Math.round(downloaded / total * 100));
        } else {
          setInstalled(true);
          setDownloading(false);
        }
      });
    } catch {
      showToast('更新下载失败，请前往 GitHub 手动下载');
      setDownloading(false);
    }
  }

  async function relaunch() {
    try {
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch {
      showToast('请手动重启应用以完成更新');
    }
  }

  /** 顶栏按钮：已发现更新就直接装/打开 Release 页，否则手动查一次 */
  async function manualCheck() {
    if (checking || downloading) return;
    if (info && tauri) { void install(); return; }
    if (info?.url) { window.open(info.url, '_blank', 'noopener,noreferrer'); return; }
    setChecking(true);
    try {
      if (!found(await checkForUpdate())) showToast('✅ 已是最新版本');
    } catch {
      showToast('检查更新失败，请检查网络连接');
    } finally {
      setChecking(false);
    }
  }

  return {
    info, checking, downloading, progress, installed,
    canInstall: !!tauri,
    install, relaunch, manualCheck,
    dismiss: () => setInfo(null),
  };
}

export type Updater = ReturnType<typeof useUpdater>;
