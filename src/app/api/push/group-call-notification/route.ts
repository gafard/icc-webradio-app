import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { hasWebPushConfig, sendWebPush } from '@/lib/webPush';

export const runtime = 'nodejs';

type GroupCallNotificationBody = {
  groupId: string;
  callerDeviceId: string;
  callerDisplayName: string;
  callType: 'audio' | 'video';
};

export async function POST(req: Request) {
  console.log('Requête reçue pour notification d\'appel de groupe');

  if (!supabaseServer) {
    console.error('SUPABASE_SERVICE_ROLE_KEY manquant');
    return NextResponse.json(
      { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY missing' },
      { status: 503 }
    );
  }

  if (!hasWebPushConfig()) {
    console.error('VAPID config manquante');
    return NextResponse.json(
      { ok: false, error: 'VAPID config missing' },
      { status: 503 }
    );
  }

  let body: GroupCallNotificationBody;
  try {
    body = (await req.json()) as GroupCallNotificationBody;
    console.log('Données reçues:', body);
  } catch {
    console.error('Données JSON invalides');
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { groupId, callerDeviceId, callerDisplayName, callType } = body;

  if (!groupId || !callerDeviceId || !callerDisplayName) {
    console.error('Champs requis manquants:', { groupId, callerDeviceId, callerDisplayName });
    return NextResponse.json(
      { ok: false, error: 'Missing required fields' },
      { status: 400 }
    );
  }

  try {
    // Récupérer les membres du groupe sauf l'appelant
    console.log('Récupération des membres du groupe...');
    let { data: groupMembers, error: membersError } = await supabaseServer
      .from('community_group_members')
      .select('device_id, status')
      .eq('group_id', groupId);

    if (membersError && String(membersError.message).includes('status')) {
      console.log('Colonne status manquante, repli sur une sélection sans status');
      const fallback = await supabaseServer
        .from('community_group_members')
        .select('device_id')
        .eq('group_id', groupId);
      groupMembers = (fallback.data ?? []) as any[];
      membersError = fallback.error;
    }

    if (membersError) {
      console.error('Erreur lors de la récupération des membres du groupe:', membersError);
      throw new Error(membersError.message);
    }

    // Si la colonne status est présente, on ne garde que les 'approved'
    const approvedMembers = groupMembers ? groupMembers.filter((m: any) => !m.status || m.status === 'approved') : [];
    console.log('Membres du groupe trouvés (approuvés):', approvedMembers);

    if (approvedMembers.length === 0) {
      console.log('Aucun membre à notifier');
      return NextResponse.json({ ok: true, message: 'No members to notify' });
    }

    // Filtrer l'appelant (qui peut être device_id ou guest_id)
    const targetDeviceIds = approvedMembers
      .map((member: any) => member.device_id)
      .filter((id: string | null | undefined) => id && id !== callerDeviceId);

    console.log('IDs cibles pour notification:', targetDeviceIds);

    if (targetDeviceIds.length === 0) {
      console.log('Aucun autre membre à notifier');
      return NextResponse.json({ ok: true, message: 'No other members to notify' });
    }

    // Récupérer les abonnements push pour ces devices
    console.log('Récupération des abonnements push...');
    const { data: subscriptions, error: subsError } = await supabaseServer
      .from('push_subscriptions')
      .select('subscription_json, device_id')
      .in('device_id', targetDeviceIds);

    if (subsError) {
      console.error('Erreur lors de la récupération des abonnements push:', subsError);
      throw new Error(subsError.message);
    }

    console.log('Abonnements push trouvés:', subscriptions);

    if (!subscriptions || subscriptions.length === 0) {
      console.log('Aucun abonnement push à notifier');
      return NextResponse.json({ ok: true, message: 'No push subscriptions to notify' });
    }

    // Envoyer les notifications push
    console.log('Envoi des notifications push...');
    const notificationPromises = subscriptions.map(sub => {
      if (!sub.subscription_json) {
        console.log('Abonnement vide ignoré pour device:', sub.device_id);
        return Promise.resolve();
      }

      console.log('Envoi de la notification à:', sub.device_id);
      return sendWebPush(sub.subscription_json, {
        title: `Appel de groupe ${callType === 'video' ? 'vidéo' : 'audio'}`,
        body: `${callerDisplayName} vous invite à rejoindre un appel de groupe`,
        url: `/community?group=${encodeURIComponent(groupId)}`,
        tag: `group-call-${groupId}`,
      });
    });

    await Promise.all(notificationPromises);
    console.log('Toutes les notifications ont été envoyées');

    return NextResponse.json({
      ok: true,
      message: `Notifications sent to ${subscriptions.length} members`,
      notifiedCount: subscriptions.length
    });
  } catch (error: any) {
    console.error('Erreur lors de l\'envoi des notifications d\'appel de groupe:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to send notifications' },
      { status: 500 }
    );
  }
}
