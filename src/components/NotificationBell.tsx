import React, { useState, useEffect, useRef, useCallback, useId } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../lib/marketplaceService';
import { supabase, isSupabaseConfigured, toBanglaDigits } from '../lib/supabase';
import type { AppNotification } from '../types/database';

export const NotificationBell: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const rawInstanceId = useId();
  const instanceKey = rawInstanceId.replace(/[^a-zA-Z0-9]/g, '');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const userId = profile?.id || user?.id || '';

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setItems([]);
      return;
    }
    const list = await fetchMyNotifications(userId, 20);
    setItems(list);
  }, [userId]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications, location.pathname]);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured || !supabase) return;
    let activeChannel: ReturnType<typeof supabase.channel> | null = null;

    try {
      const channelName = `user-notifs-${userId}-${instanceKey}-${Math.random().toString(36).slice(2, 7)}`;
      activeChannel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            loadNotifications();
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('[NotificationBell] realtime subscription skipped:', err);
    }

    const poll = setInterval(loadNotifications, 25000);
    return () => {
      clearInterval(poll);
      if (activeChannel && supabase) {
        supabase.removeChannel(activeChannel).catch(() => {});
      }
    };
  }, [userId, instanceKey, loadNotifications]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  if (!userId) return null;

  const unreadCount = items.filter((n) => !n.is_read).length;

  const handleClickItem = async (notif: AppNotification) => {
    setOpen(false);
    if (!notif.is_read) {
      await markNotificationRead(notif.id);
      setItems((prev) => prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)));
    }
    if (notif.link) {
      navigate(notif.link);
    }
  };

  const handleMarkAll = async () => {
    await markAllNotificationsRead(userId);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-[#EFF6FF] hover:text-[var(--brand-primary)] dark:hover:bg-slate-800 transition-colors cursor-pointer"
        title="নোটিফিকেশন"
        aria-label="নোটিফিকেশন"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
            {unreadCount > 9 ? '৯+' : toBanglaDigits(unreadCount)}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-[#E2E8F0] dark:border-slate-800 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h4 className="text-sm font-bold text-[#0F2942] dark:text-white">নোটিফিকেশন</h4>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-xs font-semibold text-[var(--brand-primary)] dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>সব পঠিত</span>
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-500">
                কোনো নতুন নোটিফিকেশন নেই
              </div>
            ) : (
              items.slice(0, 8).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClickItem(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition cursor-pointer block ${
                    !n.is_read ? 'bg-[#EFF6FF]/60 dark:bg-blue-950/30' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-[#0F2942] dark:text-slate-100 line-clamp-1">
                      {n.title}
                    </p>
                    {!n.is_read && (
                      <span className="text-[10px] font-bold text-[var(--brand-primary)] shrink-0">
                        নতুন
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                    {n.body}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {new Date(n.created_at).toLocaleDateString('bn-BD', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-center">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-bold text-[var(--brand-primary)] dark:text-blue-400 hover:underline"
            >
              সকল নোটিফিকেশন দেখুন
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
