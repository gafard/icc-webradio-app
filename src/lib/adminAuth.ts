import { timingSafeEqual } from 'node:crypto';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { supabaseServer } from '@/lib/supabaseServer';

type AnyClient = SupabaseClient<any, 'public', any>;

type AdminAuthMode = 'session' | 'admin_key';

export class AdminAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminAuthError';
    this.status = status;
  }
}

export type AdminAuthResult = {
  client: AnyClient;
  actor: string;
  mode: AdminAuthMode;
  role: string | null;
  user: User | null;
};

export type SessionAdminContext = {
  isAuthenticated: boolean;
  isAdmin: boolean;
  role: string | null;
  user: User | null;
};

function secureEqual(left: string, right: string) {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function getAdminKey(request: Request) {
  return (request.headers.get('x-admin-key') || '').trim();
}

function getAdminActorFromHeader(request: Request) {
  return (request.headers.get('x-admin-actor') || '').trim();
}

function canUseAdminKey(request: Request) {
  const expected = (process.env.ADMIN_PANEL_KEY || '').trim();
  if (!expected) return false;
  const provided = getAdminKey(request);
  if (!provided) return false;
  return secureEqual(provided, expected);
}

function formatSessionActor(user: User) {
  return user.email || user.phone || user.id;
}

export async function getSessionAdminContext(): Promise<SessionAdminContext> {
  const sessionClient = await createSupabaseServerClient();
  if (!sessionClient) {
    return {
      isAuthenticated: false,
      isAdmin: false,
      role: null,
      user: null,
    };
  }

  const { data: authData, error: authError } = await sessionClient.auth.getUser();
  const user = authData?.user ?? null;
  if (authError || !user) {
    return {
      isAuthenticated: false,
      isAdmin: false,
      role: null,
      user: null,
    };
  }

  const { data: roleRow, error: roleError } = await sessionClient
    .from('admin_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (roleError || !roleRow?.role) {
    return {
      isAuthenticated: true,
      isAdmin: false,
      role: null,
      user,
    };
  }

  return {
    isAuthenticated: true,
    isAdmin: true,
    role: String(roleRow.role),
    user,
  };
}

export async function requireAdmin(request: Request): Promise<AdminAuthResult> {
  const sessionClient = await createSupabaseServerClient();
  if (sessionClient) {
    const { data: authData, error: authError } = await sessionClient.auth.getUser();
    const user = authData?.user ?? null;

    if (authError) {
      throw new AdminAuthError('UNAUTHENTICATED', 401);
    }

    if (user) {
      const { data: roleRow, error: roleError } = await sessionClient
        .from('admin_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleError) {
        throw new AdminAuthError('ROLE_LOOKUP_FAILED', 500);
      }

      if (roleRow?.role) {
        return {
          client: sessionClient,
          actor: formatSessionActor(user),
          mode: 'session',
          role: String(roleRow.role),
          user,
        };
      }
    }
  }

  if (canUseAdminKey(request)) {
    if (!supabaseServer) {
      throw new AdminAuthError('SUPABASE_SERVER_NOT_CONFIGURED', 503);
    }
    return {
      client: supabaseServer,
      actor: getAdminActorFromHeader(request) || 'admin_key',
      mode: 'admin_key',
      role: 'admin',
      user: null,
    };
  }

  throw new AdminAuthError('FORBIDDEN', 403);
}
