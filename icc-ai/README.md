# Système de Recherche Intelligente pour ICC WebRadio

Ce système permet d'ajouter une recherche sémantique à l'application ICC WebRadio en utilisant des embeddings de texte avec le modèle BAAI/bge-m3.

## Architecture

Le système est composé de plusieurs composants :

1. **Base de données PostgreSQL** avec l'extension pgvector pour le stockage et la recherche vectorielle
2. **Microservice d'embeddings** (FastAPI) qui convertit le texte en vecteurs
3. **Endpoints Next.js** pour la recherche et les recommandations
4. **Worker d'indexation** pour transformer les transcriptions en embeddings
5. **Intégration AssemblyAI** pour la transcription automatique
6. **Composants React** pour l'affichage des résultats

## Déploiement

### 1. Base de données

Lancer PostgreSQL avec pgvector :
```bash
cd icc-ai
docker compose up -d
```

Appliquer le schéma :
```bash
docker exec -i icc_pg psql -U icc -d iccapp < schema.sql
```

### 2. Microservice d'embeddings

Installer les dépendances :
```bash
cd icc-ai/embed
python3 -m venv .venv
source .venv/bin/activate
pip install -U fastapi uvicorn sentence-transformers torch --index-url https://download.pytorch.org/whl/cpu
```

Lancer le service :
```bash
uvicorn app:app --host 0.0.0.0 --port 8001
```

### 3. Configuration de l'application Next.js

Ajouter les variables d'environnement dans `.env.local` :
```
DATABASE_URL=postgres://icc:icc_password_change_me@<IP_VPS>:5432/iccapp
EMBED_URL=http://<IP_VPS>:8001/embed
ASSEMBLY_API_KEY=votre_clé_assemblyai
```

### 4. Worker d'indexation

Installer les dépendances :
```bash
cd icc-ai/worker
python3 -m venv .venv
source .venv/bin/activate
pip install -U requests psycopg[binary] python-dotenv
```

Configurer le fichier `.env` :
```
DATABASE_URL=postgres://icc:icc_password_change_me@<IP_VPS>:5432/iccapp
EMBED_URL=http://<IP_VPS>:8001/embed
```

Lancer le worker :
```bash
python embed_worker.py
```

### 5. Intégration AssemblyAI

Configurer le fichier `.env` dans le dossier assembly :
```
DATABASE_URL=postgres://icc:icc_password_change_me@<IP_VPS>:5432/iccapp
ASSEMBLY_API_KEY=votre_clé_assemblyai
```

Lancer la synchronisation :
```bash
python assembly_sync.py
```

## Utilisation

Le système s'intègre automatiquement dans l'application existante :

- La recherche sémantique est disponible via l'API `/api/search?q=requete`
- Les recommandations sont disponibles via l'API `/api/reco?slug=slug_du_contenu`
- Les composants React `SearchResults` et `Recommendations` peuvent être intégrés dans l'interface

## Fonctionnalités

- **Recherche intelligente** : recherche sémantique basée sur la signification du texte
- **Recommandations** : suggestions de contenus similaires
- **Support du français** : le modèle BAAI/bge-m3 est optimisé pour le français
- **Classement par séries** : possibilité de regrouper les contenus par séries thématiques
- **Évolutivité** : architecture modulaire facilement extensible

## Performance

Le système est optimisé pour fonctionner sur un VPS 4GB RAM / 2 CPU avec :
- Modèle BAAI/bge-m3 en mode CPU
- Indexation vectorielle avec pgvector
- Workers d'indexation en batch