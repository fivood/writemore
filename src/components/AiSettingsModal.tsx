import { useState } from 'react';
import { Bot, X, LoaderCircle, Wifi, CheckCircle2, AlertCircle } from 'lucide-react';
import { useStore } from '../store';
import { API_PRESETS, listModels, testConnection } from '../services/ai';

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

    const canFetchModels = !!store.aiConfig.apiKey || /\/\/(localhost|127\.0\.0\.1)[:/]/.test(store.aiConfig.apiBase);

    return (
        <div
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[2px]"
            onClick={onClose}
        >
            <div
                className="manuscript-sheet paper-grain rounded-t-lg sm:rounded-sm w-full sm:max-w-lg p-6 max-h-[85vh] sm:max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center pb-4 mb-5 border-b border-dashed border-outline-variant/65">
                    <div className="flex items-center gap-2">
                        <Bot size={20} className="text-primary" />
                        <h2 className="font-headline text-xl font-bold text-on-surface">AI 设置</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-sm hover:bg-surface-container transition-colors text-outline hover:text-on-surface cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-5">
                    {/* Enable toggle */}
                    <div className="flex items-center justify-between p-3 bg-surface-container border border-outline-variant/55 rounded-sm">
                        <div>
                            <p className="font-label text-sm font-medium text-on-surface">启用 AI 辅助</p>
                            <p className="text-xs text-on-surface-variant mt-0.5">开启后可使用点拨、出题、顺势续写与审读批注</p>
                        </div>
                        <button
                            onClick={() => store.setAiEnabled(!store.aiEnabled)}
                            className={`relative w-11 h-6 border border-on-surface/25 transition-colors cursor-pointer ${store.aiEnabled ? 'bg-primary' : 'bg-surface-container-high'}`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-surface-container-lowest border border-on-surface/20 transition-transform ${store.aiEnabled ? 'translate-x-5' : ''}`} />
                        </button>
                    </div>

                    {/* Preset */}
                    <div>
                        <label className="font-mono text-[13px] font-bold text-outline uppercase tracking-widest mb-2 block">
                            PROVIDER PRESETS · 服务商预设
                        </label>
                        <div className="flex gap-1.5 flex-wrap">
                            {API_PRESETS.map(p => (
                                <button
                                    key={p.label}
                                    onClick={() => {
                                        store.switchAiProvider(p.base, p.model);
                                        setAiTestStatus('idle');
                                    }}
                                    className={`px-3 py-1.5 rounded-sm text-xs font-label border transition-colors cursor-pointer ${
                                        store.aiConfig.apiBase === p.base
                                            ? 'bg-primary text-on-primary border-primary font-medium'
                                            : 'bg-surface-container border-outline-variant/60 text-on-surface-variant hover:border-secondary'
                                    }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* API Base */}
                    <div>
                        <label className="font-mono text-[13px] font-bold text-outline uppercase tracking-widest mb-1.5 block">
                            API ENDPOINT · 接口地址
                        </label>
                        <input
                            type="url"
                            value={store.aiConfig.apiBase}
                            onChange={e => { store.setAiConfig({ apiBase: e.target.value }); setAiTestStatus('idle'); }}
                            placeholder="https://generativelanguage.googleapis.com/v1beta/openai"
                            className="w-full px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-sm font-mono text-xs text-on-surface placeholder:text-outline focus:border-primary focus:outline-none transition-colors"
                        />
                    </div>

                    {/* API Key */}
                    <div>
                        <label className="font-mono text-[13px] font-bold text-outline uppercase tracking-widest mb-1.5 block">
                            API KEY · 密钥
                        </label>
                        <input
                            type="password"
                            value={store.aiConfig.apiKey}
                            onChange={e => { store.setAiConfig({ apiKey: e.target.value }); setAiTestStatus('idle'); }}
                            placeholder="粘贴 API Key"
                            className="w-full px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-sm font-mono text-xs text-on-surface placeholder:text-outline focus:border-primary focus:outline-none transition-colors"
                        />
                        <p className="text-xs font-label text-outline mt-1.5">密钥仅保存在本机浏览器本地，直连你所填写的服务商接口。</p>
                    </div>

                    {/* Model */}
                    <div>
                        <label className="font-mono text-[13px] font-bold text-outline uppercase tracking-widest mb-1.5 block">
                            MODEL · 模型型号
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2 mb-2">
                            <input
                                type="text"
                                value={store.aiConfig.model}
                                onChange={e => { store.setAiConfig({ model: e.target.value }); setAiTestStatus('idle'); }}
                                placeholder="gemini-4-hydrogen"
                                className="flex-1 px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-sm font-mono text-xs text-on-surface placeholder:text-outline focus:border-primary focus:outline-none transition-colors"
                            />
                            {canFetchModels && (
                                <button
                                    onClick={async () => {
                                        setAiModelsLoading(true);
                                        setAiAvailModels([]);
                                        try {
                                            setAiAvailModels(await listModels(store.aiConfig));
                                        } catch { setAiAvailModels([]); }
                                        finally { setAiModelsLoading(false); }
                                    }}
                                    disabled={aiModelsLoading}
                                    className="px-3 py-2 border border-outline-variant/60 rounded-sm text-xs font-label text-on-surface-variant hover:border-secondary hover:text-on-surface transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
                                >
                                    {aiModelsLoading ? '拉取中…' : '查询可用模型'}
                                </button>
                            )}
                        </div>
                        {aiAvailModels.length > 0 && (
                            <div className="max-h-32 overflow-y-auto flex flex-wrap gap-1 p-2 bg-surface-container border border-outline-variant/45 rounded-sm">
                                {aiAvailModels.map(m => (
                                    <button
                                        key={m}
                                        onClick={() => { store.setAiConfig({ model: m }); setAiTestStatus('idle'); }}
                                        className={`px-2 py-0.5 rounded-none font-mono text-[13px] border transition-colors cursor-pointer ${
                                            store.aiConfig.model === m
                                                ? 'bg-primary text-on-primary border-primary'
                                                : 'border-outline-variant/50 text-on-surface-variant hover:border-secondary'
                                        }`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Test connection */}
                    <div className="flex items-center gap-3 pt-2 border-t border-dashed border-outline-variant/60">
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
                            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-sm text-xs font-label font-semibold uppercase tracking-wider hover:bg-primary-dim transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            {aiTestStatus === 'testing' ? <LoaderCircle size={15} className="animate-spin" /> : <Wifi size={15} />}
                            <span>{aiTestStatus === 'testing' ? '测试中…' : '测试连接'}</span>
                        </button>
                        {aiTestStatus === 'success' && (
                            <span className="flex items-center gap-1 text-tertiary text-xs font-label font-medium">
                                <CheckCircle2 size={16} />连接正常
                            </span>
                        )}
                        {aiTestStatus === 'fail' && (
                            <div className="flex flex-col gap-0.5">
                                <span className="flex items-center gap-1 text-error text-xs font-label font-medium">
                                    <AlertCircle size={16} />连接失败
                                </span>
                                {aiTestError && (
                                    <span className="text-[13px] text-error/85 font-mono break-all max-w-xs">{aiTestError}</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
