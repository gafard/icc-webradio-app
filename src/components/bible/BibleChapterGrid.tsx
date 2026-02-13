'use client';

import { type BibleBook } from '../../lib/bibleCatalog';

type BibleChapterGridProps = {
  book: BibleBook;
  currentChapter: number;
  onSelectChapter: (chapter: number) => void;
};

export default function BibleChapterGrid({
  book,
  currentChapter,
  onSelectChapter,
}: BibleChapterGridProps) {
  return (
    <div className="mt-3">
      <div className="text-xs text-[color:var(--foreground)]/60 mb-2">
        Chapitres de {book.name}
      </div>
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: book.chapters }, (_, i) => i + 1).map((chapterNum) => (
          <button
            key={chapterNum}
            type="button"
            onClick={() => onSelectChapter(chapterNum)}
            className={`h-8 w-8 text-xs rounded-full flex items-center justify-center transition ${
              chapterNum === currentChapter ? 'bg-orange-300 text-white font-bold' : 'hover:bg-orange-100'
            }`}
          >
            {chapterNum}
          </button>
        ))}
      </div>
    </div>
  );
}
