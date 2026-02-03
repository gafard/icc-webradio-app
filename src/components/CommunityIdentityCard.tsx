'use client';
import { useEffect, useState } from "react";
import { loadCommunityProfile, saveCommunityProfile } from "./communityProfile";

export default function CommunityIdentityCard() {
  const [name, setName] = useState("");

  useEffect(() => {
    const p = loadCommunityProfile();
    setName(p.displayName || "Invité");
  }, []);

  const onSave = () => {
    saveCommunityProfile({ displayName: name.trim() || "Invité" });
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold">Ton pseudo</div>
      <p className="mt-1 text-xs opacity-70">Aucun compte. Juste un nom affiché.</p>
      <div className="mt-3 flex gap-2">
        <input
          className="w-full rounded-2xl bg-black/20 px-3 py-2 text-sm outline-none border border-white/10"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Frère Gafard"
        />
        <button onClick={onSave} className="rounded-2xl px-4 py-2 text-sm bg-white/10 hover:bg-white/15">
          OK
        </button>
      </div>
    </div>
  );
}