import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { callId, userId, action } = await req.json(); // action: 'accept', 'decline', 'miss'
    
    if (!callId || !userId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Mettre à jour l'état de l'invitation
    const { error } = await supabaseServer
      .from('group_call_invites')
      .update({ 
        state: action,
        responded_at: new Date().toISOString()
      })
      .eq('call_id', callId)
      .eq('device_id', userId);

    if (error) {
      console.error('Error updating call invite:', error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating call invite:', error);
    return NextResponse.json({ error: 'Failed to update call invite' }, { status: 500 });
  }
}