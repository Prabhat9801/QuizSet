import type { Notification } from '@/types';
import { apiGet, apiPost } from './http';

/**
 * NAMING/SHAPE NOTE: the backend infers scope from the caller's verified JWT
 * (`req.auth`), so none of these routes take a `role` param the way
 * mock.ts's `notificationService` did — mock.ts kept per-role notifications
 * in separate localStorage buckets with no real auth, so it had to be told
 * which bucket to read/write. The real server already knows who's asking.
 * `Notifications.tsx`'s call sites were updated to match (dropped the now-
 * unnecessary `role` argument) rather than keeping a compatibility shim that
 * silently ignores it — this is a real cutover, not a mock-compatible shape.
 *
 * `time` (mock.ts's human-relative string, e.g. "2 hours ago") has no
 * backend column — the server returns `createdAt` (an ISO timestamp)
 * instead. Mapped to `time` here as the raw ISO string so `Notification`'s
 * existing shape still typechecks without inventing a relative-time
 * formatter as part of this change; callers that want "2 hours ago"
 * formatting can add that at render time later.
 */
type NotificationApiRow = {
  id: string;
  role: Notification['role'];
  tenantId: string | null;
  subjectProfileId: string | null;
  kind: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

function mapNotification(row: NotificationApiRow): Notification {
  return {
    id: row.id,
    role: row.role,
    tenantId: row.tenantId ?? undefined,
    title: row.title,
    body: row.body,
    time: row.createdAt,
    read: row.read,
  };
}

export const notificationService = {
  async list(): Promise<Notification[]> {
    const rows = await apiGet<NotificationApiRow[]>('/api/notifications');
    return rows.map(mapNotification);
  },

  async markRead(id: string): Promise<void> {
    await apiPost<NotificationApiRow>(`/api/notifications/${id}/read`);
  },

  async markAllRead(): Promise<void> {
    await apiPost<NotificationApiRow[]>('/api/notifications/read-all');
  },
};
