'use client';

export default function StoryVerseCard({
  verse,
  reference,
}: {
  verse: string;
  reference: string;
}) {
  return (
    <div className="relative h-[520px] rounded-3xl overflow-hidden border border-white/10">
      {/* background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/60 via-fuchsia-500/30 to-amber-500/50" />
      <div className="absolute inset-0 bg-black/40" />

      {/* content */}
      <div className="relative z-10 h-full p-6 flex flex-col justify-between">
        <div className="text-xs uppercase tracking-[0.25em] opacity-80">
          Story • Verset
        </div>

        <div className="mt-6">
          <p className="text-2xl font-extrabold leading-snug text-white">
            <span
              className="px-2 py-1 rounded-md"
              style={{
                background:
                  'linear-gradient(transparent 55%, rgba(255, 255, 0, 0.45) 55%)',
              }}
            >
              {verse}
            </span>
          </p>

          <div className="mt-4 text-sm font-semibold text-white/80">
            {reference}
          </div>
        </div>

        <div className="text-xs text-white/70">
          ICC • Communautés
        </div>
      </div>
    </div>
  );
}