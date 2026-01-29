import MediaCard from "./MediaCard";

type Item = {
  id: string;
  title: string;
  thumbnail: string;
  subtitle?: string;
};

export default function Rail({
  title,
  items,
}: {
  title: string;
  items: Item[];
}) {
  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      </div>

      <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-3">
        {items.map((it) => (
          <MediaCard
            key={it.id}
            id={it.id}
            title={it.title}
            thumbnail={it.thumbnail}
            subtitle={it.subtitle}
          />
        ))}
      </div>
    </section>
  );
}