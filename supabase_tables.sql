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
  user_id TEXT NOT NULL,
  state TEXT DEFAULT 'pending' CHECK (state IN ('pending', 'accepted', 'declined', 'missed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE
);

-- Table de présence des utilisateurs
CREATE TABLE IF NOT EXISTS user_presence (
  user_id TEXT PRIMARY KEY,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_online BOOLEAN DEFAULT FALSE
);

-- Index pour de meilleures performances
CREATE INDEX IF NOT EXISTS idx_group_calls_group_id ON group_calls(group_id);
CREATE INDEX IF NOT EXISTS idx_group_calls_status ON group_calls(status);
CREATE INDEX IF NOT EXISTS idx_group_call_invites_call_id ON group_call_invites(call_id);
CREATE INDEX IF NOT EXISTS idx_group_call_invites_user_id ON group_call_invites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_online ON user_presence(is_online);