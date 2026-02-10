-- Création des tables pour le système d'appel de groupe

-- Table des appels de groupe
CREATE TABLE IF NOT EXISTS group_calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL,
  room_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  status TEXT DEFAULT 'ringing' CHECK (status IN ('ringing', 'active', 'ended')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Table des invitations aux appels
CREATE TABLE IF NOT EXISTS group_call_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID REFERENCES group_calls(id) ON DELETE CASCADE,
  group_id UUID NOT NULL,
  device_id TEXT NOT NULL,  -- Changement ici pour correspondre à la structure existante
  state TEXT DEFAULT 'pending' CHECK (state IN ('pending', 'accepted', 'declined', 'missed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE
);

-- Table de présence des utilisateurs
CREATE TABLE IF NOT EXISTS user_presence (
  device_id TEXT PRIMARY KEY,  -- Changement ici pour correspondre à la structure existante
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_online BOOLEAN DEFAULT FALSE
);

-- Index pour de meilleures performances
CREATE INDEX IF NOT EXISTS idx_group_calls_group_id ON group_calls(group_id);
CREATE INDEX IF NOT EXISTS idx_group_calls_status ON group_calls(status);
CREATE INDEX IF NOT EXISTS idx_group_call_invites_call_id ON group_call_invites(call_id);
CREATE INDEX IF NOT EXISTS idx_group_call_invites_device_id ON group_call_invites(device_id);  -- Changement ici
CREATE INDEX IF NOT EXISTS idx_user_presence_online ON user_presence(is_online);