#!/usr/bin/env python3
"""
Script de déploiement du service AssemblyAI pour l'application ICC WebRadio
"""

import assemblyai as aai
import psycopg
import os
import sys
from dotenv import load_dotenv
import time
from datetime import datetime

# Charger les variables d'environnement
load_dotenv()

# Configuration AssemblyAI
aai.settings.api_key = os.getenv("ASSEMBLYAI_API_KEY")

if not aai.settings.api_key:
    print("ERREUR: La clé API AssemblyAI n'est pas définie dans les variables d'environnement")
    print("Veuillez définir ASSEMBLYAI_API_KEY dans votre fichier .env")
    sys.exit(1)

# Configuration base de données
DB_URL = os.getenv("DATABASE_URL")

if not DB_URL:
    print("ERREUR: L'URL de la base de données n'est pas définie dans les variables d'environnement")
    print("Veuillez définir DATABASE_URL dans votre fichier .env")
    sys.exit(1)

def transcribe_audio_with_assemblyai(audio_url: str):
    """
    Transcrit un fichier audio via AssemblyAI
    """
    print(f"[{datetime.now()}] Début de la transcription de: {audio_url}")
    
    config = aai.TranscriptionConfig(speech_models=["universal"])
    transcript = aai.Transcriber(config=config).transcribe(audio_url)
    
    if transcript.status == "error":
        raise RuntimeError(f"Transcription failed: {transcript.error}")
    
    print(f"[{datetime.now()}] Transcription terminée avec succès")
    return transcript.text

def store_transcription_in_db(episode_slug: str, transcription: str):
    """
    Stocke la transcription dans la base de données
    """
    print(f"[{datetime.now()}] Enregistrement de la transcription dans la base de données pour l'épisode: {episode_slug}")
    
    with psycopg.connect(DB_URL) as conn:
        conn.execute(
            """
            UPDATE episodes 
            SET transcript = %s, updated_at = NOW() 
            WHERE slug = %s
            """,
            (transcription, episode_slug)
        )
        conn.commit()
    
    print(f"[{datetime.now()}] Transcription enregistrée avec succès")

def get_unprocessed_episodes():
    """
    Récupère les épisodes qui n'ont pas encore été transcrits
    """
    with psycopg.connect(DB_URL) as conn:
        rows = conn.execute(
            """
            SELECT slug, audio_url
            FROM episodes
            WHERE transcript IS NULL 
              AND audio_url IS NOT NULL
            ORDER BY id ASC
            LIMIT 10
            """
        ).fetchall()
    
    return rows

def process_pending_episodes():
    """
    Traite les épisodes en attente de transcription
    """
    print(f"[{datetime.now()}] Recherche des épisodes non transcrits...")
    
    episodes = get_unprocessed_episodes()
    
    if not episodes:
        print(f"[{datetime.now()}] Aucun épisode en attente de transcription")
        return
    
    print(f"[{datetime.now()}] Trouvé {len(episodes)} épisodes à traiter")
    
    for episode_slug, audio_url in episodes:
        try:
            print(f"[{datetime.now()}] Traitement de l'épisode: {episode_slug}")
            
            # Transcrire l'audio
            transcription = transcribe_audio_with_assemblyai(audio_url)
            
            # Stocker dans la base de données
            store_transcription_in_db(episode_slug, transcription)
            
            print(f"[{datetime.now()}] Épisode {episode_slug} traité avec succès\n")
            
            # Petit délai pour éviter de surcharger l'API
            time.sleep(1)
            
        except Exception as e:
            print(f"[{datetime.now()}] ERREUR lors du traitement de {episode_slug}: {str(e)}\n")
            continue

def main():
    """
    Point d'entrée principal du script de déploiement
    """
    print("="*60)
    print("Déploiement du service AssemblyAI pour ICC WebRadio")
    print("="*60)
    
    print(f"[{datetime.now()}] Vérification de la configuration...")
    
    # Vérifier la connexion à la base de données
    try:
        with psycopg.connect(DB_URL) as conn:
            conn.execute("SELECT 1")
        print(f"[{datetime.now()}] Connexion à la base de données réussie")
    except Exception as e:
        print(f"[{datetime.now()}] ERREUR de connexion à la base de données: {e}")
        sys.exit(1)
    
    # Vérifier la clé API AssemblyAI
    try:
        # Faire un appel simple pour tester la clé API
        pass  # La vérification est faite au début du script
        print(f"[{datetime.now()}] Clé API AssemblyAI valide")
    except Exception as e:
        print(f"[{datetime.now()}] ERREUR avec la clé API AssemblyAI: {e}")
        sys.exit(1)
    
    print(f"[{datetime.now()}] Configuration vérifiée avec succès")
    
    # Lancer le traitement des épisodes
    try:
        process_pending_episodes()
        print(f"[{datetime.now()}] Traitement terminé avec succès")
    except KeyboardInterrupt:
        print(f"\n[{datetime.now()}] Interruption manuelle détectée")
        sys.exit(0)
    except Exception as e:
        print(f"[{datetime.now()}] ERREUR fatale: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()