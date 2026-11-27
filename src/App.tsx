import { Sparkles, Landmark, Star, BookOpen, Bot, Cloud, RefreshCw, Moon, Sun, PencilLine, Download, LoaderCircle, Flame, Home } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useStore } from './store';
import { db } from './db';
import { supabase, SUPABASE_ENABLED } from './services/supabase';
import { backToHome, exitWriting, saveDraft } from './lib/session';
import { migrateLegacyDrafts } from './lib/drafts';
import { syncWithCloud } from './lib/cloudSync';
import { APP_VERSION, useUpdater } from './lib/updater';
import { countChars, dayKey, hasMeaningfulContent } from './lib/util';
import HomeModes from './components/HomeModes';
import WritingView from './components/WritingView';
import UpdateBanner from './components/UpdateBanner';
import AiSettingsModal from './components/AiSettingsModal';
import CloudLoginModal from './components/CloudLoginModal';
import HistoryPage from './components/HistoryPage';
import FavoritesPage from './components/FavoritesPage';
import InspirationPalace from './components/InspirationPalace';

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

            // Keep browser chrome (Android title/nav bars) aligned with in-app theme.
            const themeMeta = document.querySelector('meta[name="theme-color"]');
            if (themeMeta) themeMeta.setAttribute('content', dark ? '#100e0d' : '#fbf9f5');

            // Hint UA form controls / virtual keyboard / scrollbars to follow current theme.
            el.style.colorScheme = dark ? 'dark' : 'light';

            const appleStatus = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
            if (appleStatus) appleStatus.setAttribute('content', dark ? 'black-translucent' : 'default');
        };

        apply(store.theme);
    }, [store.theme]);

    useEffect(() => {
        const s = useStore.getState();
        s.updateStreak();
        void migrateLegacyDrafts();
        // 打开时总在首页（见 store 的 onRehydrateStorage）。上次没存的内容先存进宫殿，
        // 免得下次进模式时被清掉。
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
        // 从别的页回到「灵感」总是落在模式选择
        if (tab === 'inspire' && store.activeTab !== 'inspire') exitWriting();
        store.setActiveTab(tab);
    }

    const todayWords = todayOtherDraftsWords + countChars(store.editorContent);
    const isWriting = store.writingMode !== null && store.activeTab === 'inspire';

    return (
        <div className="bg-background text-on-surface font-body selection:bg-primary-container selection:text-on-primary-container min-h-screen">
            {/* TopNavBar */}
            <header className="fixed top-0 left-0 right-0 z-50 glass-panel bg-surface/70 dark:bg-[#100e0d]/75 border-b border-outline-variant/10 flex justify-between items-center px-4 md:px-8 py-3 md:py-4 max-w-full safe-area-top">
                <div className="flex items-baseline gap-2">
                    <div className="text-lg md:text-xl font-bold text-primary font-headline tracking-tight">灵感是橡果</div>
                    <span className="text-[11px] font-label text-on-surface-variant/50 hidden md:inline">v{APP_VERSION}</span>
                </div>
                <nav className="hidden md:flex space-x-8 items-center font-headline text-base tracking-tight">
                    {isWriting && (
                        <button
                            onClick={backToHome}
                            className="flex items-center space-x-1.5 transition-all duration-300 ease-in-out text-on-surface-variant hover:text-primary"
                        >
                            <Home size={20} />
                            <span>首页</span>
                        </button>
                    )}
                    <button className={`flex items-center space-x-1.5 transition-all duration-300 ease-in-out ${store.activeTab === 'inspire' ? 'text-primary border-b-2 border-primary pb-1 font-bold' : 'text-on-surface-variant hover:text-primary'}`} onClick={() => handleTopTabChange('inspire')}>
                        <Sparkles size={20} />
                        <span>灵感</span>
                    </button>
                    <button className={`flex items-center space-x-1.5 transition-all duration-300 ease-in-out ${store.activeTab === 'palace' ? 'text-primary border-b-2 border-primary pb-1 font-bold' : 'text-on-surface-variant hover:text-primary'}`} onClick={() => handleTopTabChange('palace')}>
                        <Landmark size={20} />
                        <span>灵感宫殿</span>
                    </button>
                    <button className={`flex items-center space-x-1.5 transition-all duration-300 ease-in-out ${store.activeTab === 'favorites' ? 'text-primary border-b-2 border-primary pb-1 font-bold' : 'text-on-surface-variant hover:text-primary'}`} onClick={() => handleTopTabChange('favorites')}>
                        <Star size={20} />
                        <span>收藏</span>
                    </button>
                    <button className={`flex items-center space-x-1.5 transition-all duration-300 ease-in-out ${store.activeTab === 'history' ? 'text-primary border-b-2 border-primary pb-1 font-bold' : 'text-on-surface-variant hover:text-primary'}`} onClick={() => handleTopTabChange('history')}>
                        <BookOpen size={20} />
                        <span>历史</span>
                    </button>
                </nav>
                <div className="flex items-center space-x-1 md:space-x-2">
                    {/* 检查更新按钮 */}
                    <button
                        onClick={updater.manualCheck}
                        title={updater.info ? `发现新版本 ${updater.info.version}，点击下载安装` : `检查更新（当前 v${APP_VERSION}）`}
                        disabled={updater.checking || updater.downloading}
                        className={`p-2 rounded-full hover:bg-surface-container transition-colors disabled:opacity-50 ${
                            updater.info ? 'text-primary animate-pulse' : 'text-on-surface-variant'
                        }`}
                    >
                        {updater.checking
                            ? <LoaderCircle size={22} className="animate-spin" />
                            : <Download size={22} />}
                    </button>
                    <button
                        onClick={() => setShowAiSettings(true)}
                        title="AI 设置"
                        className={`p-2 rounded-full hover:bg-surface-container transition-colors ${store.aiEnabled ? 'text-primary' : 'text-on-surface-variant'}`}
                    >
                        <Bot size={22} />
                    </button>
                    {/* 云同步按钮 */}
                    <button
                        onClick={() => store.cloudUser ? (void sync(store.cloudUser.id), store.showToast('☁️ 同步中…')) : setShowCloudLogin(true)}
                        title={store.cloudUser ? `已登录: ${store.cloudUser.email}（点击同步）` : '登录云同步'}
                        className={`p-2 rounded-full hover:bg-surface-container transition-colors relative ${store.cloudUser ? 'text-primary' : 'text-on-surface-variant'
                            }`}
                    >
                        {syncing ? <RefreshCw size={22} className="animate-spin" /> : <Cloud size={22} />}
                        {syncing && <span className="absolute inset-0 rounded-full animate-spin border-2 border-primary/30 border-t-primary" />}
                    </button>
                    <button
                        onClick={() => store.setTheme(store.theme === 'dark' ? 'light' : 'dark')}
                        title={store.theme === 'dark' ? '切换到浅色' : '切换到深色'}
                        className="p-2 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
                    >
                        {store.theme === 'dark' ? <Moon size={22} /> : <Sun size={22} />}
                    </button>
                </div>
            </header>

            <UpdateBanner u={updater} />

            {/* Mobile bottom tab bar */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-panel bg-surface/90 dark:bg-[#100e0d]/90 border-t border-outline-variant/10 flex justify-around items-center h-14 safe-area-bottom">
                {[
                    { tab: 'inspire', Icon: Sparkles, label: '灵感' },
                    { tab: 'palace', Icon: Landmark, label: '宫殿' },
                    { tab: 'favorites', Icon: Star, label: '收藏' },
                    { tab: 'history', Icon: BookOpen, label: '历史' },
                ].map(t => {
                    const isHomeBtn = isWriting && t.tab === 'inspire';
                    const BtnIcon = isHomeBtn ? Home : t.Icon;
                    return (
                        <button
                            key={t.tab}
                            onClick={isHomeBtn ? backToHome : () => handleTopTabChange(t.tab)}
                            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${store.activeTab === t.tab ? 'text-primary' : 'text-on-surface-variant'}`}
                        >
                            <BtnIcon size={22} />
                            <span className="text-[10px] font-label mt-0.5">{isHomeBtn ? '首页' : t.label}</span>
                        </button>
                    );
                })}
            </nav>

            <div className="flex h-screen h-[100dvh] pb-[56px] md:pb-[45px]" style={{ paddingTop: 'calc(64px + env(safe-area-inset-top, 0px))' }}>
                {store.activeTab === 'inspire' && (isWriting ? <WritingView /> : <HomeModes />)}
                {store.activeTab === 'palace' && <InspirationPalace />}
                {store.activeTab === 'history' && <HistoryPage />}
                {store.activeTab === 'favorites' && <FavoritesPage />}
            </div>

            {/* Footer - hidden on mobile (bottom tab bar used instead) */}
            <footer className="hidden md:flex fixed bottom-0 left-0 right-0 z-50 bg-surface/90 glass-panel border-t border-outline-variant/10 justify-between items-center px-10 py-2 w-full h-[45px]">
                <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-2">
                        <Flame size={14} className="text-primary" />
                        <span className="font-label text-[13px] font-medium text-primary">连续打卡: {store.streak} 天</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <PencilLine size={14} className="text-outline" />
                        <span className="font-label text-[13px] font-medium text-on-surface-variant">今日字数: {todayWords}</span>
                    </div>
                </div>
                <div className="flex items-center space-x-6 text-[13px] font-label font-medium text-stone-400 dark:text-outline">
                    <span className="text-stone-500 dark:text-on-surface-variant">© 今天你写了吗</span>
                </div>
            </footer>

            {store.toast && (
                <div className="fixed bottom-16 left-1/2 -translate-x-1/2 bg-surface-container-high text-on-surface border border-outline/20 shadow-lg px-6 py-3 rounded-full font-label text-sm z-[100] animate-toast-in">
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
