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
        status: 'ended', 
        ended_at: new Date().toISOString() 
      })
      .eq('id', callId)
      .eq('status', 'active'); // Ne mettre à jour que si l'appel est encore actif

    if (error) {
      console.error('Error updating call status:', error);
      return NextResponse.json({ error: 'Failed to end call' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error ending group call:', error);
    return NextResponse.json({ error: 'Failed to end group call' }, { status: 500 });
  }
}