'use client';

export default function RightPanel() {
  const suggestions = [
    { id: "u1", name: "Jean", tag: "@jean" },
    { id: "u2", name: "Deborah", tag: "@deborah" },
    { id: "u3", name: "Paul", tag: "@paul" },
  ];

  const tags = ["Louange", "Enseignement", "Prière", "Témoignages"];

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-3xl p-4">
        <div className="text-sm font-bold">Stories</div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="h-20 rounded-2xl border border-white/10 bg-white/5" />
          <div className="h-20 rounded-2xl border border-white/10 bg-white/5" />
        </div>
      </div>

      <div className="glass-panel rounded-3xl p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold">Suggestions</div>
          <button className="text-xs opacity-70 hover:opacity-100">Voir +</button>
        </div>
        <div className="mt-3 space-y-3">
          {suggestions.map((u) => (
            <div key={u.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-white/10 border border-white/10" />
                <div>
                  <div className="text-sm font-semibold">{u.name}</div>
                  <div className="text-xs opacity-60">{u.tag}</div>
                </div>
              </div>
              <button className="rounded-full px-3 py-1 text-xs bg-white/10 hover:bg-white/15">
                Suivre
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel rounded-3xl p-4">
        <div className="text-sm font-bold">Recommandations</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((t) => (
            <span key={t} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}