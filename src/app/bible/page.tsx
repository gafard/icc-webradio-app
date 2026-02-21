import AppShell from '../../components/AppShell';
import BibleReader from '../../components/BibleReader';

export default function BiblePage() {
  return (
    <AppShell>
      <div className="container mx-auto py-6 animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out fill-mode-both">
        <BibleReader />
      </div>
    </AppShell>
  );
}
