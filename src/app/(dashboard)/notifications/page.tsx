'use client';

import { useUser } from '@/hooks/useUser';
import { useNotifications } from '@/hooks/useNotifications';
import { formatRelativeTime } from '@/lib/utils';

export default function NotificationsPage() {
  const { user } = useUser();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications(user?.id);

  return (
    <div className="px-4 md:px-8 py-6 max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            style={{
              fontFamily: 'Geist, sans-serif',
              fontSize: '32px',
              fontWeight: '700',
              color: '#dde4e1',
              letterSpacing: '-0.02em',
            }}
          >
            Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="text-body-sm mt-1" style={{ color: '#4fdbc8' }}>
              {unreadCount} unread
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-label-sm px-4 py-2 rounded-xl transition-all"
            style={{ background: 'rgba(79,219,200,0.1)', color: '#4fdbc8' }}
          >
            Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card rounded-2xl p-4 animate-pulse">
              <div className="h-4 rounded" style={{ background: 'rgba(255,255,255,0.06)', width: '60%' }} />
              <div className="h-3 rounded mt-2" style={{ background: 'rgba(255,255,255,0.04)', width: '40%' }} />
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#3c4947' }}>notifications_none</span>
          <p className="text-body-md mt-3" style={{ color: '#859490' }}>No notifications yet</p>
          <p className="text-body-sm mt-1" style={{ color: '#3c4947' }}>
            Policy renewals, document expirations, and family events will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="glass-card rounded-2xl p-4 cursor-pointer transition-all"
              style={{
                borderLeft: n.read_at ? 'none' : '2px solid #4fdbc8',
                opacity: n.read_at ? 0.7 : 1,
              }}
              onClick={() => !n.read_at && markAsRead(n.id)}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(79,219,200,0.1)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#4fdbc8' }}>notifications</span>
                </div>
                <div className="flex-1">
                  <p className="text-body-sm font-semibold" style={{ color: '#dde4e1' }}>{n.title}</p>
                  <p className="text-body-sm mt-0.5" style={{ color: '#859490' }}>{n.body}</p>
                  <p className="text-label-sm mt-1" style={{ color: '#3c4947' }}>
                    {formatRelativeTime(n.created_at)}
                  </p>
                </div>
                {!n.read_at && (
                  <div className="w-2 h-2 rounded-full flex-shrink-0 mt-2" style={{ backgroundColor: '#4fdbc8' }} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
