import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type SummaryPayload = {
  summary: string;
  bullets: string[];
  warning?: string;
};

function clipText(input: string, max = 28000) {
  return input.length > max ? input.slice(0, max) : input;
}

function splitSentences(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function fallbackSummary(text: string): SummaryPayload {
  const sentences = splitSentences(text);
  if (!sentences.length) {
    return {
      summary: 'No summary available for this transcript.',
      bullets: [],
      warning: 'Empty transcript',
    };
  }

  const top = sentences.slice(0, Math.min(4, sentences.length));
  const summary = top.join(' ');
  const bullets = top.slice(0, 5);
  return { summary, bullets };
}

function extractJsonObject(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    // Ignore and try bracket matching.
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeAiPayload(payload: any, fallback: SummaryPayload): SummaryPayload {
  const summary =
    typeof payload?.summary === 'string' && payload.summary.trim()
      ? payload.summary.trim()
      : fallback.summary;
  const bullets =
    Array.isArray(payload?.bullets) && payload.bullets.length
      ? payload.bullets
          .map((item: unknown) => String(item ?? '').trim())
          .filter(Boolean)
          .slice(0, 8)
      : fallback.bullets;
  return { summary, bullets };
}

async function askOpenAI(apiKey: string, text: string, title?: string) {
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const endpoint = `${baseUrl}/chat/completions`;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${apiKey}`,
  };
  // Optional OpenRouter metadata headers.
  if (process.env.OPENROUTER_HTTP_REFERER) {
    headers['HTTP-Referer'] = process.env.OPENROUTER_HTTP_REFERER;
  }
  if (process.env.OPENROUTER_X_TITLE) {
    headers['X-Title'] = process.env.OPENROUTER_X_TITLE;
  }
  const configuredSingle = (process.env.OPENAI_SUMMARY_MODEL || '').trim();
  const configuredMulti = (process.env.OPENAI_SUMMARY_MODELS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const isOpenRouter = /openrouter\.ai/i.test(baseUrl);
  const candidateModels = configuredSingle
    ? [configuredSingle]
    : configuredMulti.length
      ? configuredMulti
      : isOpenRouter
        ? [
            // Defaults for OpenRouter free tier. Override with OPENAI_SUMMARY_MODEL(S) if needed.
            'qwen/qwen3-30b-a3b:free',
            'z-ai/glm-4.5-air:free',
          ]
        : ['gpt-4o-mini'];

  const prompt = [
    'Summarize this YouTube transcript in French.',
    'Return strict JSON only: {"summary":"...", "bullets":["...", "..."]}.',
    'Use 3 to 6 bullet points.',
    title ? `Title: ${title}` : '',
    '',
    text,
  ]
    .filter(Boolean)
    .join('\n');

  const errors: string[] = [];
  for (const model of candidateModels) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: 'You are a precise summarizer. Output JSON only.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      errors.push(`${model}: ${response.status} ${details}`);
      continue;
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content ?? '';
    const parsed = extractJsonObject(String(content));
    if (parsed) return parsed;
    errors.push(`${model}: invalid JSON output`);
  }

  throw new Error(`OpenAI-compatible summary failed (${errors.join(' | ')})`);
}

async function askAnthropic(apiKey: string, text: string, title?: string) {
  const prompt = [
    'Resume en francais cette transcription YouTube.',
    'Reponds en JSON strict: {"summary":"...", "bullets":["...", "..."]}.',
    '3 a 6 points.',
    title ? `Titre: ${title}` : '',
    '',
    text,
  ]
    .filter(Boolean)
    .join('\n');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_SUMMARY_MODEL || 'claude-3-5-sonnet-latest',
      max_tokens: 900,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Anthropic error ${response.status}: ${details}`);
  }

  const json = await response.json();
  const content = json?.content?.[0]?.text ?? '';
  return extractJsonObject(String(content));
}

async function askGemini(apiKey: string, text: string, title?: string) {
  const prompt = [
    'Resume en francais cette transcription YouTube.',
    'Reponds en JSON strict: {"summary":"...", "bullets":["...", "..."]}.',
    '3 a 6 points.',
    title ? `Titre: ${title}` : '',
    '',
    text,
  ]
    .filter(Boolean)
    .join('\n');

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Gemini error ${response.status}: ${details}`);
  }

  const json = await response.json();
  const content = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return extractJsonObject(String(content));
}

async function generateSummaryWithAI(text: string, title?: string) {
  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();
  const fallback = fallbackSummary(text);

  if (provider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { ...fallback, warning: 'ANTHROPIC_API_KEY missing' };
    const payload = await askAnthropic(apiKey, text, title);
    return normalizeAiPayload(payload, fallback);
  }

  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { ...fallback, warning: 'GEMINI_API_KEY missing' };
    const payload = await askGemini(apiKey, text, title);
    return normalizeAiPayload(payload, fallback);
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return {
      ...fallback,
      warning: 'OPENAI_API_KEY/OPENROUTER_API_KEY missing',
    };
  }
  const payload = await askOpenAI(apiKey, text, title);
  return normalizeAiPayload(payload, fallback);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawText = String(body?.text ?? '').trim();
    const videoId = String(body?.videoId ?? '').trim();
    const title = String(body?.title ?? '').trim();

    if (!rawText) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    const text = clipText(rawText);
    if (text.length < 50) {
      const fallback = fallbackSummary(text);
      return NextResponse.json({
        ...fallback,
        videoId,
        title,
        warning: 'Transcript too short for AI summary',
      });
    }

    try {
      const data = await generateSummaryWithAI(text, title);
      return NextResponse.json({ ...data, videoId, title });
    } catch (error: any) {
      const fallback = fallbackSummary(text);
      return NextResponse.json({
        ...fallback,
        videoId,
        title,
        warning: error?.message ?? 'Summary generation failed',
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Internal server error' },
      { status: 500 }
    );
  }
}
