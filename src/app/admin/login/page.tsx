import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';
import AdminLoginForm from '@/components/admin/AdminLoginForm';
import { getSessionAdminContext } from '@/lib/adminAuth';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function normalizeNextPath(value: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/admin';
  return value;
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sessionAdmin = await getSessionAdminContext();
  const params = await searchParams;
  const nextPath = normalizeNextPath(getSingleParam(params.next));

  if (sessionAdmin.isAdmin) {
    redirect(nextPath);
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-xl px-4 py-6">
        <AdminLoginForm nextPath={nextPath} hasSession={sessionAdmin.isAuthenticated} />
      </div>
    </AppShell>
  );
}
