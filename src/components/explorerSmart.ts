export type SmartCategory =
  | 'predication'
  | 'louange'
  | 'enseignement'
  | 'temoignage'
  | 'priere'
  | 'live'
  | 'autres';

export function categoryLabel(c: SmartCategory | 'all') {
  switch (c) {
    case 'predication': return 'Prédications';
    case 'louange': return 'Louange';
    case 'enseignement': return 'Enseignements';
    case 'temoignage': return 'Témoignages';
    case 'priere': return 'Prière';
    case 'live': return 'Live';
    case 'autres': return 'Autres';
    default: return 'Tout';
  }
}

function rx(list: string[]) {
  return new RegExp(`\\b(${list.map(escapeRx).join('|')})\\b`, 'i');
}
function escapeRx(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const RULES: Array<{ cat: SmartCategory; re: RegExp }> = [
  { cat: 'live', re: rx(['live', 'direct', 'en direct', 'stream', 'culte live']) },
  { cat: 'priere', re: rx(['prière', 'priere', 'intercession', 'veille', 'adoration et prière']) },
  { cat: 'temoignage', re: rx(['témoignage', 'temoignage', 'testimony']) },
  { cat: 'louange', re: rx(['louange', 'adoration', 'worship', 'chant', 'chants', 'chorale', 'praise']) },
  { cat: 'enseignement', re: rx(['enseignement', 'étude', 'etude', 'formation', 'cours', 'bible study', 'doctrine', 'exhortation']) },
  { cat: 'predication', re: rx(['prédication', 'predication', 'sermon', 'message', 'prêche', 'preche']) },
];

export function getCategory(title: string): SmartCategory {
  const t = title.toLowerCase();
  for (const r of RULES) {
    if (r.re.test(t)) return r.cat;
  }
  return 'autres';
}

// Intervenant: tente d'extraire "Pasteur X", "Ps X", "Dr X", "Prophète X", etc.
const SPEAKER_PATTERNS = [
  /\b(pasteur|ps|pst|apôtre|apotre|dr|docteur|prophète|prophete|evangéliste|evangeliste|bishop|rev)\.?\s+([a-zà-ÿ'’\- ]{2,})/i,
  /\bavec\s+([a-zà-ÿ'’\- ]{2,})/i,
];

export function getSpeaker(title: string): string {
  const clean = title.replace(/\s+/g, ' ').trim();
  for (const p of SPEAKER_PATTERNS) {
    const m = clean.match(p);
    if (m) {
      const name = (m[2] || m[1] || '').trim();
      // Si pattern "avec X", m[1] contient X dans ce cas
      const candidate = (m[2] ? `${m[1]} ${m[2]}` : m[1]).trim();
      const out = (m[2] ? candidate : name).trim();
      return titleCase(out).slice(0, 60);
    }
  }
  return 'ICC';
}

function titleCase(s: string) {
  return s
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

// Thèmes simples par mots-clés
const THEMES: Array<{ key: string; label: string; re: RegExp }> = [
  { key: 'foi', label: 'Foi', re: rx(['foi', 'croire', 'confiance']) },
  { key: 'pri', label: 'Prière', re: rx(['prière', 'priere', 'intercession']) },
  { key: 'fam', label: 'Famille', re: rx(['famille', 'mariage', 'couple', 'enfants']) },
  { key: 'gue', label: 'Guérison', re: rx(['guérison', 'guerison', 'santé', 'miracle']) },
  { key: 'sal', label: 'Salut', re: rx(['salut', 'repentance', 'conversion']) },
  { key: 'esp', label: 'Saint-Esprit', re: rx(['saint-esprit', 'saint esprit', 'esprit', 'onction']) },
  { key: 'lou', label: 'Louange', re: rx(['louange', 'adoration', 'worship']) },
];

export function getThemes(title: string): string[] {
  const t = title.toLowerCase();
  const out: string[] = [];
  for (const th of THEMES) {
    if (th.re.test(t)) out.push(th.label);
  }
  return out.length ? out : ['Général'];
}