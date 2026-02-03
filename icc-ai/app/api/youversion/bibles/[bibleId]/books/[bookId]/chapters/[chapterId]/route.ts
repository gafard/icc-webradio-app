// app/api/youversion/bibles/[bibleId]/books/[bookId]/chapters/[chapterId]/route.ts
import { NextRequest } from 'next/server';

type Params = {
  params: {
    bibleId: string;  // ex: 'freLSG', 'lsg'
    bookId: string;   // ex: 'jhn', 'JHN'
    chapterId: string; // ex: '3'
  };
};

// Mapping des traductions YouVersion vers nos fichiers
const BIBLE_MAP: Record<string, string> = {
  'freLSG': 'lsg',
  'freBDS': 'bds',
  'freNEG79': 'neg79',
  'freOST': 'ost',
  'freS21': 's21',
  // Ajouter d'autres ici
};

// Mapping des livres YouVersion vers nos fichiers
const BOOK_MAP: Record<string, string> = {
  'jhn': 'JHN',
  'mat': 'MAT',
  'mrk': 'MRK',
  'luk': 'LUK',
  'act': 'ACT',
  'rom': 'ROM',
  '1co': '1CO',
  '2co': '2CO',
  'gal': 'GAL',
  'eph': 'EPH',
  'php': 'PHP',
  'col': 'COL',
  '1th': '1TH',
  '2th': '2TH',
  '1ti': '1TI',
  '2ti': '2TI',
  'tit': 'TIT',
  'phm': 'PHM',
  'heb': 'HEB',
  'jas': 'JAS',
  '1pe': '1PE',
  '2pe': '2PE',
  '1jn': '1JN',
  '2jn': '2JN',
  '3jn': '3JN',
  'jud': 'JUD',
  'rev': 'REV',
  // Ancien Testament
  'gen': 'GEN',
  'exo': 'EXO',
  'lev': 'LEV',
  'num': 'NUM',
  'deu': 'DEU',
  'jos': 'JOS',
  'jdg': 'JDG',
  'rut': 'RUT',
  '1sa': '1SA',
  '2sa': '2SA',
  '1ki': '1KI',
  '2ki': '2KI',
  '1ch': '1CH',
  '2ch': '2CH',
  'ezr': 'EZR',
  'neh': 'NEH',
  'est': 'EST',
  'job': 'JOB',
  'psa': 'PSA',
  'pro': 'PRO',
  'ecc': 'ECC',
  'sng': 'SNG',
  'isa': 'ISA',
  'jer': 'JER',
  'lam': 'LAM',
  'ezk': 'EZE',
  'dan': 'DAN',
  'hos': 'HOS',
  'jol': 'JOL',
  'amo': 'AMO',
  'oba': 'OBA',
  'jon': 'JON',
  'mic': 'MIC',
  'nah': 'NAH',
  'hab': 'HAB',
  'zep': 'ZEP',
  'hag': 'HAG',
  'zec': 'ZEC',
  'mal': 'MAL',
};

export async function GET(
  _req: NextRequest,
  { params }: Params
) {
  const { bibleId, bookId, chapterId } = params;

  try {
    // Convertir les IDs YouVersion vers nos formats
    const localBibleId = BIBLE_MAP[bibleId] || bibleId.toLowerCase();
    const localBookId = BOOK_MAP[bookId.toLowerCase()] || bookId.toUpperCase();

    // Charger le fichier complet
    const res = await fetch(
      `http://localhost:3000/bibles/${localBibleId}/bible.json`,
      { cache: 'force-cache' }
    );

    if (!res.ok) {
      return Response.json(
        { error: `Fichier introuvable: ${localBibleId}/bible.json` },
        { status: 404 }
      );
    }

    const bibleData = await res.json();
    const book = bibleData.books.find(
      (b: any) => b.id === localBookId
    );

    if (!book) {
      return Response.json(
        { error: 'Livre non trouvé' },
        { status: 404 }
      );
    }

    const chapter = book.chapters.find(
      (ch: any) => ch.chapter === Number(chapterId)
    );

    if (!chapter) {
      return Response.json(
        { error: 'Chapitre non trouvé' },
        { status: 404 }
      );
    }

    // Retourner dans le format attendu par ton app
    return Response.json({
      books: [{
        id: localBookId,
        chapters: [chapter],
      }],
    });
  } catch (error) {
    console.error('Erreur fichier local:', error);
    return Response.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
