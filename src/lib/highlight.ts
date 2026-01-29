export function highlightSnippet(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const parts = q.split(/\s+/).filter(Boolean).slice(0, 4); // évite trop de regex
  let out = text;
  for (const p of parts) {
    const re = new RegExp(`(${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
    out = out.replace(re, '<mark class="bg-yellow-300/30 text-white px-1 rounded">$1</mark>');
  }
  return out;
}