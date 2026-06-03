import { useState } from 'react';
import { Bot, X, LoaderCircle, Wifi, CheckCircle2, AlertCircle } from 'lucide-react';
import { useStore } from '../store';
import { API_PRESETS, testConnection } from '../services/ai';

interface AiSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AiSettingsModal({ isOpen, onClose }: AiSettingsModalProps) {
    const store = useStore();
    const [aiTestStatus, setAiTestStatus] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle');
    const [aiTestError, setAiTestError] = useState('');
    const [aiAvailModels, setAiAvailModels] = useState<string[]>([]);
    const [aiModelsLoading, setAiModelsLoading] = useState(false);

    if (!isOpen) return null;

    const aiBaseNormalized = store.aiConfig.apiBase.replace(/\/+$/, '').toLowerCase();
    const canFetchModels = !!store.aiConfig.apiKey || 
        aiBaseNormalized.includes('localhost:11434') || 
        aiBaseNormalized.includes('127.0.0.1:11434');

    return (
        <div 
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={onClose}
        >
            <div 
                className="bg-surface border border-outline-variant/20 rounded-t-2xl sm:rounded-lg shadow-2xl w-full sm:max-w-lg p-6 max-h-[85vh] sm:max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center space-x-2">
                        <Bot size={26} className="text-primary" />
                        <h2 className="font-headline text-xl font-bold text-on-surface">AI 设置</h2>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-1 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-5">
                    {/* Enable toggle */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-label text-sm font-medium text-on-surface">启用 AI 功能</p>
                            <p className="text-xs text-on-surface-variant">开启后可使用 AI 生成灵感、续写等辅助功能</p>
                        </div>
                        <button
                            onClick={() => store.setAiEnabled(!store.aiEnabled)}
                            className={`relative w-11 h-6 rounded-full transition-colors ${store.aiEnabled ? 'bg-primary' : 'bg-outline-variant/40'}`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${store.aiEnabled ? 'translate-x-5' : ''}`} />
                        </button>
                    </div>

                    {/* Preset */}
                    <div>
                        <label className="font-label text-xs font-medium text-on-surface-variant uppercase tracking-widest mb-2 block">快速选择</label>
                        <div className="flex gap-2 flex-wrap">
                            {API_PRESETS.map(p => (
                                <button
                                    key={p.label}
                                    onClick={() => {
                                        store.setAiConfig({ apiBase: p.base, model: p.models[0] });
                                        setAiTestStatus('idle');
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-label border transition-colors ${store.aiConfig.apiBase === p.base
                                            ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                                            : 'bg-surface-container border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high'
                                        }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* API Base */}
                    <div>
                        <label className="font-label text-xs font-medium text-on-surface-variant uppercase tracking-widest mb-2 block">API 地址</label>
                        <input
                            type="url"
                            value={store.aiConfig.apiBase}
                            onChange={e => { store.setAiConfig({ apiBase: e.target.value }); setAiTestStatus('idle'); }}
                            placeholder="https://api.openai.com/v1"
                            className="w-full px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-lg text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none transition-colors"
                        />
                    </div>

                    {/* API Key */}
                    <div>
                        <label className="font-label text-xs font-medium text-on-surface-variant uppercase tracking-widest mb-2 block">API Key</label>
                        <input
                            type="password"
                            value={store.aiConfig.apiKey}
                            onChange={e => { store.setAiConfig({ apiKey: e.target.value }); setAiTestStatus('idle'); }}
                            placeholder="sk-..."
                            className="w-full px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-lg text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none transition-colors"
                        />
                        <p className="text-[13px] text-on-surface-variant mt-1">密钥仅存储在浏览器本地，不会上传到任何服务器</p>
                    </div>

                    {/* Model */}
                    <div>
                        <label className="font-label text-xs font-medium text-on-surface-variant uppercase tracking-widest mb-2 block">模型</label>
                        <div className="flex flex-col sm:flex-row gap-2 mb-2">
                            <input
                                type="text"
                                value={store.aiConfig.model}
                                onChange={e => { store.setAiConfig({ model: e.target.value }); setAiTestStatus('idle'); }}
                                placeholder="gemini-1.5-flash"
                                className="flex-1 px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-lg text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none transition-colors"
                            />
                            {canFetchModels && (
                                <button
                                    onClick={async () => {
                                        setAiModelsLoading(true);
                                        setAiAvailModels([]);
                                        try {
                                            const base = store.aiConfig.apiBase.replace(/\/+$/, '');
                                            const res = await fetch(`${base}/models`, {
                                                headers: store.aiConfig.apiKey ? { Authorization: `Bearer ${store.aiConfig.apiKey}` } : undefined,
                                            });
                                            const data = await res.json();
                                            const ids: string[] = (data.data ?? data.models ?? []).map((m: Record<string, string>) => m.id ?? m.name?.replace('models/', '') ?? '').filter(Boolean);
                                            setAiAvailModels(ids);
                                        } catch { setAiAvailModels([]); }
                                        finally { setAiModelsLoading(false); }
                                    }}
                                    disabled={aiModelsLoading}
                                    title={store.aiConfig.apiKey ? '获取该 Key 可用的模型列表' : '获取本地可用模型列表'}
                                    className="px-3 py-2 border border-outline-variant/30 rounded-lg text-xs font-label text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-50 whitespace-nowrap"
                                >
                                    {aiModelsLoading ? '获取中…' : '可用模型'}
                                </button>
                            )}
                        </div>
                        {aiAvailModels.length > 0 && (
                            <div className="max-h-32 overflow-y-auto flex flex-wrap gap-1 mb-1">
                                {aiAvailModels.map(m => (
                                    <button
                                        key={m}
                                        onClick={() => { store.setAiConfig({ model: m }); setAiTestStatus('idle'); }}
                                        className={`px-2 py-0.5 rounded text-[13px] font-label border transition-colors ${store.aiConfig.model === m
                                                ? 'bg-primary/10 border-primary/30 text-primary'
                                                : 'border-outline-variant/20 text-on-surface-variant hover:bg-surface-container'
                                            }`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        )}
                        {/* Quick model buttons for current preset */}
                        {aiAvailModels.length === 0 && (() => {
                            try {
                                const urlObj = new URL(store.aiConfig.apiBase);
                                const preset = API_PRESETS.find(p => p.base.includes(urlObj.host));
                                if (!preset || preset.models.length <= 1) return null;
                                return (
                                    <div className="flex gap-1 flex-wrap">
                                        {preset.models.map(m => (
                                            <button
                                                key={m}
                                                onClick={() => { store.setAiConfig({ model: m }); setAiTestStatus('idle'); }}
                                                className={`px-2 py-1 rounded text-[13px] font-label border transition-colors ${store.aiConfig.model === m
                                                        ? 'bg-primary/10 border-primary/30 text-primary'
                                                        : 'border-outline-variant/20 text-on-surface-variant hover:bg-surface-container'
                                                    }`}
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                );
                            } catch {
                                return null;
                            }
                        })()}
                    </div>

                    {/* Test connection */}
                    <div className="flex items-center gap-3 pt-2">
                        <button
                            onClick={async () => {
                                setAiTestStatus('testing');
                                setAiTestError('');
                                const err = await testConnection(store.aiConfig);
                                if (err === null) {
                                    setAiTestStatus('success');
                                } else {
                                    setAiTestStatus('fail');
                                    setAiTestError(err);
                                }
                            }}
                            disabled={aiTestStatus === 'testing'}
                            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-label font-medium hover:bg-primary-dim transition-colors disabled:opacity-50"
                        >
                            {aiTestStatus === 'testing' ? <LoaderCircle size={18} className="animate-spin" /> : <Wifi size={18} />}
                            <span>{aiTestStatus === 'testing' ? '测试中…' : '测试连接'}</span>
                        </button>
                        {aiTestStatus === 'success' && (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-sm font-label">
                                <CheckCircle2 size={18} />连接成功
                            </span>
                        )}
                        {aiTestStatus === 'fail' && (
                            <div className="flex flex-col gap-1">
                                <span className="flex items-center gap-1 text-red-600 dark:text-red-400 text-sm font-label">
                                    <AlertCircle size={18} />连接失败
                                </span>
                                {aiTestError && (
                                    <span className="text-[13px] text-red-500/80 dark:text-red-400/70 font-mono break-all max-w-xs">{aiTestError}</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
