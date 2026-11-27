import {
    Sparkles, Landmark, Star, BookOpen, Bot, Cloud, RefreshCw, Moon, Sun,
    PencilLine, Download, LoaderCircle, Flame, Home, Volume2, VolumeX,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useStore } from './store';
import { db } from './db';
import { supabase, SUPABASE_ENABLED } from './services/supabase';
import { backToHome, exitWriting, saveDraft } from './lib/session';
import { migrateLegacyData } from './lib/drafts';
import { syncWithCloud } from './lib/cloudSync';
import { APP_VERSION, useUpdater } from './lib/updater';
import { countChars, dayKey, hasMeaningfulContent } from './lib/util';
import { preloadTypewriterAudio, unlockTypewriterAudio, playBell } from './lib/soundEngine';
import HomeModes from './components/HomeModes';
import WritingView from './components/WritingView';
import UpdateBanner from './components/UpdateBanner';
import AiSettingsModal from './components/AiSettingsModal';
import CloudLoginModal from './components/CloudLoginModal';
import HistoryPage from './components/HistoryPage';
import FavoritesPage from './components/FavoritesPage';
import InspirationPalace from './components/InspirationPalace';
import AcornIcon from './components/AcornIcon';

export default function App() {
    const store = useStore();
    const [showAiSettings, setShowAiSettings] = useState(false);
    const [showCloudLogin, setShowCloudLogin] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [todayOtherDraftsWords, setTodayOtherDraftsWords] = useState(0);
    const updater = useUpdater(store.showToast);

    // Theme
    useEffect(() => {
        const el = document.documentElement;

        const apply = (t: string) => {
            const dark = t === 'dark';
            el.classList.toggle('dark', dark);
            el.setAttribute('data-color-mode', dark ? 'dark' : 'light');

            const themeMeta = document.querySelector('meta[name="theme-color"]');
            if (themeMeta) themeMeta.setAttribute('content', dark ? '#121110' : '#f3efe6');

            el.style.colorScheme = dark ? 'dark' : 'light';

            const appleStatus = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
            if (appleStatus) appleStatus.setAttribute('content', dark ? 'black-translucent' : 'default');
        };

        apply(store.theme);
    }, [store.theme]);

    useEffect(() => {
        preloadTypewriterAudio();
        const s = useStore.getState();
        s.updateStreak();
        void migrateLegacyData();
        // 打开时总在首页。上次没存的内容先存进宫殿，免得下次进模式时被清掉。
        if (hasMeaningfulContent(s.editorContent)) {
            void saveDraft().then(() => {
                useStore.getState().setEditorTitle('');
                useStore.getState().setEditorContent('');
            });
        }
    }, []);

    async function sync(userId: string) {
        if (!SUPABASE_ENABLED) return;
        setSyncing(true);
        try {
            await syncWithCloud(userId);
        } catch (e) {
            console.error('Cloud sync failed', e);
        } finally {
            setSyncing(false);
        }
    }

    // Cloud auth 初始化
    useEffect(() => {
        if (!SUPABASE_ENABLED) return;
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                store.setCloudUser({ id: session.user.id, email: session.user.email! });
                void sync(session.user.id);
            }
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                store.setCloudUser({ id: session.user.id, email: session.user.email! });
            } else {
                store.setCloudUser(null);
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    // 限时写作计时
    useEffect(() => {
        if (!store.timerActive) return;
        const id = setInterval(() => {
            const s = useStore.getState();
            const next = s.timerSeconds + 1;
            if (next >= s.timerDuration * 60) {
                s.setTimerActive(false);
                s.setTimerSeconds(0);
                playBell();
                s.showToast('⏰ 时间到！写得不错~');
            } else {
                s.setTimerSeconds(next);
            }
        }, 1000);
        return () => clearInterval(id);
    }, [store.timerActive]);

    // 今天其他稿子的字数（当前这篇按编辑器实时算）
    useEffect(() => {
        let cancelled = false;
        db.drafts.toArray().then(drafts => {
            const today = dayKey();
            const total = drafts
                .filter(d => !d.deletedFromPalace && d.id !== store.currentDraftId && dayKey(d.updatedAt) === today)
                .reduce((sum, d) => sum + (d.wordCount || 0), 0);
            if (!cancelled) setTodayOtherDraftsWords(total);
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [store.currentDraftId, store.activeTab, store.writingMode]);

    function handleTopTabChange(tab: string) {
        if (tab === 'inspire' && store.activeTab !== 'inspire') exitWriting();
        store.setActiveTab(tab);
    }

    function handleToggleSound() {
        const next = !store.soundEnabled;
        store.setSoundEnabled(next);
        if (next) {
            void unlockTypewriterAudio().then(() => playBell());
            store.showToast('🔔 打字机机械声效已开启');
        } else {
            store.showToast('🔕 打字机声效已静音');
        }
    }

    const todayWords = todayOtherDraftsWords + countChars(store.editorContent);
    const isWriting = store.writingMode !== null && store.activeTab === 'inspire';

    return (
        <div className="text-on-surface font-body selection:bg-primary-container selection:text-on-primary-container min-h-screen">
            {/* Top Masthead Bar */}
            <header className="fixed top-0 left-0 right-0 z-50 glass-panel bg-background/95 dark:bg-[#141210]/95 border-b border-on-surface/25 flex justify-between items-center px-4 md:px-8 h-14 max-w-full safe-area-top">
                <button
                    onClick={isWriting ? backToHome : () => handleTopTabChange('inspire')}
                    className="flex items-center gap-2.5 text-left group cursor-pointer"
                >
                    <AcornIcon size={26} className="text-primary group-hover:text-primary-dim transition-colors" />
                    <div className="flex items-baseline gap-2">
                        <span className="text-base md:text-lg font-bold text-on-surface font-headline tracking-tight">
                            灵感是橡果
                        </span>
                        <span className="text-[11px] font-mono text-outline hidden sm:inline tracking-wider">
                            v{APP_VERSION}
                        </span>
                    </div>
                </button>

                <nav className="hidden md:flex items-center gap-1 h-full font-label text-sm">
                    {isWriting && (
                        <button
                            onClick={backToHome}
                            className="h-full px-3.5 flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                        >
                            <Home size={16} />
                            <span>首页</span>
                        </button>
                    )}
                    {[
                        { tab: 'inspire', label: '灵感', Icon: Sparkles },
                        { tab: 'palace', label: '灵感宫殿', Icon: Landmark },
                        { tab: 'favorites', label: '收藏', Icon: Star },
                        { tab: 'history', label: '历史', Icon: BookOpen },
                    ].map(item => {
                        const active = store.activeTab === item.tab;
                        return (
                            <button
                                key={item.tab}
                                onClick={() => handleTopTabChange(item.tab)}
                                className={`h-full px-3.5 flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                                    active
                                        ? 'border-primary text-on-surface font-semibold'
                                        : 'border-transparent text-on-surface-variant hover:text-on-surface'
                                }`}
                            >
                                <item.Icon size={16} className={active ? 'text-primary' : ''} />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </nav>

                <div className="flex items-center gap-1">
                    {/* 打字机机械声效开关 */}
                    <button
                        onClick={handleToggleSound}
                        title={store.soundEnabled ? '打字机声效：开启（点击静音）' : '打字机声效：静音（点击开启）'}
                        className={`p-2 rounded-sm hover:bg-surface-container-high transition-colors cursor-pointer ${
                            store.soundEnabled ? 'text-secondary' : 'text-outline'
                        }`}
                    >
                        {store.soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                    </button>

                    {/* 检查更新按钮 */}
                    <button
                        onClick={updater.manualCheck}
                        title={updater.info ? `发现新版本 ${updater.info.version}，点击下载安装` : `检查更新（当前 v${APP_VERSION}）`}
                        disabled={updater.checking || updater.downloading}
                        className={`p-2 rounded-sm hover:bg-surface-container-high transition-colors disabled:opacity-50 cursor-pointer ${
                            updater.info ? 'text-primary animate-pulse' : 'text-on-surface-variant'
                        }`}
                    >
                        {updater.checking
                            ? <LoaderCircle size={18} className="animate-spin" />
                            : <Download size={18} />}
                    </button>

                    <button
                        onClick={() => setShowAiSettings(true)}
                        title="AI 设置"
                        className={`p-2 rounded-sm hover:bg-surface-container-high transition-colors cursor-pointer ${
                            store.aiEnabled ? 'text-primary' : 'text-on-surface-variant'
                        }`}
                    >
                        <Bot size={18} />
                    </button>

                    {/* 云同步按钮 */}
                    <button
                        onClick={() => store.cloudUser ? (void sync(store.cloudUser.id), store.showToast('☁️ 同步中…')) : setShowCloudLogin(true)}
                        title={store.cloudUser ? `已登录: ${store.cloudUser.email}（点击同步）` : '登录云同步'}
                        className={`p-2 rounded-sm hover:bg-surface-container-high transition-colors relative cursor-pointer ${
                            store.cloudUser ? 'text-primary' : 'text-on-surface-variant'
                        }`}
                    >
                        {syncing ? <RefreshCw size={18} className="animate-spin" /> : <Cloud size={18} />}
                    </button>

                    <button
                        onClick={() => store.setTheme(store.theme === 'dark' ? 'light' : 'dark')}
                        title={store.theme === 'dark' ? '切换到暖棉浅色' : '切换到暗房深色'}
                        className="p-2 rounded-sm hover:bg-surface-container-high transition-colors text-on-surface-variant cursor-pointer"
                    >
                        {store.theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                    </button>
                </div>
            </header>

            <UpdateBanner u={updater} />

            {/* Mobile bottom tab bar */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-panel bg-background/95 dark:bg-[#121110]/95 border-t border-outline-variant/55 flex justify-around items-center h-14 safe-area-bottom">
                {[
                    { tab: 'inspire', Icon: Sparkles, label: '灵感' },
                    { tab: 'palace', Icon: Landmark, label: '宫殿' },
                    { tab: 'favorites', Icon: Star, label: '收藏' },
                    { tab: 'history', Icon: BookOpen, label: '历史' },
                ].map(t => {
                    const isHomeBtn = isWriting && t.tab === 'inspire';
                    const BtnIcon = isHomeBtn ? Home : t.Icon;
                    const active = store.activeTab === t.tab;
                    return (
                        <button
                            key={t.tab}
                            onClick={isHomeBtn ? backToHome : () => handleTopTabChange(t.tab)}
                            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                                active ? 'text-primary font-semibold' : 'text-on-surface-variant'
                            }`}
                        >
                            <BtnIcon size={20} />
                            <span className="text-[11px] font-label mt-0.5">{isHomeBtn ? '首页' : t.label}</span>
                        </button>
                    );
                })}
            </nav>

            <div
                className="flex h-screen h-[100dvh] pb-[56px] md:pb-[40px]"
                style={{ paddingTop: 'calc(56px + env(safe-area-inset-top, 0px))' }}
            >
                {store.activeTab === 'inspire' && (isWriting ? <WritingView /> : <HomeModes />)}
                {store.activeTab === 'palace' && <InspirationPalace />}
                {store.activeTab === 'history' && <HistoryPage />}
                {store.activeTab === 'favorites' && <FavoritesPage />}
            </div>

            {/* 底栏 */}
            <footer className="hidden md:flex fixed bottom-0 left-0 right-0 z-50 bg-background/92 dark:bg-[#121110]/94 glass-panel border-t border-outline-variant/55 justify-between items-center px-8 w-full h-[38px]">
                <div className="flex items-center gap-5 text-xs font-label text-on-surface-variant">
                    <div className="flex items-center gap-1.5">
                        <Flame size={13} className="text-primary" />
                        <span>连续打卡 <strong className="text-primary">{store.streak}</strong> 天</span>
                    </div>
                    <span className="text-outline-variant">·</span>
                    <div className="flex items-center gap-1.5">
                        <PencilLine size={13} className="text-secondary" />
                        <span>今日字数 <strong className="text-on-surface">{todayWords}</strong></span>
                    </div>
                </div>
                <div className="text-xs font-label text-outline">
                    今天你写了吗
                </div>
            </footer>

            {store.toast && (
                <div className="fixed bottom-16 md:bottom-14 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface border border-secondary/50 shadow-xl px-5 py-2.5 rounded-sm font-label text-xs tracking-wide z-[100] animate-toast-in">
                    {store.toast}
                </div>
            )}

            <AiSettingsModal isOpen={showAiSettings} onClose={() => setShowAiSettings(false)} />
            <CloudLoginModal
                isOpen={showCloudLogin}
                onClose={() => setShowCloudLogin(false)}
                showToast={store.showToast}
                syncFromCloud={sync}
                cloudSyncing={syncing}
            />
        </div>
    );
}
