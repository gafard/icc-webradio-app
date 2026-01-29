import os
import time
import requests
import psycopg
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.environ["DATABASE_URL"]
ASSEMBLY_API_KEY = os.environ["ASSEMBLY_API_KEY"]

def transcribe_audio(audio_url: str):
    """Transcrit un fichier audio via AssemblyAI"""
    headers = {
        'authorization': f'Bearer {ASSEMBLY_API_KEY}',
        'content-type': 'application/json'
    }
    
    response = requests.post(
        'https://api.assemblyai.com/v2/transcript',
        json={'audio_url': audio_url},
        headers=headers
    )
    
    if response.status_code != 200:
        raise Exception(f"Erreur AssemblyAI: {response.status_code} - {response.text}")
    
    transcript_id = response.json()['id']
    
    # Poll pour le statut de transcription
    while True:
        status_response = requests.get(
            f'https://api.assemblyai.com/v2/transcript/{transcript_id}',
            headers=headers
        )
        
        status_data = status_response.json()
        status = status_data['status']
        
        if status == 'completed':
            return status_data.get('text', '')
        elif status == 'error':
            raise Exception(f"Erreur de transcription: {status_data.get('error', 'Unknown error')}")
        
        time.sleep(5)  # Attendre 5 secondes avant de revérifier

def sync_wp_episodes():
    """Synchronise les épisodes WordPress avec la base de données"""
    import asyncio
    from concurrent.futures import ThreadPoolExecutor
    
    with psycopg.connect(DB_URL) as conn:
        # Récupérer les épisodes WordPress qui n'ont pas encore été traités
        wp_episodes = conn.execute("""
            SELECT wp_id, slug, title, audio_url
            FROM episodes
            WHERE transcript IS NULL AND audio_url IS NOT NULL
        """).fetchall()
        
        with ThreadPoolExecutor(max_workers=2) as executor:
            for wp_id, slug, title, audio_url in wp_episodes:
                try:
                    print(f"Traitement de l'épisode {slug}...")
                    
                    # Transcrire l'audio
                    transcript = transcribe_audio(audio_url)
                    
                    # Sauvegarder la transcription dans la base
                    conn.execute("""
                        UPDATE episodes
                        SET transcript = %s, updated_at = now()
                        WHERE wp_id = %s
                    """, (transcript, wp_id))
                    conn.commit()
                    
                    print(f"✅ Transcription terminée pour {slug}")
                    
                except Exception as e:
                    print(f"❌ Erreur lors du traitement de {slug}: {str(e)}")
                    # On continue avec le prochain épisode malgré l'erreur

if __name__ == "__main__":
    sync_wp_episodes()