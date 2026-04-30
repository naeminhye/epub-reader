import { useState, useEffect, useCallback } from 'react';
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useT } from '@/lib/i18n/context';
import { useReaderStore } from '@/stores/readerStore';
import { toast } from 'sonner';
import {
    loadTranslationSettings,
    saveTranslationSettings,
    PROVIDERS,
    GEMINI_MODELS,
    OPENROUTER_MODELS,
    isProviderReady,
    type TranslationSettings,
    type TranslationProvider,
} from '@/lib/translation/settings';

interface TranslationSettingsPanelProps {
    open: boolean;
    onClose: () => void;
}

export function TranslationSettingsPanel({ open, onClose }: TranslationSettingsPanelProps) {
    const t = useT();
    const { prefs, updatePrefs } = useReaderStore();
    const [settings, setSettings] = useState<TranslationSettings>(loadTranslationSettings);

    useEffect(() => {
        if (open) setSettings(loadTranslationSettings());
    }, [open]);

    const update = useCallback(<K extends keyof TranslationSettings>(key: K, value: TranslationSettings[K]) => {
        setSettings(prev => {
            const next = { ...prev, [key]: value };
            saveTranslationSettings({ [key]: value });
            return next;
        });
    }, []);

    const llmProviders = PROVIDERS.filter(p => p.category === 'llm');
    const neuralProviders = PROVIDERS.filter(p => p.category === 'neural');
    const activeMeta = PROVIDERS.find(p => p.id === settings.provider)!;
    const ready = isProviderReady(settings);

    return (
        <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0 h-full">
                <SheetHeader className="px-6 py-4 border-b shrink-0">
                    <SheetTitle className="font-heading">{t.translationSettings}</SheetTitle>
                    <SheetDescription className="text-xs">{t.translationEngineDesc}</SheetDescription>
                </SheetHeader>

                <ScrollArea className="flex-1 min-h-0">
                    <div className="px-6 py-6 space-y-8">

                        {/* ── How-to note ─────────────────────────────────────────── */}
                        <section className="rounded-md bg-muted/40 border px-4 py-3 space-y-1">
                            <p className="text-xs font-medium text-foreground/80">How to translate</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">{t.howToTranslate}</p>
                        </section>

                        {/* ── Auto-translate ──────────────────────────────────────── */}
                        <section className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-sm font-medium">{t.autoTranslate}</Label>
                                    <p className="text-xs text-muted-foreground mt-0.5">Translate every page automatically as you read</p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={prefs.autoTranslate}
                                    onClick={() => updatePrefs({ autoTranslate: !prefs.autoTranslate })}
                                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${prefs.autoTranslate ? 'bg-foreground' : 'bg-muted'
                                        }`}
                                >
                                    <span className={`inline-block h-5 w-5 rounded-full bg-background shadow ring-0 transition-transform ${prefs.autoTranslate ? 'translate-x-5' : 'translate-x-0'
                                        }`} />
                                </button>
                            </div>

                            {/* Token cost warning */}
                            {prefs.autoTranslate && (
                                <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950 px-3 py-2">
                                    <span className="text-amber-600 dark:text-amber-400 shrink-0 text-sm">⚠</span>
                                    <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">{t.autoTranslateWarning}</p>
                                </div>
                            )}

                            {/* Show/hide translation toggle */}
                            {prefs.autoTranslate && (
                                <div className="flex items-center justify-between pl-1">
                                    <Label className="text-xs text-muted-foreground">
                                        {prefs.showTranslation ? t.hideTranslation : t.showTranslation}
                                    </Label>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={prefs.showTranslation}
                                        onClick={() => updatePrefs({ showTranslation: !prefs.showTranslation })}
                                        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${prefs.showTranslation ? 'bg-foreground' : 'bg-muted'
                                            }`}
                                    >
                                        <span className={`inline-block h-4 w-4 rounded-full bg-background shadow transition-transform ${prefs.showTranslation ? 'translate-x-4' : 'translate-x-0'
                                            }`} />
                                    </button>
                                </div>
                            )}
                        </section>

                        {/* ── AI / LLM providers ───────────────────────────────────── */}
                        <section className="space-y-3">
                            <Label className="text-sm font-medium">AI Translation</Label>
                            <div className="space-y-2">
                                {llmProviders.map(p => (
                                    <ProviderCard
                                        key={p.id}
                                        id={p.id}
                                        name={p.name}
                                        tagline={p.tagline}
                                        active={settings.provider === p.id}
                                        onSelect={() => update('provider', p.id)}
                                    />
                                ))}
                            </div>
                        </section>

                        {/* ── Neural / dedicated translation ───────────────────────── */}
                        <section className="space-y-3">
                            <Label className="text-sm font-medium">Translation APIs</Label>
                            <div className="space-y-2">
                                {neuralProviders.map(p => (
                                    <ProviderCard
                                        key={p.id}
                                        id={p.id}
                                        name={p.name}
                                        tagline={p.tagline}
                                        active={settings.provider === p.id}
                                        onSelect={() => update('provider', p.id)}
                                    />
                                ))}
                            </div>
                        </section>

                        {/* ── Config for selected provider ─────────────────────────── */}
                        <section className="space-y-4 rounded-lg border bg-muted/20 p-4">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <p className="text-sm font-semibold">{activeMeta.name}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{activeMeta.note}</p>
                                </div>
                                {activeMeta.keyUrl && (
                                    <a
                                        href={activeMeta.keyUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs text-primary underline shrink-0"
                                    >
                                        Get key ↗
                                    </a>
                                )}
                            </div>

                            {/* Model picker — LLM providers only */}
                            {activeMeta.supportsModels && (
                                <ModelPicker settings={settings} update={update} />
                            )}

                            {/* Key inputs — provider-specific */}
                            <ProviderKeyInputs settings={settings} update={update} />

                            {/* Ready indicator */}
                            <div className={`text-xs px-2 py-1 rounded-sm inline-flex items-center gap-1.5 ${ready ? 'text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950' : 'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950'
                                }`}>
                                <span>{ready ? '✓' : '○'}</span>
                                <span>{ready ? 'Ready to translate' : 'Key required'}</span>
                            </div>
                        </section>

                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ProviderCard({
    id, name, tagline, active, onSelect,
}: {
    id: TranslationProvider; name: string; tagline: string; active: boolean; onSelect: () => void;
}) {
    const icon = PROVIDER_ICONS[id] ?? '◈';
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md border text-left transition-all ${active
                ? 'border-foreground bg-foreground/5'
                : 'border-border hover:border-foreground/40 hover:bg-muted/30'
                }`}
        >
            <span className="text-base shrink-0 w-5 text-center">{icon}</span>
            <div className="min-w-0">
                <p className={`text-sm font-medium ${active ? 'text-foreground' : 'text-foreground/80'}`}>{name}</p>
                <p className="text-xs text-muted-foreground truncate">{tagline}</p>
            </div>
            {active && <span className="ml-auto text-foreground shrink-0">✓</span>}
        </button>
    );
}

const PROVIDER_ICONS: Record<TranslationProvider, string> = {
    gemini: '✦',
    openrouter: '⟡',
    deepl: '◈',
    'google-translate': 'G',
    papago: 'N',
    deeplx: '∞',
};

function ModelPicker({
    settings, update,
}: {
    settings: TranslationSettings;
    update: <K extends keyof TranslationSettings>(key: K, value: TranslationSettings[K]) => void;
}) {
    const t = useT();
    const models = settings.provider === 'gemini' ? GEMINI_MODELS : OPENROUTER_MODELS;
    const currentKey = settings.provider === 'gemini' ? settings.geminiModel : settings.openrouterModel;
    const currentLabel = models.find(m => m.key === currentKey)?.label ?? currentKey;
    const field = settings.provider === 'gemini' ? 'geminiModel' : 'openrouterModel';

    return (
        <div className="space-y-1.5">
            <Label className="text-xs">{t.modelSelection}</Label>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between text-left font-normal h-auto py-2 px-3 text-sm">
                        <span className="truncate">{currentLabel}</span>
                        <span className="text-muted-foreground ml-2 shrink-0">▾</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-80">
                    {models.map(m => (
                        <DropdownMenuItem
                            key={m.key}
                            onClick={() => update(field, m.key)}
                            className={`text-sm ${currentKey === m.key ? 'bg-accent' : ''}`}
                        >
                            {m.label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

function ProviderKeyInputs({
    settings, update,
}: {
    settings: TranslationSettings;
    update: <K extends keyof TranslationSettings>(key: K, value: TranslationSettings[K]) => void;
}) {
    const t = useT();

    switch (settings.provider) {
        case 'gemini':
            return (
                <KeyInput label="Gemini API Key" field="geminiApiKey" value={settings.geminiApiKey}
                    hint="AIza…" placeholder={t.apiKeyPlaceholder} desc={t.apiKeyDesc} update={update} />
            );
        case 'openrouter':
            return (
                <KeyInput label="OpenRouter API Key" field="openrouterApiKey" value={settings.openrouterApiKey}
                    hint="sk-or-…" placeholder={t.apiKeyPlaceholder} desc={t.apiKeyDesc} update={update} />
            );
        case 'deepl':
            return (
                <KeyInput label="DeepL API Key" field="deeplApiKey" value={settings.deeplApiKey}
                    hint="xxxxxxxx-xxxx-…:fx" placeholder="Free key ends in :fx" desc="Get from deepl.com/pro-api. Free tier: 500K chars/month." update={update} />
            );
        case 'google-translate':
            return (
                <KeyInput label="Cloud Translation API Key (optional)" field="googleTranslateApiKey"
                    value={settings.googleTranslateApiKey} hint="AIza…"
                    placeholder="Leave empty to use the free unofficial endpoint"
                    desc="Without a key: uses unofficial API (rate limited). With key: official Cloud Translation v2." update={update} />
            );
        case 'papago':
            return (
                <div className="space-y-3">
                    <KeyInput label="Naver Client ID" field="papagoClientId" value={settings.papagoClientId}
                        hint="Client ID" placeholder="From developers.naver.com" desc="" update={update} />
                    <KeyInput label="Naver Client Secret" field="papagoClientSecret" value={settings.papagoClientSecret}
                        hint="Client Secret" placeholder="From developers.naver.com"
                        desc="Register your app at developers.naver.com → Products → Papago Translation." update={update} />
                </div>
            );
        case 'deeplx':
            return (
                <UrlInput label="DeepLX Server URL" field="deeplxUrl" value={settings.deeplxUrl}
                    placeholder="http://localhost:1188"
                    desc="Run DeepLX locally: docker run -d -p 1188:1188 ghcr.io/ifyour/deeplx" update={update} />
            );
        default:
            return null;
    }
}

function KeyInput({
    label, field, value, hint, placeholder, desc, update,
}: {
    label: string; field: keyof TranslationSettings; value: string;
    hint: string; placeholder: string; desc: string;
    update: <K extends keyof TranslationSettings>(key: K, value: TranslationSettings[K]) => void;
}) {
    const t = useT();
    const [draft, setDraft] = useState(value);
    const [visible, setVisible] = useState(false);
    useEffect(() => { setDraft(value); }, [value]);

    const save = (v: string) => {
        update(field, v.trim() as TranslationSettings[typeof field]);
        toast.success(v.trim() ? t.apiKeySaved : t.apiKeyCleared);
    };

    return (
        <div className="space-y-1.5">
            <Label className="text-xs font-medium">{label}</Label>
            {desc && <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Input
                        type={visible ? 'text' : 'password'}
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        placeholder={value ? `${hint.slice(0, 6)}…` : placeholder}
                        className="text-xs pr-12 font-mono"
                        onKeyDown={e => { if (e.key === 'Enter') save(draft); }}
                    />
                    <button type="button" onClick={() => setVisible(v => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground">
                        {visible ? 'Hide' : 'Show'}
                    </button>
                </div>
                <Button size="sm" onClick={() => save(draft)} className="shrink-0 h-9">Save</Button>
            </div>
            {value && (
                <button type="button" onClick={() => { setDraft(''); save(''); }}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                    Clear key
                </button>
            )}
        </div>
    );
}

function UrlInput({
    label, field, value, placeholder, desc, update,
}: {
    label: string; field: keyof TranslationSettings; value: string;
    placeholder: string; desc: string;
    update: <K extends keyof TranslationSettings>(key: K, value: TranslationSettings[K]) => void;
}) {
    const t = useT();
    const [draft, setDraft] = useState(value);
    useEffect(() => { setDraft(value); }, [value]);

    const save = (v: string) => {
        update(field, v.trim() as TranslationSettings[typeof field]);
        toast.success(t.settingsSaved);
    };

    return (
        <div className="space-y-1.5">
            <Label className="text-xs font-medium">{label}</Label>
            {desc && <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>}
            <div className="flex gap-2">
                <Input
                    type="url"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    placeholder={placeholder}
                    className="text-xs font-mono flex-1"
                    onKeyDown={e => { if (e.key === 'Enter') save(draft); }}
                />
                <Button size="sm" onClick={() => save(draft)} className="shrink-0 h-9">Save</Button>
            </div>
        </div>
    );
}