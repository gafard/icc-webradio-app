export function parseEpisodeNumber(title: string): number | null {
  const t = title ?? '';

  const m =
    t.match(/(?:\bEP\b|\bEPI\b|\bÉP\b|\bEPISODE\b|\bÉPISODE\b)\s*[:\-]?\s*0*([0-9]{1,4})/i) ||
    t.match(/(?:#|N°|No\.?)\s*0*([0-9]{1,4})/i) ||
    t.match(/\b0*([0-9]{1,4})\b\s*\/\s*\b0*([0-9]{1,4})\b/); // 3/20

  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function parseSerieFromTitle(title: string): string | null {
  const t = (title ?? '').trim();
  if (!t) return null;

  // coupe avant EP/Episode/#/No/N°
  const m = t.match(/^(.*?)(?:\bEP\b|\bEPI\b|\bÉP\b|\bEPISODE\b|\bÉPISODE\b|#|N°|No\.?)/i);

  // ou coupe avant "12/30"
  const m2 = t.match(/^(.*?)(?:\b0*[0-9]{1,4}\b\s*\/\s*\b0*[0-9]{1,4}\b)/i);

  const raw = (m?.[1] || m2?.[1] || '')
    .replace(/[\|\-–—:]+$/g, '')
    .trim();

  return raw && raw.length >= 3 ? raw : null;
}

export function normalizeSerie(s: string) {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // enlève accents
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const SERIE_ALIASES: Record<string, string> = {
  'ecole croissance': 'École de croissance',
  'ecole de croissance': 'École de croissance',
};

export function applyAlias(serie: string) {
  const key = normalizeSerie(serie);
  return SERIE_ALIASES[key] ?? serie;
}