'use client';
import { useState } from "react";

export default function FeedHeader() {
  const [tab, setTab] = useState<"recent"|"friends"|"popular">("recent");

  const TabBtn = ({ id, label }: any) => (
    <button
      onClick={() => setTab(id)}
      className={[
        "text-xs font-semibold px-3 py-2 rounded-full border",
        tab === id ? "bg-white/15 border-white/20" : "bg-transparent border-white/10 hover:bg-white/10"
      ].join(" ")}
    >
      {label}
    </button>
  );

  return (
    <div className="flex items-center justify-between">
      <div className="text-lg font-extrabold">Feeds</div>
      <div className="flex gap-2">
        <TabBtn id="recent" label="Recents" />
        <TabBtn id="friends" label="Amis" />
        <TabBtn id="popular" label="Populaire" />
      </div>
    </div>
  );
}