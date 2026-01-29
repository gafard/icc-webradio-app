import AppShell from '../../components/AppShell';
import SettingsComponent from '../../components/SettingsComponent';

export default function SettingsPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <SettingsComponent />
      </main>
    </AppShell>
  );
}