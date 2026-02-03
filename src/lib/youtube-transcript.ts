import { XMLParser } from 'fast-xml-parser';

export type TranscriptSegment = { start: number; dur: number; text: string };
export type TranscriptResult = { language: string; segments: TranscriptSegment[]; text: string };
export type TranscriptDebug = { steps: string[] };

export class TranscriptNotAvailableError extends Error {}

type Track = {
  '@_lang_code'?: string;
  '@_lang_original'?: string;
  '@_lang_translated'?: string;
  '@_name'?: string;
  '@_kind'?: string;
};

type CaptionTrack = {
  baseUrl?: string;
  languageCode?: string;
  name?: { simpleText?: string };
  kind?: string;
  vssId?: string;
};

function decodeHtmlEntities(input: string) {
  if (!input) return '';
  const named: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
  };

  let text = input.replace(/&[a-zA-Z0-9#]+;/g, (match) => named[match] ?? match);
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  text = text.replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  return text;
}

function stripXssiPrefix(input: string) {
  return input.replace(/^\)\]\}'\s*/g, '');
}

function parseTimestamp(ts: string) {
  const m = ts.trim().match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
  if (!m) return 0;
  const h = Number(m[1]);
  const mnt = Number(m[2]);
  const s = Number(m[3]);
  const ms = Number(m[4]);
  return h * 3600 + mnt * 60 + s + ms / 1000;
}

function parseVtt(payload: string): TranscriptSegment[] {
  const lines = payload.replace(/\r/g, '').split('\n');
  const segments: TranscriptSegment[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line || line === 'WEBVTT' || line.startsWith('NOTE')) {
      i += 1;
      continue;
    }
    const timeMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/);
    if (timeMatch) {
      const start = parseTimestamp(timeMatch[1]);
      const end = parseTimestamp(timeMatch[2]);
      i += 1;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i].trim());
        i += 1;
      }
      const text = decodeHtmlEntities(textLines.join(' ')).replace(/\s+/g, ' ').trim();
      if (text) {
        segments.push({ start, dur: Math.max(0, end - start), text });
      }
    } else {
      i += 1;
    }
  }
  return segments;
}

const YT_HEADERS = {
  'accept-language': 'en-US,en;q=0.9',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
  'accept-encoding': 'gzip, deflate, br',
  'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="127"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'upgrade-insecure-requests': '1',
  referer: 'https://www.youtube.com/',
  origin: 'https://www.youtube.com',
  cookie: 'CONSENT=YES+1; SOCS=CAI',
};

function pushDebug(debug: TranscriptDebug | undefined, message: string) {
  if (debug) debug.steps.push(message);
}

function pickTrack(tracks: Track[], preferred?: string) {
  if (!tracks.length) return null;
  const prefer = (preferred ?? '').toLowerCase();
  if (prefer) {
    const match = tracks.find((t) => (t['@_lang_code'] ?? '').toLowerCase() === prefer);
    if (match) return match;
  }

  const fr = tracks.find((t) => (t['@_lang_code'] ?? '').toLowerCase().startsWith('fr'));
  if (fr) return fr;
  const en = tracks.find((t) => (t['@_lang_code'] ?? '').toLowerCase().startsWith('en'));
  if (en) return en;
  return tracks[0];
}

function pickCaptionTrack(tracks: CaptionTrack[], preferred?: string) {
  if (!tracks.length) return null;
  const prefer = (preferred ?? '').toLowerCase();
  if (prefer) {
    const exact = tracks.find((t) => (t.languageCode ?? '').toLowerCase() === prefer);
    if (exact) return exact;
    const vss = tracks.find((t) => (t.vssId ?? '').toLowerCase().endsWith(`.${prefer}`));
    if (vss) return vss;
  }

  const fr = tracks.find((t) => (t.languageCode ?? '').toLowerCase().startsWith('fr'));
  if (fr) return fr;
  const en = tracks.find((t) => (t.languageCode ?? '').toLowerCase().startsWith('en'));
  if (en) return en;
  return tracks[0];
}

