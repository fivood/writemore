import { useState } from 'react';
import { Cloud, X, CheckCircle2, LoaderCircle, RefreshCw, LogOut, CloudOff, Lock } from 'lucide-react';
import { useStore } from '../store';
import { signIn, signOut, SUPABASE_ENABLED } from '../services/supabase';

interface CloudLoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    showToast: (msg: string) => void;
    syncFromCloud: (userId: string) => Promise<void>;
    cloudSyncing: boolean;
}

export default function CloudLoginModal({
    isOpen,
    onClose,
    showToast,
    syncFromCloud,
    cloudSyncing,
}: CloudLoginModalProps) {
    const store = useStore();
    const [cloudEmail, setCloudEmail] = useState('');
    const [cloudPassword, setCloudPassword] = useState('');
    const [cloudAuthError, setCloudAuthError] = useState('');
    const [cloudAuthLoading, setCloudAuthLoading] = useState(false);

    if (!isOpen) return null;

    async function handleCloudLogin() {
        setCloudAuthLoading(true);
        setCloudAuthError('');
        try {
            const { error } = await signIn(cloudEmail, cloudPassword);
            if (error) {
                const msg = error.message;
                if (msg.includes('Invalid login credentials')) throw new Error('邮箱或密码错误');
                if (msg.includes('Email not confirmed')) throw new Error('邮箱尚未验证，请查收邮件确认');
                throw error;
            }
            onClose();
        } catch (e) {
            setCloudAuthError(e instanceof Error ? e.message : String(e));
        } finally {
            setCloudAuthLoading(false);
        }
    }

    return (
        <div
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[2px]"
            onClick={onClose}
        >
            <div
                className="manuscript-sheet paper-grain w-full sm:max-w-sm p-6 max-h-[85vh] sm:max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center pb-4 mb-5 border-b border-dashed border-outline-variant/65">
                    <div className="flex items-center gap-2">
                        <Cloud size={20} className="text-primary" />
                        <h2 className="font-headline text-xl font-bold text-on-surface">云端同步</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-surface-container transition-colors text-outline hover:text-on-surface cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {store.cloudUser ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-surface-container border border-tertiary/45">
                            <CheckCircle2 size={18} className="text-tertiary shrink-0" />
                            <div className="min-w-0">
                                <p className="text-xs font-label font-medium text-on-surface">已连接云端</p>
                                <p className="font-mono text-xs text-on-surface-variant truncate">{store.cloudUser.email}</p>
                            </div>
                        </div>
                        <button
                            onClick={async () => {
                                await syncFromCloud(store.cloudUser!.id);
                                showToast('✅ 同步完成');
                            }}
                            disabled={cloudSyncing}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-on-primary text-xs font-label font-semibold hover:bg-primary-dim transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            {cloudSyncing ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                            {cloudSyncing ? '同步中…' : '立即同步手稿与词签'}
                        </button>
                        <button
                            onClick={async () => {
                                await signOut();
                                showToast('已退出登录');
                                onClose();
                            }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-outline-variant/65 text-xs font-label text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
                        >
                            <LogOut size={15} />退出账号
                        </button>
                    </div>
                ) : !SUPABASE_ENABLED ? (
                    <div className="space-y-5 text-center py-2">
                        <CloudOff size={38} className="text-outline mx-auto" />
                        <div>
                            <p className="font-headline font-bold text-base text-on-surface mb-1">云同步未启用</p>
                            <p className="text-xs font-body text-on-surface-variant leading-relaxed">
                                当前构建未配置 Supabase 凭据，所有手稿均安全保存在本地浏览器数据库中。<br />如需跨端同步，请在 <code className="bg-surface-container px-1.5 py-0.5 font-mono text-[13px]">.env.local</code> 中填入凭据后重新构建。
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-full py-2 border border-outline-variant/65 text-xs font-label text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
                        >
                            知道了
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <input
                            type="email"
                            placeholder="邮箱地址"
                            value={cloudEmail}
                            onChange={e => setCloudEmail(e.target.value)}
                            className="w-full px-3 py-2 bg-surface-container border border-outline-variant/60 text-xs font-mono text-on-surface placeholder:text-outline focus:border-primary focus:outline-none transition-colors"
                        />
                        <input
                            type="password"
                            placeholder="密码"
                            value={cloudPassword}
                            onChange={e => setCloudPassword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && void handleCloudLogin()}
                            className="w-full px-3 py-2 bg-surface-container border border-outline-variant/60 text-xs font-mono text-on-surface placeholder:text-outline focus:border-primary focus:outline-none transition-colors"
                        />
                        {cloudAuthError && (
                            <p className="text-xs text-error font-label">{cloudAuthError}</p>
                        )}
                        <button
                            onClick={() => void handleCloudLogin()}
                            disabled={cloudAuthLoading || !cloudEmail || !cloudPassword}
                            className="w-full py-2.5 bg-primary text-on-primary text-xs font-label font-semibold hover:bg-primary-dim transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            {cloudAuthLoading ? '登录中…' : '登录并同步'}
                        </button>

                        <div className="flex items-center justify-center gap-1.5 text-[13px] text-outline font-label">
                            <Lock size={12} />
                            <span>行级安全隔离，手稿仅你本人可读</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
