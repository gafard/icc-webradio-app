import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!supabaseServer) {
    console.error('Supabase server client is not initialized');
    return NextResponse.json({ error: 'Supabase server client is not configured' }, { status: 503 });
  }

  try {
    const { callId, deviceId } = await req.json();

    if (!callId || !deviceId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Mettre à jour le statut de l'appel
    const { error } = await supabaseServer
      .from('group_calls')
      .update({ 
        status: 'active' 
      })
      .eq('id', callId)
      .eq('status', 'ringing'); // Ne mettre à jour que si l'appel est encore en mode ringing

    if (error) {
      console.error('Error updating call status:', error);
      return NextResponse.json({ error: 'Failed to activate call' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error activating group call:', error);
    return NextResponse.json({ error: 'Failed to activate group call' }, { status: 500 });
  }
}