'use client';

const demoStories = [
  { id: "s1", title: "Témoignage", img: "/demo/story1.jpg" },
  { id: "s2", title: "Verset", img: "/demo/story2.jpg" },
  { id: "s3", title: "Prière", img: "/demo/story3.jpg" },
];

export default function StoriesRow() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {demoStories.map((s) => (
        <div key={s.id} className="min-w-[110px]">
          <div className="h-[80px] rounded-2xl border border-white/10 bg-white/5 overflow-hidden" />
          <div className="mt-2 text-xs font-semibold opacity-80">{s.title}</div>
        </div>
      ))}
    </div>
  );
}