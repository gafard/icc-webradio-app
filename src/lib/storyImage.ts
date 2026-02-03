import type { LocalVerse } from './localBible';

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';

  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    const m = ctx.measureText(test);
    if (m.width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function renderVerseStoryPng(verse: LocalVerse, opts?: { theme?: 'day' | 'night' }) {
  const theme = opts?.theme ?? 'day';

  const W = 1080;
  const H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas non supporté');

  // Fond "blanc doux" (jour) / "nuit" simple
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  if (theme === 'day') {
    grad.addColorStop(0, '#f7f7fb');
    grad.addColorStop(1, '#ffffff');
  } else {
    grad.addColorStop(0, '#0b1020');
    grad.addColorStop(1, '#090a0f');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Légère texture (points)
  ctx.globalAlpha = theme === 'day' ? 0.06 : 0.08;
  for (let i = 0; i < 1400; i += 1) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    ctx.fillStyle = theme === 'day' ? '#000' : '#fff';
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;

  // Zone texte
  const padX = 90;
  const maxTextWidth = W - padX * 2;

  const ref = `${verse.book} ${verse.chapter}:${verse.verse}`;
  const body = verse.text;

  // Titre / référence
  ctx.font = '600 42px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  ctx.fillStyle = theme === 'day' ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.85)';
  ctx.fillText('Verset du jour', padX, 220);

  ctx.font = '700 44px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  ctx.fillStyle = theme === 'day' ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.92)';
  ctx.fillText(ref, padX, 285);

  // Texte principal (style "feutre" via surlignage)
  const textTop = 460;
  const lineHeight = 78;

  ctx.font = '700 58px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  const lines = wrapText(ctx, body, maxTextWidth);

  // Surlignage (feutre) derrière chaque ligne
  const highlightColor = theme === 'day' ? 'rgba(255, 230, 120, 0.65)' : 'rgba(255, 210, 90, 0.35)';
  const strokeColor = theme === 'day' ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.92)';

  for (let i = 0; i < lines.length; i += 1) {
    const y = textTop + i * lineHeight;
    const m = ctx.measureText(lines[i]);
    const w = Math.min(maxTextWidth, m.width + 60);

    // petit "coup de feutre" arrondi
    ctx.fillStyle = highlightColor;
    roundedRect(ctx, padX - 10, y - 58, w, 74, 28);
    ctx.fill();

    // texte + légère ombre
    ctx.shadowColor = theme === 'day' ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = strokeColor;
    ctx.fillText(lines[i], padX, y);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  // Footer discret
  ctx.globalAlpha = theme === 'day' ? 0.55 : 0.6;
  ctx.font = '600 30px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  ctx.fillStyle = theme === 'day' ? '#0f172a' : '#ffffff';
  ctx.fillText(`Version: ${verse.version}`, padX, H - 140);
  ctx.globalAlpha = 1;

  const dataUrl = canvas.toDataURL('image/png');
  return { dataUrl, canvas };
}

export function downloadDataUrl(filename: string, dataUrl: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}