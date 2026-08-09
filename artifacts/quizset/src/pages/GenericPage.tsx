import { Settings2 } from 'lucide-react';
import { PageHeader, Card } from '@/components/ui';

/**
 * Deliberately minimal placeholder — used only for routes that are genuinely
 * out of scope for now (Settings, Profile). Everything that's actually part
 * of the product's core workflow has a real page; this is not a stand-in for
 * unfinished core features.
 */
export function GenericPage({ title, description, icon: Icon = Settings2 }: { title: string; description?: string; icon?: any }) {
  return (
    <>
      <PageHeader eyebrow="Coming soon" title={title} description={description || 'This section is planned but not built yet.'} />
      <Card>
        <div className="card-title">
          <div>
            <h2>Not built in this pass</h2>
            <p>This page was intentionally left out of scope to keep the core workflow focused.</p>
          </div>
          <Icon size={19} color="hsl(var(--primary))" />
        </div>
      </Card>
    </>
  );
}
