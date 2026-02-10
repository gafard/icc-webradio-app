import AppShell from '../../components/AppShell';
import BibleReader from '../../components/BibleReader';

export default function BiblePage() {
  return (
    <AppShell>
      <div className="container mx-auto py-6">
        <BibleReader />
      </div>
    </AppShell>
  );
}
