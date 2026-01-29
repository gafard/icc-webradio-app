export type AaiTranscriptStatus = 'queued' | 'processing' | 'completed' | 'error';

export type AaiTranscript = {
  id: string;
  status: AaiTranscriptStatus;
  text?: string;
  error?: string;

  // options utiles
  summary?: string;
  chapters?: Array<{
    start: number;
    end: number;
    gist: string;
    headline: string;
    summary: string;
  }>;
};

const BASE = 'https://api.assemblyai.com/v2';

function headers() {
  const key = process.env.ASSEMBLYAI_API_KEY;
  if (!key) throw new Error('Missing ASSEMBLYAI_API_KEY');
  return {
    authorization: key,
    'content-type': 'application/json',
  } as Record<string, string>;
}

export async function aaiCreateTranscript(opts: {
  audio_url: string;
  language_code?: 'fr';
  summarization?: boolean;
  summary_type?: 'bullets' | 'paragraph' | 'headline';
  summary_model?: 'informative' | 'conversational';
  auto_chapters?: boolean;
}) {
  const res = await fetch(`${BASE}/transcript`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AssemblyAI create transcript failed: ${res.status} ${t}`);
  }
  return (await res.json()) as { id: string; status: AaiTranscriptStatus };
}

export async function aaiGetTranscript(id: string): Promise<AaiTranscript> {
  const res = await fetch(`${BASE}/transcript/${id}`, {
    method: 'GET',
    headers: headers(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AssemblyAI get transcript failed: ${res.status} ${t}`);
  }
  const data = await res.json();

  return {
    id: data.id,
    status: data.status,
    text: data.text,
    error: data.error,
    summary: data.summary,
    chapters: data.chapters,
  };
}