const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Lire .env.local manuellement
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        // Rejoint le reste au cas où la valeur contient des =
        const value = parts.slice(1).join('=').trim();
        if (key && value) {
            env[key] = value;
        }
    }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Service Role Key in .env.local');
    console.log('Keys found:', Object.keys(env));
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteAllGroups() {
    console.log('Suppression de tous les groupes...');

    // 1. Récupérer tous les groupes
    const { data: groups, error: fetchError } = await supabase
        .from('community_groups')
        .select('id, name');

    if (fetchError) {
        console.error('Erreur lors de la récupération des groupes:', fetchError);
        return;
    }

    if (!groups || groups.length === 0) {
        console.log('Aucun groupe found.');
        return;
    }

    console.log(`${groups.length} groupes trouvés.`);

    // 2. Supprimer les membres d'abord
    const groupIds = groups.map(g => g.id);

    const { error: membersError } = await supabase
        .from('community_group_members')
        .delete()
        .in('group_id', groupIds);

    if (membersError) console.error('Erreur suppression membres:', membersError);

    // 3. Supprimer les groupes
    const { error: deleteError } = await supabase
        .from('community_groups')
        .delete()
        .in('id', groupIds);

    if (deleteError) {
        console.error('Erreur lors de la suppression des groupes:', deleteError);
    } else {
        console.log(`✅ ${groups.length} groupes supprimés avec succès.`);
        groups.forEach(g => console.log(`- ${g.name} (${g.id})`));
    }
}

deleteAllGroups();
