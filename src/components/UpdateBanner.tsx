import { RefreshCw, Info, X, Download, LoaderCircle } from 'lucide-react';
import type { Updater } from '../lib/updater';

/** 顶栏下面的新版本横幅：桌面端可以应用内下载安装，网页版跳 GitHub */
export default function UpdateBanner({ u }: { u: Updater }) {
    if (!u.info) return null;
    return (
        <div className="fixed left-0 right-0 z-40 bg-primary text-on-primary text-xs font-label" style={{ top: 'calc(64px + env(safe-area-inset-top, 0px))' }}>
            {/* 进度条（下载中时显示） */}
            {u.downloading && (
                <div className="h-0.5 bg-on-primary/20">
                    <div
                        className="h-full bg-on-primary transition-all duration-300"
                        style={{ width: `${u.progress}%` }}
                    />
                </div>
            )}
            <div className="flex items-center justify-between px-6 py-2">
                <span className="flex items-center gap-1.5">
                    <Info size={16} />
                    新版本 <strong>{u.info.version}</strong> 已发布！
                </span>
                <div className="flex items-center gap-3">
                    {u.canInstall ? (
                        /* Tauri 桌面端：下载安装 */
                        u.installed ? (
                            <button
                                onClick={u.relaunch}
                                className="flex items-center gap-1 font-semibold underline underline-offset-2 hover:opacity-80"
                            >
                                <RefreshCw size={14} /> 重启以完成更新
                            </button>
                        ) : u.downloading ? (
                            <span className="flex items-center gap-1 opacity-80">
                                <LoaderCircle size={14} className="animate-spin" />
                                {u.progress > 0 ? `${u.progress}%` : '准备下载…'}
                            </span>
                        ) : (
                            <button
                                onClick={u.install}
                                className="flex items-center gap-1 font-semibold underline underline-offset-2 hover:opacity-80"
                            >
                                <Download size={14} /> 立即下载安装
                            </button>
                        )
                    ) : (
                        /* Web 版：跳转 GitHub */
                        <a
                            href={u.info.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline underline-offset-2 hover:opacity-80"
                        >查看更新内容</a>
                    )}
                    <button onClick={u.dismiss} className="opacity-70 hover:opacity-100 transition-opacity">
                        <X size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
