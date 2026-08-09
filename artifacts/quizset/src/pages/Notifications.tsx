import { useCallback, useEffect, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button, Card, EmptyState, PageHeader } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { notificationService } from '@/services/mock';
import { Notification } from '@/types';

/**
 * Previously `list()` returned a hardcoded default every time without ever
 * persisting it, so `markRead` was writing into an array that didn't exist
 * yet and "Mark all read" silently did nothing on reload. The service now
 * seeds and persists on first read — see notificationService in mock.ts.
 */
export function NotificationsPage() {
  const { user } = useApp();
  const [items, setItems] = useState<Notification[] | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setItems(await notificationService.list(user.role));
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const markAllRead = async () => {
    if (!user) return;
    await notificationService.markAllRead(user.role);
    await load();
  };

  const markRead = async (id: string) => {
    if (!user) return;
    await notificationService.markRead(user.role, id);
    await load();
  };

  if (!items) return null;

  return (
    <>
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="A calm record of what needs your attention."
        action={
          <Button variant="ghost" onClick={markAllRead}>
            Mark all read
          </Button>
        }
      />
      {items.length === 0 ? (
        <Card>
          <EmptyState title="You're all caught up" description="Nothing needs your attention right now." />
        </Card>
      ) : (
        <Card>
          <div className="notification-list">
            {items.map((n) => (
              <div className={`notification-row ${n.read ? 'read' : ''}`} key={n.id}>
                <span className="notification-dot" />
                <div>
                  <b>{n.title}</b>
                  <p>{n.body}</p>
                  <small>{n.time}</small>
                </div>
                {!n.read && (
                  <button className="icon-btn" onClick={() => markRead(n.id)} title="Mark as read">
                    <MoreHorizontal size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
