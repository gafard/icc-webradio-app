import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');

    if (!url) {
      return Response.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    // Vérifier que l'URL est autorisée (sécurité)
    if (!url.startsWith('/bible/') || !url.match(/\.(json)$/)) {
      return Response.json({ error: 'Invalid URL' }, { status: 400 });
    }

    // Construire le chemin absolu du fichier
    const filePath = path.join(process.cwd(), 'public', url);

    // Vérifier que le chemin est dans le répertoire public/bible (sécurité)
    const bibleDir = path.join(process.cwd(), 'public', 'bible');
    const relativePath = path.relative(bibleDir, filePath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return Response.json({ error: 'Forbidden path' }, { status: 403 });
    }

    if (!fs.existsSync(filePath)) {
      return Response.json({ error: 'File not found' }, { status: 404 });
    }

    let content = fs.readFileSync(filePath, 'utf8');

    // Convertir le format JS en JSON
    try {
      // Remplacer les propriétés sans guillemets par des propriétés avec guillemets
      // Format: {PropertyName: ...} -> {"PropertyName": ...}
      content = content.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=:)/g, '$1"$2"');

      // Remplacer les apostrophes simples par des guillemets doubles dans les valeurs
      // Cette regex remplace les apostrophes simples qui entourent des valeurs
      content = content.replace(/:\s*'([^']*?)'(?=\s*[,\}])/g, ': "$1"');

      // Parser le JSON résultant
      const parsed = JSON.parse(content);
      return Response.json(parsed);
    } catch (parseError: any) {
      console.error('Error parsing converted content:', parseError);
      return Response.json({ error: `Parse error: ${parseError.message}` }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error in API route:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}