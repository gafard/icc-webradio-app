import AppShell from '../../components/AppShell';
import { SeriesList } from '../../components/SeriesManagement';

export default function SeriesPage() {
  return (
    <AppShell>
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-[color:var(--foreground)] mb-2">Séries</h1>
          <p className="text-[color:var(--foreground)]/70">Toutes les séries détectées dans les archives.</p>
        </div>
        <SeriesList />
      </main>
    </AppShell>
  );
}
