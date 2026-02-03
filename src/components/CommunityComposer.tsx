import { useMemo, useState } from 'react';
import { useCommunityIdentity } from '../lib/useCommunityIdentity';
import { createPost, createStory } from './communityApi';
import { renderVerseStoryPng } from '../lib/storyImage';
import { getRandomLocalVerse } from '../lib/localBible';

export default function CommunityComposer({
  onPosted,
  passage,
}: {
  onPosted?: () => void;
  passage?: { reference: string; text: string } | null;
}) {
  const { identity, updateName } = useCommunityIdentity();
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canPost = useMemo(() => {
    const nameOk = !!identity?.displayName?.trim();
    const textOk = content.trim().length >= 3;
    return nameOk && textOk && !busy;
  }, [identity, content, busy]);

  const submit = async () => {
    if (!identity) return;
    setError(null);
    setBusy(true);
    try {
      await createPost({
        author_name: identity.displayName.trim(),
        author_device_id: identity.deviceId,
        content: content.trim(),
      });
      setContent('');
      onPosted?.();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const publishStory = async () => {
    if (!identity?.displayName?.trim()) return;
    setError(null);
    setBusy(true);
    try {
      // 1) récupérer un verset random (local)
      const verse = await getRandomLocalVerse();
      if (!verse) {
        setError("Impossible de charger un verset depuis la Bible locale");
        setBusy(false);
        return;
      }

      // 2) générer l'image PNG
      const { dataUrl: png } = renderVerseStoryPng({
        reference: `${verse.book} ${verse.chapter}:${verse.verse}`,
        text: verse.text,
        author: identity.displayName.trim(),
      });

      // 3) créer la story avec image
      await createStory({
        author_name: identity.displayName.trim(),
        author_device_id: identity.deviceId,
        verse_reference: `${verse.book} ${verse.chapter}:${verse.verse}`,
        verse_text: verse.text,
        image_data_url: png,
      });

      onPosted?.();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la création de la story');
    } finally {
      setBusy(false);
    }
  };

  const initials =
    (identity?.displayName || 'Invité')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join('') || 'I';

  return (
    <div className="glass-panel rounded-3xl p-4">
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 shrink-0 rounded-full border border-white/10 bg-white/10 flex items-center justify-center text-xs font-bold">
          {initials}
        </div>

        <div className="flex-1">
          {/* Identity */}
          {!identity?.displayName ? (
            <div className="mb-3">
              <div className="text-xs opacity-70 mb-2">Sans compte : choisis un pseudo.</div>
              <input
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none"
                placeholder="Ton nom ou pseudo…"
                onChange={(e) => updateName(e.target.value)}
              />
            </div>
          ) : (
            <div className="text-xs opacity-70 mb-2">
              Publier en tant que <span className="font-semibold opacity-100">{identity.displayName}</span>
            </div>
          )}

          {/* Input */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-3">
            <textarea
              className="w-full min-h-[90px] bg-transparent text-sm outline-none resize-none placeholder:opacity-60"
              placeholder="Partage un témoignage, un verset, une pensée…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />

            {/* Actions row */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10"
                  disabled
                  title="à brancher plus tard"
                >
                  🖼️ Image
                </button>
                <button
                  type="button"
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10"
                  disabled
                  title="à brancher plus tard"
                >
                  🔗 Lien
                </button>
                <button
                  type="button"
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10"
                  disabled
                  title="à brancher plus tard"
                >
                  📍 Lieu
                </button>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  className="btn-base btn-secondary px-4 py-2 text-sm"
                  onClick={publishStory}
                  disabled={busy}
                >
                  📖 Publier en story
                </button>

                <button
                  className="btn-base btn-primary px-4 py-2 text-sm disabled:opacity-40"
                  disabled={!canPost}
                  onClick={submit}
                >
                  {busy ? 'Publication…' : 'Publier'}
                </button>
              </div>
            </div>
          </div>

          {error ? <div className="mt-3 text-sm text-red-300">{error}</div> : null}
        </div>
      </div>
    </div>
  );
}