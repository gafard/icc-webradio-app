import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text, videoId, title } = await request.json();
    
    // Valider les paramètres
    if (!text) {
      return NextResponse.json({ error: 'text est requis' }, { status: 400 });
    }

    // Vérifier la longueur du texte pour s'assurer qu'il y a assez de contenu à résumer
    if (text.length < 50) {
      return NextResponse.json({ 
        error: 'Texte trop court pour générer un résumé significatif', 
        summary: 'Aucun résumé disponible : la transcription est trop courte.',
        bullets: []
      }, { status: 400 });
    }

    // Utiliser un modèle d'IA pour générer un résumé (OpenAI, Claude, ou autre)
    // Vérifier d'abord si une clé API est disponible
    const apiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY;
    const provider = process.env.AI_PROVIDER || 'openai'; // 'openai', 'gemini', 'anthropic'

    if (!apiKey) {
      // Si aucune clé API n'est disponible, retourner un message d'erreur explicite
      return NextResponse.json({ 
        summary: "Le service d'IA n'est pas configuré. Veuillez contacter l'administrateur pour activer la génération de résumé.",
        bullets: ["Ajoutez une clé API dans les variables d'environnement pour activer cette fonctionnalité."],
        videoId,
        title: title || 'Vidéo sans titre',
        warning: 'Aucune clé API d\'IA configurée'
      }, { status: 500 });
    }

    try {
      let aiResponse;
      
      // Selon le fournisseur d'IA configuré
      if (provider === 'gemini') {
        // Appel à Gemini API
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `En tant qu'expert en résumé de contenu vidéo, analyse cette transcription de vidéo YouTube intitulée "${title || 'sans titre'}" et fournis un résumé concis en français ainsi que 3 à 6 points clés :

${text}

Fournis ta réponse au format JSON avec deux champs : "summary" pour le résumé complet et "bullets" pour un tableau de points clés.`
              }]
            }]
          })
        });
        
        const geminiData = await geminiResponse.json();
        if (geminiData.candidates && geminiData.candidates[0].content.parts[0].text) {
          aiResponse = JSON.parse(geminiData.candidates[0].content.parts[0].text);
        }
      } else if (provider === 'anthropic') {
        // Appel à Anthropic (Claude)
        const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-sonnet-20240229',
            max_tokens: 1000,
            messages: [{
              role: 'user',
              content: `En tant qu'expert en résumé de contenu vidéo, analyse cette transcription de vidéo YouTube intitulée "${title || 'sans titre'}" et fournis un résumé concis en français ainsi que 3 à 6 points clés :

${text}

Fournis ta réponse au format JSON avec deux champs : "summary" pour le résumé complet et "bullets" pour un tableau de points clés.`
            }]
          })
        });
        
        const anthropicData = await anthropicResponse.json();
        if (anthropicData.content && anthropicData.content[0].text) {
          aiResponse = JSON.parse(anthropicData.content[0].text);
        }
      } else {
        // Par défaut, utiliser OpenAI
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: `Vous êtes un expert en résumé de contenu vidéo. Votre tâche est de créer un résumé clair, concis et informatif à partir de la transcription d'une vidéo YouTube. Le résumé doit capturer les points principaux du contenu, en conservant les idées essentielles sans ajouter d'informations extérieures. Répondez en français.`
              },
              {
                role: 'user',
                content: `Analyse cette transcription de vidéo YouTube intitulée "${title || 'sans titre'}" et fournis un résumé concis en français ainsi que 3 à 6 points clés :

${text}

Fournis ta réponse au format JSON avec deux champs : "summary" pour le résumé complet et "bullets" pour un tableau de points clés.`
              }
            ],
            temperature: 0.3
          })
        });
        
        const openaiData = await openaiResponse.json();
        if (openaiData.choices && openaiData.choices[0].message.content) {
          aiResponse = JSON.parse(openaiData.choices[0].message.content);
        }
      }
      
      // Si la réponse contient les champs attendus
      if (aiResponse && typeof aiResponse === 'object') {
        return NextResponse.json({
          summary: aiResponse.summary || "Le résumé n'a pas été extrait correctement de la réponse de l'IA.",
          bullets: Array.isArray(aiResponse.bullets) ? aiResponse.bullets : [
            "Le système n'a pas pu extraire les points clés correctement."
          ],
          videoId,
          title: title || 'Vidéo sans titre'
        });
      } else {
        // Si la réponse n'est pas au format attendu
        return NextResponse.json({
          summary: "Le résumé n'a pas été généré correctement par l'IA.",
          bullets: ["Le format de réponse de l'IA n'était pas conforme."],
          videoId,
          title: title || 'Vidéo sans titre',
          warning: 'Réponse IA non conforme'
        });
      }
    } catch (aiError: any) {
      console.error('Erreur lors de l\'appel à l\'IA pour le résumé:', aiError);
      
      // En cas d'erreur, tenter une approche de secours basique
      const lines = text.split('.').filter(line => line.trim().length > 10);
      const summary = lines.length > 0 
        ? lines.slice(0, Math.min(5, lines.length)).join('. ') + (lines.length > 5 ? '...' : '.') 
        : "Impossible de générer un résumé en raison d'une erreur de traitement.";
      
      return NextResponse.json({ 
        summary: summary,
        bullets: [
          "La génération automatique de résumé a rencontré une erreur.",
          "Veuillez consulter la transcription complète pour le détail.",
          "Contactez l'administrateur si le problème persiste."
        ],
        videoId,
        title: title || 'Vidéo sans titre',
        warning: 'Erreur lors de la génération du résumé par l\'IA'
      });
    }
    
    return NextResponse.json({
      summary,
      bullets,
      videoId
    });
  } catch (error: any) {
    console.error('Erreur dans l\'API de résumé:', error);
    return NextResponse.json({ 
      error: error.message || 'Erreur interne du serveur' 
    }, { status: 500 });
  }
}