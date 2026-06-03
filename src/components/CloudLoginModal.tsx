import { useState } from 'react';
import { Cloud, X, CheckCircle2, LoaderCircle, RefreshCw, LogOut, CloudOff, Info, Lock } from 'lucide-react';
import { useStore } from '../store';
import { signIn, signUp, signOut, SUPABASE_ENABLED } from '../services/supabase';

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
    const [cloudAuthMode, setCloudAuthMode] = useState<'login' | 'register'>('login');
    const [cloudAuthError, setCloudAuthError] = useState('');
    const [cloudAuthLoading, setCloudAuthLoading] = useState(false);

    if (!isOpen) return null;

    async function handleCloudAuth() {
        setCloudAuthLoading(true);
        setCloudAuthError('');
        try {
            const fn = cloudAuthMode === 'login' ? signIn : signUp;
            const { error } = await fn(cloudEmail, cloudPassword);
            if (error) {
                const msg = error.message;
                if (msg.includes('Invalid login credentials')) throw new Error('密码错误，或用户未验证');
                if (msg.includes('Email not confirmed')) throw new Error('邮箱尚未验证，请查收邮件确认');
                if (msg.includes('User already registered')) throw new Error('该邮箱已被注册，请直接尝试登录');
                throw error;
            }
            if (cloudAuthMode === 'register') {
                showToast('✉️ 注册成功，请去查收确认信后再登录');
                setCloudAuthMode('login');
            } else {
                onClose();
            }
        } catch (e) {
            setCloudAuthError(e instanceof Error ? e.message : String(e));
        } finally {
            setCloudAuthLoading(false);
        }
    }

    return (
        <div 
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={onClose}
        >
            <div 
                className="bg-surface border border-outline-variant/20 rounded-t-2xl sm:rounded-lg shadow-2xl w-full sm:max-w-sm p-6 max-h-[85vh] sm:max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center space-x-2">
                        <Cloud size={26} className="text-primary" />
                        <h2 className="font-headline text-xl font-bold text-on-surface">云端同步</h2>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-1 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
                    >
                        <X size={20} />
                    </button>
                </div>

                {store.cloudUser ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-emerald-50/60 dark:bg-emerald-500/5 border border-emerald-200/40 dark:border-emerald-400/10 rounded-lg">
                            <CheckCircle2 size={22} className="text-emerald-500" />
                            <div>
                                <p className="text-sm font-label font-medium text-on-surface">已登录</p>
                                <p className="text-xs text-on-surface-variant">{store.cloudUser.email}</p>
                            </div>
                        </div>
                        <button
                            onClick={async () => { 
                                await syncFromCloud(store.cloudUser!.id); 
                                showToast('✅ 同步完成'); 
                            }}
                            disabled={cloudSyncing}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-sm font-label font-medium hover:bg-primary/15 transition-colors disabled:opacity-50"
                        >
                            {cloudSyncing ? <LoaderCircle size={20} className="animate-spin" /> : <RefreshCw size={20} />}
                            {cloudSyncing ? '同步中…' : '立即从云端同步'}
                        </button>
                        <button
                            onClick={async () => { 
                                await signOut(); 
                                showToast('已退出登录'); 
                                onClose(); 
                            }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-outline-variant/30 rounded-lg text-sm font-label text-on-surface-variant hover:bg-surface-container transition-colors"
                        >
                            <LogOut size={20} />退出登录
                        </button>
                    </div>
                ) : !SUPABASE_ENABLED ? (
                    <div className="space-y-6 text-center">
                        <CloudOff size={48} className="text-on-surface-variant/40" />
                        <div>
                            <p className="font-label font-medium text-on-surface mb-1">云同步未启用</p>
                            <p className="text-sm text-on-surface-variant leading-relaxed">
                                当前版本未配置 Supabase 凭据。<br />如需云同步功能，请联系开发者配置，<br />或在项目 <code className="bg-surface-container px-1 rounded text-xs">.env.local</code> 中填入凭据后重新构建。
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-full py-2.5 border border-outline-variant/30 rounded-lg text-sm font-label text-on-surface-variant hover:bg-surface-container transition-colors"
                        >关闭</button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Mode toggles */}
                        <div className="flex rounded-lg overflow-hidden border border-outline-variant/30">
                            <button
                                onClick={() => { setCloudAuthMode('login'); setCloudAuthError(''); }}
                                className={`flex-1 py-2 text-sm font-label font-medium transition-colors ${cloudAuthMode === 'login' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
                            >登录</button>
                            <button
                                onClick={() => { setCloudAuthMode('register'); setCloudAuthError(''); }}
                                className={`flex-1 py-2 text-sm font-label font-medium transition-colors ${cloudAuthMode === 'register' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
                            >注册账号</button>
                        </div>

                        {/* Registration hint */}
                        {cloudAuthMode === 'register' && (
                            <div className="flex gap-2.5 p-3 bg-primary/5 border border-primary/15 rounded-lg">
                                <Info size={18} className="text-primary mt-0.5 shrink-0" />
                                <p className="text-xs text-on-surface-variant font-label leading-relaxed">
                                    填写密码后会给邮箱发送确认链接，点击激活即可完成注册，跨设备自动加密同步文章数据。
                                </p>
                            </div>
                        )}

                        <input
                            type="email"
                            placeholder="邮箱地址"
                            value={cloudEmail}
                            onChange={e => setCloudEmail(e.target.value)}
                            className="w-full px-3 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none transition-colors"
                        />
                        <input
                            type="password"
                            placeholder="密码（至少6位）"
                            value={cloudPassword}
                            onChange={e => setCloudPassword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCloudAuth()}
                            className="w-full px-3 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none transition-colors"
                        />
                        {cloudAuthError && (
                            <p className="text-xs text-red-500 font-label">{cloudAuthError}</p>
                        )}
                        <button
                            onClick={handleCloudAuth}
                            disabled={cloudAuthLoading || !cloudEmail || !cloudPassword}
                            className="w-full py-2.5 bg-primary text-on-primary rounded-lg text-sm font-label font-medium hover:bg-primary-dim transition-colors disabled:opacity-50"
                        >
                            {cloudAuthLoading ? '处理中…' : cloudAuthMode === 'login' ? '登录' : '注册并登录'}
                        </button>

                        <div className="flex items-center justify-center gap-1.5 text-xs text-on-surface-variant font-label">
                            <Lock size={14} />
                            <span>数据仅你本人可见，任何人无法访问</span>
                        </div>

                        {cloudAuthMode === 'login' && (
                            <p className="text-xs text-on-surface-variant text-center font-label">
                                没有账号？点击上方<button className="text-primary underline-offset-2 hover:underline ml-0.5" onClick={() => { setCloudAuthMode('register'); setCloudAuthError(''); }}>注册账号</button>
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