function extractJson(html: string, marker: string) {
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const start = html.indexOf('{', idx);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i += 1) {
    const ch = html[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        const json = html.slice(start, i + 1);
        try {
          return JSON.parse(json);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function parseJson3Transcript(data: any): TranscriptSegment[] {
  const events = Array.isArray(data?.events) ? data.events : [];
  const segments: TranscriptSegment[] = [];
  for (const event of events) {
    const rawSegs = Array.isArray(event?.segs) ? event.segs : [];
    const text = rawSegs.map((s: any) => s?.utf8 ?? '').join('');
    const cleaned = decodeHtmlEntities(text).replace(/\s+/g, ' ').trim();
    if (!cleaned) continue;
    const start = Number(event?.tStartMs ?? 0) / 1000;
    const dur = Number(event?.dDurationMs ?? 0) / 1000;
    segments.push({ start, dur, text: cleaned });
  }
  return segments;
}

async function fetchFromCaptionTrack(track: CaptionTrack, debug?: TranscriptDebug): Promise<TranscriptResult | null> {
  if (!track?.baseUrl) return null;
  const base = track.baseUrl;
  const urls: Array<{ label: string; url: string }> = [];

  try {
    const u = new URL(base);
    u.searchParams.set('fmt', 'json3');
    urls.push({ label: 'json3', url: u.toString() });
    const vtt = new URL(base);
    vtt.searchParams.set('fmt', 'vtt');
    urls.push({ label: 'vtt', url: vtt.toString() });
  } catch {
    const hasFmt = base.includes('fmt=');
    urls.push({ label: 'json3', url: `${base}${hasFmt ? '' : '&fmt=json3'}` });
    urls.push({ label: 'vtt', url: `${base}${hasFmt ? '' : '&fmt=vtt'}` });
  }
  urls.push({ label: 'base', url: base });

  for (const attempt of urls) {
    const res = await fetch(attempt.url, { cache: 'no-store', headers: YT_HEADERS });
    pushDebug(debug, `captionTrack(${attempt.label}) status=${res.status} ok=${res.ok}`);
    if (!res.ok) continue;
    const text = await res.text();
    const cleaned = stripXssiPrefix(text);
    pushDebug(debug, `captionTrack(${attempt.label}) bytes=${cleaned.length}`);
    if (!cleaned.trim()) continue;

    if (cleaned.trim().startsWith('{') || cleaned.trim().startsWith('[')) {
      try {
        const data = JSON.parse(cleaned);
        const segments = parseJson3Transcript(data);
        if (!segments.length) continue;
        pushDebug(debug, `captionTrack parsed=json3 segments=${segments.length}`);
        return {
          language: track.languageCode ?? 'en',
          segments,
          text: segments.map((s) => s.text).join(' '),
        };
      } catch {
        // fallthrough
      }
    }

    if (cleaned.trim().startsWith('WEBVTT')) {
      const segments = parseVtt(cleaned);
      if (!segments.length) continue;
      pushDebug(debug, `captionTrack parsed=vtt segments=${segments.length}`);
      return {
        language: track.languageCode ?? 'en',
        segments,
        text: segments.map((s) => s.text).join(' '),
      };
    }

    const parser = new XMLParser({ ignoreAttributes: false });
    const transcriptData = parser.parse(cleaned);
    const textsRaw = transcriptData?.transcript?.text ?? [];
    const texts = Array.isArray(textsRaw) ? textsRaw : textsRaw ? [textsRaw] : [];
    const segments: TranscriptSegment[] = texts.map((node: any) => {
      const start = Number(node?.['@_start'] ?? 0);
      const dur = Number(node?.['@_dur'] ?? 0);
      const raw = typeof node === 'string' ? node : node?.['#text'] ?? '';
      const cleanedText = decodeHtmlEntities(String(raw)).replace(/\s+/g, ' ').trim();
      return { start, dur, text: cleanedText };
    }).filter((s) => s.text.length > 0);
    if (!segments.length) continue;
    pushDebug(debug, `captionTrack parsed=xml segments=${segments.length}`);
    return {
      language: track.languageCode ?? 'en',
      segments,
      text: segments.map((s) => s.text).join(' '),
    };
  }

  return null;
}

async function fetchTranscriptFromWatch(videoId: string, lang?: string, debug?: TranscriptDebug): Promise<TranscriptResult | null> {
  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en&bpctr=9999999999&has_verified=1`;
  const res = await fetch(watchUrl, { 
    headers: { ...YT_HEADERS, 'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate', 'sec-fetch-site': 'none' }, 
    cache: 'no-store',
    credentials: 'omit' // Empêche l'envoi de cookies de session qui pourraient causer des problèmes
  });
  pushDebug(debug, `watch fetch status=${res.status} ok=${res.ok}`);
  if (!res.ok) return null;
  const html = await res.text();
  if (!html) return null;

  const playerResponse = extractJson(html, 'ytInitialPlayerResponse');
  pushDebug(debug, `watch playerResponse=${!!playerResponse}`);
  const tracksRaw = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  const tracks = Array.isArray(tracksRaw) ? tracksRaw : tracksRaw ? [tracksRaw] : [];
  pushDebug(debug, `watch captionTracks=${tracks.length}`);
  const track = pickCaptionTrack(tracks as CaptionTrack[], lang);
  if (!track) return null;
  pushDebug(debug, `watch pickedLang=${track.languageCode ?? 'unknown'}`);

  return await fetchFromCaptionTrack(track, debug);
}

async function fetchTranscriptFromTimedTextList(videoId: string, lang?: string, debug?: TranscriptDebug): Promise<TranscriptResult | null> {
  const listUrl = `https://www.youtube.com/api/timedtext?type=list&v=${encodeURIComponent(videoId)}`;
  const listRes = await fetch(listUrl, { cache: 'no-store', headers: YT_HEADERS });
  pushDebug(debug, `list fetch status=${listRes.status} ok=${listRes.ok}`);
  const listXml = listRes.ok ? await listRes.text() : '';

  const parser = new XMLParser({ ignoreAttributes: false });
  const listData = listXml ? parser.parse(listXml) : null;
  const tracksRaw = listData?.transcript_list?.track ?? [];
  const tracks = Array.isArray(tracksRaw) ? tracksRaw : tracksRaw ? [tracksRaw] : [];
  pushDebug(debug, `list tracks=${tracks.length}`);
  const track = pickTrack(tracks as Track[], lang);
  if (!track) return null;
  pushDebug(debug, `list pickedLang=${track['@_lang_code'] ?? 'unknown'}`);

  const langCode = track['@_lang_code'] ?? 'en';
  const name = track['@_name'] ? `&name=${encodeURIComponent(track['@_name'] ?? '')}` : '';
  const kind = track['@_kind'] ? `&kind=${encodeURIComponent(track['@_kind'] ?? '')}` : '';
  const transcriptUrl =
    `https://www.youtube.com/api/timedtext?lang=${encodeURIComponent(langCode)}` +
    `${name}${kind}&v=${encodeURIComponent(videoId)}`;

  const transcriptRes = await fetch(transcriptUrl, { cache: 'no-store', headers: YT_HEADERS });
  pushDebug(debug, `list transcript status=${transcriptRes.status} ok=${transcriptRes.ok}`);
  if (!transcriptRes.ok) return null;

  const transcriptXml = await transcriptRes.text();
  if (!transcriptXml || transcriptXml.trim() === '') return null;

  const parsed = parseTranscriptResponse(transcriptXml);
  if (!parsed?.segments?.length) return null;
  pushDebug(debug, `list transcript segments=${parsed.segments.length}`);
  return {
    language: langCode,
    segments: parsed.segments,
    text: parsed.text,
  };
}

function parseTranscriptResponse(payload: string): TranscriptResult | null {
  const raw = stripXssiPrefix(payload).trim();
  if (!raw) return null;

  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      const data = JSON.parse(raw);
      const segments = parseJson3Transcript(data);
      if (!segments.length) return null;
      return {
        language: 'unknown',
        segments,
        text: segments.map((s) => s.text).join(' '),
      };
    } catch {
      return null;
    }
  }

  const parser = new XMLParser({ ignoreAttributes: false });
  const transcriptData = parser.parse(raw);
  const textsRaw = transcriptData?.transcript?.text ?? [];
  const texts = Array.isArray(textsRaw) ? textsRaw : textsRaw ? [textsRaw] : [];
  const segments: TranscriptSegment[] = texts.map((node: any) => {
    const start = Number(node?.['@_start'] ?? 0);
    const dur = Number(node?.['@_dur'] ?? 0);
    const textNode = typeof node === 'string' ? node : node?.['#text'] ?? '';
    const text = decodeHtmlEntities(String(textNode)).replace(/\s+/g, ' ').trim();
    return { start, dur, text };
  }).filter((s) => s.text.length > 0);

  if (!segments.length) return null;
  return {
    language: 'unknown',
    segments,
    text: segments.map((s) => s.text).join(' '),
  };
}

async function fetchDirectTimedText(videoId: string, langCode: string, kind?: string, host = 'www.youtube.com', debug?: TranscriptDebug) {
  const params = new URLSearchParams({ v: videoId, lang: langCode, fmt: 'json3' });
  if (kind) {
    params.set('kind', kind);
    params.set('caps', kind);
  }
  const urls = [
    `https://${host}/api/timedtext?${params.toString()}`,
    `https://${host}/api/timedtext?${params.toString().replace('fmt=json3', 'fmt=vtt')}`,
    `https://${host}/api/timedtext?${params.toString().replace('fmt=json3', 'fmt=srv3')}`,
  ];

  for (const url of urls) {
    const res = await fetch(url, { 
      cache: 'no-store', 
      headers: { ...YT_HEADERS, 'sec-fetch-dest': 'empty', 'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-origin' },
      credentials: 'omit'
    });
    pushDebug(debug, `direct ${host} lang=${langCode} kind=${kind ?? 'none'} status=${res.status} ok=${res.ok}`);
    if (!res.ok) continue;
    const text = await res.text();
    const parsed = parseTranscriptResponse(text);
    if (!parsed) {
      pushDebug(debug, `direct ${host} bytes=${text.length} parsed=0`);
      continue;
    }
    pushDebug(debug, `direct ${host} segments=${parsed.segments.length}`);
    return {
      ...parsed,
      language: langCode,
    } as TranscriptResult;
  }

  return null;
}

export async function getYoutubeTranscript(videoId: string, lang?: string): Promise<TranscriptResult> {
  const fromWatch = await fetchTranscriptFromWatch(videoId, lang);
  if (fromWatch?.segments?.length) return fromWatch;

  const fromList = await fetchTranscriptFromTimedTextList(videoId, lang);
  if (fromList?.segments?.length) return fromList;

  const fallbacks = [lang, 'fr', 'en', 'en-US'].filter(Boolean) as string[];
  for (const code of fallbacks) {
    const direct = await fetchDirectTimedText(videoId, code);
    if (direct?.segments?.length) return direct;
    const asr = await fetchDirectTimedText(videoId, code, 'asr');
    if (asr?.segments?.length) return asr;
    const directAlt = await fetchDirectTimedText(videoId, code, undefined, 'video.google.com');
    if (directAlt?.segments?.length) return directAlt;
    const asrAlt = await fetchDirectTimedText(videoId, code, 'asr', 'video.google.com');
    if (asrAlt?.segments?.length) return asrAlt;
  }

  throw new TranscriptNotAvailableError('Transcript not available');
}

export async function getYoutubeTranscriptDebug(videoId: string, lang?: string) {
  const debug: TranscriptDebug = { steps: [] };

  const fromWatch = await fetchTranscriptFromWatch(videoId, lang, debug);
  if (fromWatch?.segments?.length) {
    return { ok: true as const, result: fromWatch, debug };
  }

  const fromList = await fetchTranscriptFromTimedTextList(videoId, lang, debug);
  if (fromList?.segments?.length) {
    return { ok: true as const, result: fromList, debug };
  }

  const fallbacks = [lang, 'fr', 'en', 'en-US'].filter(Boolean) as string[];
  for (const code of fallbacks) {
    const direct = await fetchDirectTimedText(videoId, code, undefined, 'www.youtube.com', debug);
    if (direct?.segments?.length) return { ok: true as const, result: direct, debug };
    const asr = await fetchDirectTimedText(videoId, code, 'asr', 'www.youtube.com', debug);
    if (asr?.segments?.length) return { ok: true as const, result: asr, debug };
    const directAlt = await fetchDirectTimedText(videoId, code, undefined, 'video.google.com', debug);
    if (directAlt?.segments?.length) return { ok: true as const, result: directAlt, debug };
    const asrAlt = await fetchDirectTimedText(videoId, code, 'asr', 'video.google.com', debug);
    if (asrAlt?.segments?.length) return { ok: true as const, result: asrAlt, debug };
  }

  return { ok: false as const, error: 'Transcript not available', debug };
}
