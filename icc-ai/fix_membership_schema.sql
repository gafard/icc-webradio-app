-- Ajout de la gestion des statuts de membres et des administrateurs
BEGIN;

-- 1) Table community_groups : ajout de admin_ids
ALTER TABLE public.community_groups ADD COLUMN IF NOT EXISTS admin_ids text[] DEFAULT '{}'::text[];

-- 2) Table community_group_members : ajout de status
ALTER TABLE public.community_group_members ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- 3) Mise à jour rétroactive : mettre tout le monde en 'approved' par défaut pour les groupes existants
-- Sauf si vous souhaitez garder le système de validation strict dès maintenant.
-- Ici, on approuve les membres existants pour ne pas bloquer les groupes actuels.
UPDATE public.community_group_members SET status = 'approved' WHERE status IS NULL;

-- 4) Les créateurs de groupes doivent être administrateurs par défaut
UPDATE public.community_groups 
SET admin_ids = CASE 
    WHEN admin_ids IS NULL OR admin_ids = '{}' THEN ARRAY[created_by_device_id]
    ELSE admin_ids 
END;

COMMIT;
