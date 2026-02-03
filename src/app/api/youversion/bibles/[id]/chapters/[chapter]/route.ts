import { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; chapter: string } }
) {
  const { id: bibleId, chapter } = params;
  const appKey = process.env.YVP_APP_KEY;

  if (!appKey) {
    return NextResponse.json({ error: "Missing YVP_APP_KEY" }, { status: 500 });
  }

  // Construire l'URL pour récupérer un chapitre spécifique
  const url = new URL(`https://api.youversion.com/v1/bibles/${bibleId}/chapters/${chapter}`);
  url.searchParams.append('content_type', 'json'); // Assurez-vous d'obtenir le format JSON

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "X-YVP-App-Key": appKey,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || `Erreur API: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur de réseau" },
      { status: 500 }
    );
  }
}