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

function hashString(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
}

function pickBySeed<T>(items: T[], seed: number) {
  if (!items.length) throw new Error('No items to pick from');
  return items[seed % items.length];
}

function createSeededRandom(seed: number) {
  let x = seed || 123456789;
  return () => {
    // xorshift32
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 1000000) / 1000000;
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image load failed: ${src}`));
    img.src = src;
  });
}

async function drawCoverImage(ctx: CanvasRenderingContext2D, src: string, width: number, height: number) {
  const img = await loadImage(src);
  const scale = Math.max(width / img.width, height / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const dx = (width - drawW) / 2;
  const dy = (height - drawH) / 2;
  ctx.drawImage(img, dx, dy, drawW, drawH);
}

const PHOTO_BACKGROUNDS = ['/hero-radio-new.jpg', '/hero-radio.jpg'];

const DAY_GRADIENTS: Array<[string, string, string]> = [
  ['#2f80ed', '#56ccf2', '#f6d365'],
  ['#7f7fd5', '#86a8e7', '#91eae4'],
  ['#43cea2', '#185a9d', '#0f172a'],
];

const NIGHT_GRADIENTS: Array<[string, string, string]> = [
  ['#0b1220', '#102347', '#1e3a8a'],
  ['#0f172a', '#1e1b4b', '#312e81'],
  ['#111827', '#0f2a53', '#0a3b66'],
];

function drawGradientBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colors: [string, string, string]
) {
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(0.55, colors[1]);
  grad.addColorStop(1, colors[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

function drawAbstractBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: number,
  theme: 'day' | 'night'
) {
  const palettes =
    theme === 'day'
      ? [
          ['#1d4ed8', '#0ea5e9', '#22c55e', '#f59e0b'],
          ['#7c3aed', '#2563eb', '#06b6d4', '#10b981'],
          ['#0891b2', '#6366f1', '#ec4899', '#f97316'],
        ]
      : [
          ['#1e1b4b', '#0f172a', '#1d4ed8', '#0369a1'],
          ['#111827', '#1e3a8a', '#5b21b6', '#0f766e'],
          ['#172554', '#312e81', '#4338ca', '#0f172a'],
        ];
  const palette = pickBySeed(palettes, seed);
  const rand = createSeededRandom(seed);

  drawGradientBackground(ctx, width, height, [palette[0], palette[1], palette[2]]);

  // Big blurred blobs
  for (let i = 0; i < 12; i += 1) {
    const cx = rand() * width;
    const cy = rand() * height;
    const radius = (0.12 + rand() * 0.28) * Math.min(width, height);
    const color = palette[Math.floor(rand() * palette.length)];
    const alpha = theme === 'day' ? 0.18 + rand() * 0.2 : 0.12 + rand() * 0.16;

    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    g.addColorStop(0, `${color}${Math.floor(alpha * 255)
      .toString(16)
      .padStart(2, '0')}`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine diagonal strokes for "abstract" texture
  ctx.save();
  ctx.globalAlpha = theme === 'day' ? 0.08 : 0.1;
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 60; i += 1) {
    const x = rand() * width;
    const y = rand() * height;
    const len = 60 + rand() * 180;
    const angle = (20 + rand() * 60) * (Math.PI / 180);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.restore();
}

export async function renderVerseStoryPng(
  verse: LocalVerse,
  opts?: { theme?: 'day' | 'night'; style?: 'photo' | 'gradient' | 'abstract' }
) {
  const theme = opts?.theme ?? 'day';
  const style = opts?.style ?? 'gradient';

  const W = 1080;
  const H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas non supporté');

  const seed = hashString(`${verse.book}|${verse.chapter}|${verse.verse}|${verse.text}`);
  let photoDrawn = false;

  if (style === 'photo') {
    const selectedPhoto = pickBySeed(PHOTO_BACKGROUNDS, seed);
    try {
      await drawCoverImage(ctx, selectedPhoto, W, H);
      photoDrawn = true;
    } catch {
      photoDrawn = false;
    }
  }

  if (!photoDrawn && style === 'abstract') {
    drawAbstractBackground(ctx, W, H, seed, theme);
  } else if (!photoDrawn) {
    const gradients = theme === 'day' ? DAY_GRADIENTS : NIGHT_GRADIENTS;
    drawGradientBackground(ctx, W, H, pickBySeed(gradients, seed));
  }

  // Overlay sombre pour lisibilité type "YouVersion".
  const readability = ctx.createLinearGradient(0, 0, 0, H);
  readability.addColorStop(0, 'rgba(0, 0, 0, 0.25)');
  readability.addColorStop(0.5, 'rgba(0, 0, 0, 0.45)');
  readability.addColorStop(1, 'rgba(0, 0, 0, 0.62)');
  ctx.fillStyle = readability;
  ctx.fillRect(0, 0, W, H);

  // Grains légers pour relief.
  const noiseAlpha = theme === 'day' ? 0.05 : 0.09;
  ctx.globalAlpha = noiseAlpha;
  for (let i = 0; i < 1600; i += 1) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;

  // Zone texte
  const padX = 86;
  const maxTextWidth = W - padX * 2;

  const ref = `${verse.book} ${verse.chapter}:${verse.verse}`;
  const body = verse.text;

  // Glass card derrière le texte.
  const cardX = 52;
  const cardY = 230;
  const cardW = W - 104;
  const cardH = H - 500;
  roundedRect(ctx, cardX, cardY, cardW, cardH, 42);
  ctx.fillStyle = 'rgba(7, 12, 24, 0.38)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.stroke();

  // Titre / référence
  ctx.font = '600 40px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  ctx.fillStyle = 'rgba(224, 235, 255, 0.95)';
  ctx.fillText('Verset du jour', padX, 330);

  ctx.font = '700 48px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.98)';
  ctx.fillText(ref, padX, 390);

  // Texte principal.
  const textTop = 560;
  const lineHeight = 76;

  ctx.font = '700 56px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  const lines = wrapText(ctx, body, maxTextWidth);

  const strokeColor = 'rgba(255,255,255,0.98)';

  for (let i = 0; i < lines.length; i += 1) {
    const y = textTop + i * lineHeight;

    // Texte + légère ombre.
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = strokeColor;
    ctx.fillText(lines[i], padX, y);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  // Footer discret.
  ctx.globalAlpha = 0.82;
  ctx.font = '600 30px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`Version: ${verse.version}`, padX, H - 170);
  ctx.fillText('ICC Community', padX, H - 120);
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
