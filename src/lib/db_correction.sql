-- Script de correction pour la structure des tables d'appel de groupe

-- Assurer que l'extension pgcrypto est disponible
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Correction de la table des invitations si nécessaire
DO $$ 
BEGIN
  -- Vérifier si la colonne device_id existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'group_call_invites' 
                 AND column_name = 'device_id') THEN
    
    -- Si user_id existe, la renommer en device_id
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'group_call_invites' 
               AND column_name = 'user_id') THEN
      ALTER TABLE group_call_invites RENAME COLUMN user_id TO device_id;
    ELSE
      -- Sinon, ajouter la colonne device_id
      ALTER TABLE group_call_invites ADD COLUMN device_id TEXT;
    END IF;
  END IF;
  
  -- S'assurer que la contrainte de clé étrangère est correcte
  BEGIN
    ALTER TABLE group_call_invites DROP CONSTRAINT IF EXISTS group_call_invites_call_id_fkey;
    ALTER TABLE group_call_invites ADD CONSTRAINT group_call_invites_call_id_fkey 
      FOREIGN KEY (call_id) REFERENCES group_calls(id) ON DELETE CASCADE;
  EXCEPTION
    WHEN OTHERS THEN
      -- Si la contrainte existe déjà, ignorer
      NULL;
  END;
END $$;

-- Correction de la table de présence si nécessaire
DO $$
BEGIN
  -- S'assurer que la colonne device_id existe dans user_presence
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_presence' 
                 AND column_name = 'device_id') THEN
    
    -- Si user_id existe, la renommer en device_id
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'user_presence' 
               AND column_name = 'user_id') THEN
      ALTER TABLE user_presence RENAME COLUMN user_id TO device_id;
      ALTER TABLE user_presence DROP CONSTRAINT IF EXISTS user_presence_pkey;
      ALTER TABLE user_presence ADD PRIMARY KEY (device_id);
    ELSE
      -- Sinon, s'assurer que device_id est la clé primaire
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'user_presence' 
                     AND column_name = 'device_id') THEN
        ALTER TABLE user_presence ADD COLUMN device_id TEXT;
        ALTER TABLE user_presence ADD PRIMARY KEY (device_id);
      END IF;
    END IF;
  END IF;
END $$;

-- S'assurer que les index sont correctement nommés
DO $$
BEGIN
  -- Supprimer les anciens index s'ils existent avec de mauvais noms
  DROP INDEX IF EXISTS idx_group_call_invites_user_id;
  
  -- Créer les index avec les bons noms
  CREATE INDEX IF NOT EXISTS idx_group_call_invites_device_id ON group_call_invites(device_id);
  CREATE INDEX IF NOT EXISTS idx_group_calls_group_id ON group_calls(group_id);
  CREATE INDEX IF NOT EXISTS idx_group_calls_status ON group_calls(status);
  CREATE INDEX IF NOT EXISTS idx_group_call_invites_call_id ON group_call_invites(call_id);
  CREATE INDEX IF NOT EXISTS idx_user_presence_online ON user_presence(is_online);
END $$;

-- Mettre à jour les politiques RLS si nécessaire
DO $$
DECLARE
  policy_exists BOOLEAN;
BEGIN
  -- Vérifier si les politiques existent déjà
  SELECT COUNT(*) > 0 INTO policy_exists
  FROM pg_policies
  WHERE tablename = 'group_calls' AND policyname = 'Users can manage their own group calls';

  IF NOT policy_exists THEN
    -- Créer les politiques de sécurité de ligne
    CREATE POLICY "Users can manage their own group calls" ON public.group_calls
      FOR ALL USING (auth.uid()::text = created_by);

    CREATE POLICY "Users can manage their own call invites" ON public.group_call_invites
      FOR ALL USING (auth.uid()::text = device_id);

    CREATE POLICY "Users can manage their own presence" ON public.user_presence
      FOR ALL USING (auth.uid()::text = device_id);
  END IF;
END $$;

-- Activer la sécurité de ligne pour les tables concernées
ALTER TABLE group_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_call_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;