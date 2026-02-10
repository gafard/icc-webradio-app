import { type ChangeEvent, useMemo, useRef, useState } from 'react';
import { ImagePlus, Link2, Loader2, MapPin, SendHorizontal, Sparkles, X } from 'lucide-react';
import { useCommunityIdentity } from '../lib/useCommunityIdentity';
import { createPost, createStory, type CommunityKind } from './communityApi';
import { renderVerseStoryPng } from '../lib/storyImage';
import { getRandomLocalVerse } from '../lib/localBible';
import { useI18n } from '../contexts/I18nContext';

function normalizeUrl(value: string) {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function isLikelyImageUrl(value: string) {
  if (value.startsWith('data:image/')) return true;
  return /\.(png|jpe?g|webp|gif|avif|svg)(\?.*)?$/i.test(value);
}

const MAX_LOCAL_IMAGE_MB = 4;

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Impossible de lire cette image.'));
    reader.readAsDataURL(file);
  });
}

export default function CommunityComposer({
  onPosted,
  passage,
  kind = 'general',
  groupId,
  placeholder,
  allowStory = true,
  submitLabel,
}: {
  onPosted?: () => void;
  passage?: { reference: string; text: string } | null;
  kind?: CommunityKind;
  groupId?: string | null;
  placeholder?: string;
  allowStory?: boolean;
  submitLabel?: string;
}) {
  const { t } = useI18n();
  const { identity, updateName } = useCommunityIdentity();
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [localImageDataUrl, setLocalImageDataUrl] = useState('');
  const [localImageName, setLocalImageName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [place, setPlace] = useState('');
  const [mediaMode, setMediaMode] = useState<'upload' | 'url'>('upload');
  const [showMedia, setShowMedia] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [showPlace, setShowPlace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const normalizedMedia = useMemo(() => normalizeUrl(mediaUrl), [mediaUrl]);
  const normalizedLink = useMemo(() => normalizeUrl(linkUrl), [linkUrl]);
  const imagePreview = useMemo(() => {
    if (localImageDataUrl) return localImageDataUrl;
    return normalizedMedia && isLikelyImageUrl(normalizedMedia) ? normalizedMedia : '';
  }, [localImageDataUrl, normalizedMedia]);

  const canPost = useMemo(() => {
    const nameOk = !!identity?.displayName?.trim();
    const hasText = content.trim().length >= 3;
    const hasExtras = !!localImageDataUrl || !!normalizedMedia || !!normalizedLink;
    return nameOk && (hasText || hasExtras) && !busy;
  }, [identity, content, localImageDataUrl, normalizedMedia, normalizedLink, busy]);

  const clearMedia = () => {
    setMediaUrl('');
    setLocalImageDataUrl('');
    setLocalImageName('');
    setShowMedia(false);
  };

  const onLocalImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Veuillez choisir un fichier image (png, jpg, webp, etc.).');
      return;
    }
    if (file.size > MAX_LOCAL_IMAGE_MB * 1024 * 1024) {
      setError(`Image trop lourde (${MAX_LOCAL_IMAGE_MB} Mo max).`);
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setLocalImageDataUrl(dataUrl);
      setLocalImageName(file.name);
      setMediaUrl('');
      setMediaMode('upload');
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger cette image.');
    } finally {
      event.target.value = '';
    }
  };

  const submit = async () => {
    if (!identity) return;
    setError(null);
    setBusy(true);
    try {
      const parts: string[] = [];
      const text = content.trim();
      if (text) parts.push(text);
      if (passage?.reference && passage?.text) {
        parts.push(`"${passage.text}" (${passage.reference})`);
      }
      if (normalizedLink) parts.push(`Lien: ${normalizedLink}`);
      if (place.trim()) parts.push(`Lieu: ${place.trim()}`);

      const finalMedia = localImageDataUrl || normalizedMedia || null;
      await createPost({
        author_name: identity.displayName.trim(),
        author_device_id: identity.deviceId,
        content: parts.join('\n\n').trim(),
        media_url: finalMedia,
        media_type: finalMedia ? 'image' : null,
        kind,
        group_id: groupId || null,
      });

      setContent('');
      setMediaUrl('');
      setLocalImageDataUrl('');
      setLocalImageName('');
      setLinkUrl('');
      setPlace('');
      setMediaMode('upload');
      setShowMedia(false);
      setShowLink(false);
      setShowPlace(false);
      onPosted?.();
    } catch (e: any) {
      setError(e?.message ?? t('composer.errorDefault'));
    } finally {
      setBusy(false);
    }
  };

  const publishStory = async () => {
    if (!identity?.displayName?.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const verse = await getRandomLocalVerse();
      if (!verse) {
        setError(t('composer.errorVerseLoad'));
        setBusy(false);
        return;
      }

      const { dataUrl: png } = await renderVerseStoryPng(verse, { style: 'gradient' });
      await createStory({
        author_name: identity.displayName.trim(),
        author_device_id: identity.deviceId,
        verse_reference: `${verse.book} ${verse.chapter}:${verse.verse}`,
        verse_text: verse.text,
        image_data_url: png,
      });

      onPosted?.();
    } catch (e: any) {
      setError(e?.message ?? t('composer.errorStoryCreate'));
    } finally {
      setBusy(false);
    }
  };

  const initials =
    (identity?.displayName || t('identity.guest'))
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join('') || 'I';

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/40 p-5 md:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl">
      {/* Ambient glow */}
      <div className="absolute -right-20 -bottom-20 h-40 w-40 rounded-full bg-[color:var(--accent)]/10 blur-3xl" />

      <div className="flex items-start gap-4">
        {/* Avatar with glow */}
        <div className="relative shrink-0 hidden sm:block">
          <div className="absolute inset-0 bg-[color:var(--accent)]/20 rounded-2xl blur-md" />
          <div className="relative h-12 w-12 rounded-2xl border border-white/20 bg-gradient-to-br from-slate-700/80 to-slate-800/90 flex items-center justify-center text-sm font-bold text-white shadow-lg">
            {initials}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {!identity?.displayName ? (
            <div className="mb-4">
              <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 mb-2">{t('composer.noAccountPseudo')}</div>
              <input
                className="w-full h-11 rounded-xl bg-slate-950/50 border border-white/10 px-4 text-sm text-white placeholder:text-slate-600 outline-none focus:border-[color:var(--accent-border)]/50 transition-colors shadow-inner"
                placeholder={t('composer.namePlaceholder')}
                onChange={(e) => updateName(e.target.value)}
              />
            </div>
          ) : (
            <div className="text-xs text-slate-500 font-medium mb-2">
              {t('composer.postAs', { name: identity.displayName })}
            </div>
          )}

          <div className="relative rounded-2xl border border-white/10 bg-slate-950/30 p-4 transition-all focus-within:border-white/20 focus-within:bg-slate-950/50">
            <textarea
              className="w-full min-h-[104px] bg-transparent text-[15px] leading-relaxed text-slate-200 outline-none resize-none placeholder:text-slate-600"
              placeholder={placeholder || t('composer.defaultPlaceholder')}
              value={content}
              maxLength={1200}
              onChange={(e) => setContent(e.target.value)}
            />

            {showMedia ? (
              <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="rounded-2xl border border-white/5 bg-slate-900/80 p-4 space-y-4">
                  <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-950/50 w-fit">
                    <button
                      type="button"
                      className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${mediaMode === 'upload'
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-300'
                        }`}
                      onClick={() => setMediaMode('upload')}
                    >
                      Appareil
                    </button>
                    <button
                      type="button"
                      className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${mediaMode === 'url'
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-300'
                        }`}
                      onClick={() => setMediaMode('url')}
                    >
                      Lien direct
                    </button>
                  </div>

                  {mediaMode === 'upload' ? (
                    <div className="flex flex-col gap-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={onLocalImageChange}
                      />
                      <button
                        type="button"
                        className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/[0.02] py-6 text-sm font-medium text-slate-400 hover:bg-white/[0.05] hover:border-white/20 transition-all"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <ImagePlus size={20} className="text-[color:var(--accent)]" />
                        {localImageName || "Sélectionner une image"}
                      </button>
                      <div className="text-[10px] text-slate-600 text-center uppercase tracking-wider font-bold">
                        PNG, JPG, WEBP • {MAX_LOCAL_IMAGE_MB} Mo max
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        className="w-full h-11 rounded-xl bg-slate-950 border border-white/5 pl-4 pr-10 text-sm text-white placeholder:text-slate-700 outline-none"
                        placeholder="URL image (https://...)"
                        value={mediaUrl}
                        onChange={(e) => {
                          setMediaUrl(e.target.value);
                          setLocalImageDataUrl('');
                          setLocalImageName('');
                        }}
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-2 h-7 w-7 grid place-items-center rounded-lg bg-white/5 text-slate-400 hover:text-rose-400"
                        onClick={clearMedia}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
                {imagePreview ? (
                  <div className="mt-4 relative group overflow-hidden rounded-2xl border border-white/10">
                    <img src={imagePreview} alt="Apercu media" className="h-48 w-full object-cover" />
                    <button
                      type="button"
                      className="absolute top-2 right-2 h-8 w-8 grid place-items-center rounded-xl bg-black/60 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={clearMedia}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {showLink ? (
              <div className="mt-4 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="relative flex-1">
                  <input
                    className="w-full h-11 rounded-xl bg-slate-950 border border-white/10 pl-4 pr-10 text-sm text-white placeholder:text-slate-700 outline-none"
                    placeholder="Lien a partager (https://...)"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                  />
                  <Link2 size={16} className="absolute right-3 top-3 text-slate-600" />
                </div>
                <button
                  type="button"
                  className="h-11 w-11 grid place-items-center rounded-xl bg-white/5 text-slate-500 hover:text-rose-400 transition-colors"
                  onClick={() => {
                    setLinkUrl('');
                    setShowLink(false);
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            ) : null}

            {showPlace ? (
              <div className="mt-4 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="relative flex-1">
                  <input
                    className="w-full h-11 rounded-xl bg-slate-950 border border-white/10 pl-4 pr-10 text-sm text-white placeholder:text-slate-700 outline-none"
                    placeholder="Ville / quartier"
                    value={place}
                    onChange={(e) => setPlace(e.target.value)}
                  />
                  <MapPin size={16} className="absolute right-3 top-3 text-slate-600" />
                </div>
                <button
                  type="button"
                  className="h-11 w-11 grid place-items-center rounded-xl bg-white/5 text-slate-500 hover:text-rose-400 transition-colors"
                  onClick={() => {
                    setPlace('');
                    setShowPlace(false);
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${showMedia ? 'bg-white/15 text-white ring-1 ring-white/10' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  onClick={() => setShowMedia((prev) => !prev)}
                >
                  <ImagePlus size={15} className={showMedia ? 'text-[color:var(--accent)]' : ''} />
                  <span>Image</span>
                </button>
                <button
                  type="button"
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${showLink ? 'bg-white/15 text-white ring-1 ring-white/10' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  onClick={() => setShowLink((prev) => !prev)}
                >
                  <Link2 size={15} className={showLink ? 'text-sky-400' : ''} />
                  <span>Lien</span>
                </button>
                <button
                  type="button"
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${showPlace ? 'bg-white/15 text-white ring-1 ring-white/10' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  onClick={() => setShowPlace((prev) => !prev)}
                >
                  <MapPin size={15} className={showPlace ? 'text-emerald-400' : ''} />
                  <span>Lieu</span>
                </button>
              </div>

              <div className="text-[10px] uppercase font-black tracking-widest text-slate-600">{content.length} / 1200</div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              {allowStory ? (
                <button
                  className="flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-all"
                  onClick={publishStory}
                  disabled={busy}
                >
                  <Sparkles size={16} className="text-amber-400" />
                  {t('composer.publishStory')}
                </button>
              ) : null}

              <button
                className={`flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold shadow-lg transition-all active:scale-95 disabled:opacity-30 ${canPost
                  ? 'bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-strong)] text-white shadow-[color:var(--accent)]/20'
                  : 'bg-white/5 text-slate-600 cursor-not-allowed'
                  }`}
                disabled={!canPost}
                onClick={submit}
              >
                {busy ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <SendHorizontal size={18} />
                )}
                {busy ? t('composer.posting') : submitLabel || t('composer.publish')}
              </button>
            </div>
          </div>

          {error ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-rose-400 font-medium bg-rose-400/10 p-3 rounded-xl border border-rose-400/20">
              <X size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
