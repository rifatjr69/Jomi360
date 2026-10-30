import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../lib/marketplaceService';
import type { AppNotification } from '../types/database';

export const NotificationsPage: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const targetUserId = profile?.id || user?.id || '';

  const load = async () => {
    if (!targetUserId) return;
    setLoading(true);
    try {
      const list = await fetchMyNotifications(targetUserId, 100);
      setItems(list);
    } catch (err) {
      console.error('[NotificationsPage] error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [targetUserId]);

  const handleMarkAll = async () => {
    if (!targetUserId) return;
    await markAllNotificationsRead(targetUserId);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleOpen = async (n: AppNotification) => {
    if (!n.is_read) {
      await markNotificationRead(n.id);
      setItems((prev) => prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item)));
    }
    if (n.link) {
      navigate(n.link);
    }
  };

  const displayed = unreadOnly ? items.filter((n) => !n.is_read) : items;
  const unreadCount = items.filter((n) => !n.is_read).length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-siliguri flex items-center gap-2">
            <Bell className="w-6 h-6 text-[var(--brand-primary)]" />
            <span>নোটিফিকেশন কেন্দ্র</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            ভেরিফিকেশন, জব অনুমোদন, নতুন আবেদন, হায়ার ও মেসেজের সকল আপডেট।
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setUnreadOnly((p) => !p)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border cursor-pointer transition ${
              unreadOnly
                ? 'bg-brand text-white border-transparent'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
            }`}
          >
            অপঠিত ({unreadCount})
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAll}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-[var(--brand-primary)] rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              <span>সব পঠিত চিহ্নিত করুন</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="w-8 h-8 border-4 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Bell className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
              কোনো নোটিফিকেশন নেই
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {displayed.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleOpen(n)}
                className={`w-full text-left p-5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition flex items-start gap-3.5 cursor-pointer ${
                  !n.is_read ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                }`}
              >
                <span
                  className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${
                    !n.is_read ? 'bg-[var(--brand-primary)]' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{n.title}</p>
                    <span className="text-[11px] text-slate-400 shrink-0">
                      {new Date(n.created_at).toLocaleDateString('bn-BD')}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {n.body}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
