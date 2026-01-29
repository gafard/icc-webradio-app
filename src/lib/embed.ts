export async function embedText(text: string): Promise<number[]> {
  const url = process.env.EMBED_URL;
  if (!url) throw new Error('EMBED_URL missing');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Important: on envoie pas 200k chars -> limite
    body: JSON.stringify({ text: text.slice(0, 12000) }),
  });

  if (!res.ok) throw new Error(`Embed service failed: ${res.status}`);
  const data = await res.json();
  return (data.embedding ?? []) as number[];
}