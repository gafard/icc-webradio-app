import { NextResponse } from 'next/server';
import { ImageResponse } from 'next/og';
import { supabaseServer } from '@/lib/supabaseServer';

export const runtime = 'edge';

function safeFileName(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
}

async function getVerseFromYouVersion() {
  // ✅ À remplacer par ton vrai endpoint YouVersion quand tu l’as.
  // Pour l’instant fallback stable :
  return {
    reference: 'Psaumes 23:1',
    text: "L'Éternel est mon berger: je ne manquerai de rien.",
  };
}

export async function POST(req: Request) {
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Supabase server non configuré' }, { status: 500 });
  }

  const body = await req.json();
  const author_name = (body?.author_name || '').trim();
  const author_device_id = (body?.author_device_id || '').trim();

  if (!author_name || !author_device_id) {
    return NextResponse.json({ error: 'author_name / author_device_id manquants' }, { status: 400 });
  }

  // 1) Verse
  const verse = await getVerseFromYouVersion();
  const verseText = verse.text;
  const verseRef = verse.reference;

  // 2) PNG render
  const img = new ImageResponse(
    (
      <div
        style={{
          width: 1080,
          height: 1920,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 80,
          background: 'linear-gradient(135deg, rgba(99,102,241,1) 0%, rgba(236,72,153,1) 45%, rgba(245,158,11,1) 100%)',
          position: 'relative',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
        }}
      >
        {/* overlay soft */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
          }}
        />

        <div style={{ position: 'relative', zIndex: 2, color: 'white', opacity: 0.9, letterSpacing: 4, fontSize: 28, textTransform: 'uppercase' }}>
          Story • Verset
        </div>

        <div style={{ position: 'relative', zIndex: 2 }}>
          {/* highlight "feutre" */}
          <div
            style={{
              display: 'inline',
              fontSize: 72,
              fontWeight: 900,
              lineHeight: 1.15,
              color: 'white',
              padding: '10px 18px',
              background:
                'linear-gradient(transparent 55%, rgba(255, 255, 0, 0.45) 55%)',
              borderRadius: 18,
              boxDecorationBreak: 'clone',
              WebkitBoxDecorationBreak: 'clone',
            }}
          >
            {verseText}
          </div>

          <div style={{ marginTop: 30, fontSize: 34, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
            {verseRef}
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 2, color: 'rgba(255,255,255,0.75)', fontSize: 24 }}>
          ICC • Communautés
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
    }
  );

  const pngArrayBuffer = await img.arrayBuffer();
  const pngBytes = new Uint8Array(pngArrayBuffer);

  // 3) Upload storage
  const fileName = `${Date.now()}_${safeFileName(verseRef)}.png`;
  const path = `stories/${author_device_id}/${fileName}`;

  const { error: upErr } = await supabaseServer.storage
    .from('community-stories')
    .upload(path, pngBytes, {
      contentType: 'image/png',
      upsert: true,
    });

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data: pub } = supabaseServer.storage
    .from('community-stories')
    .getPublicUrl(path);

  const image_url = pub?.publicUrl || null;

  // 4) Insert DB
  const { data: story, error: insErr } = await supabaseServer
    .from('community_stories')
    .insert([
      {
        author_name,
        author_device_id,
        verse_text: verseText,
        verse_reference: verseRef,
        image_url,
      },
    ])
    .select()
    .single();

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ story });
}