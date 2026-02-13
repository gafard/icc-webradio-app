import AppShell from '@/components/AppShell';
import AdminShell from '@/components/admin/AdminShell';
import { getSessionAdminContext } from '@/lib/adminAuth';
import { redirect } from 'next/navigation';

export default async function AdminPage() {
  const sessionAdmin = await getSessionAdminContext();
  if (!sessionAdmin.isAdmin) {
    redirect('/admin/login?next=%2Fadmin');
  }

  return (
    <AppShell>
      <AdminShell initialSessionRole={sessionAdmin.role} />
    </AppShell>
  );
}
