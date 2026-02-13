import AppShell from '@/components/AppShell';
import AdminShell from '@/components/admin/AdminShell';
import { getSessionAdminContext } from '@/lib/adminAuth';

export default async function AdminPage() {
  const sessionAdmin = await getSessionAdminContext();

  return (
    <AppShell>
      <AdminShell initialSessionRole={sessionAdmin.role} />
    </AppShell>
  );
}
