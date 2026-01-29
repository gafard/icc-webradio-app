#!/bin/bash
# Script de démarrage du service AssemblyAI

echo "Configuration du service AssemblyAI..."

# Installer les dépendances nécessaires
pip install assemblyai psycopg python-dotenv

echo "Lancement du service AssemblyAI..."
python /Users/gafardgnane/Downloads/icc-webradio-app/icc-ai/assembly/deploy_assembly_ai.py