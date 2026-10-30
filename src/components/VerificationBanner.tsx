import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldAlert, Clock, AlertTriangle, X, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const VerificationBanner: React.FC = () => {
  const { user, profile, isAdmin, loading } = useAuth();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);

  const status = profile?.verification_status || (profile?.is_verified ? 'verified' : 'unverified');
  const storageKey = user ? `jomi360_ver_banner_dismissed_${user.id}_${status}` : '';

  useEffect(() => {
    if (!storageKey) return;
    setDismissed(sessionStorage.getItem(storageKey) === '1');
  }, [storageKey]);

  if (
    loading ||
    !user ||
    isAdmin ||
    status === 'verified' ||
    dismissed ||
    location.pathname === '/verify' ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/dashboard')
  ) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    if (storageKey) {
      sessionStorage.setItem(storageKey, '1');
    }
  };

  if (status === 'pending') {
    return (
      <div className="bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              আপনার প্রোফাইল ভেরিফিকেশন আবেদনটি বর্তমানে অ্যাডমিনের পর্যালোচনাধীন রয়েছে। অনুমোদিত হলে পাবলিক ডিরেক্টরিতে যুক্ত হবে।
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/verify"
              className="font-bold text-amber-800 dark:text-amber-300 hover:underline whitespace-nowrap"
            >
              স্ট্যাটাস দেখুন
            </Link>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="ব্যানার বন্ধ করুন"
              className="p-1 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-md cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="bg-rose-50 dark:bg-rose-950/60 border-b border-rose-200 dark:border-rose-800/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-start gap-2.5 text-rose-900 dark:text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">ভেরিফিকেশন আবেদন গৃহীত হয়নি। </span>
              {profile?.verification_rejection_reason && (
                <span>কারণ: {profile.verification_rejection_reason}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <Link
              to="/verify"
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg inline-flex items-center gap-1 transition-colors"
            >
              <span>পুনরায় আবেদন করুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="ব্যানার বন্ধ করুন"
              className="p-1 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-md cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#EFF6FF] dark:bg-blue-950/50 border-b border-[#BFDBFE] dark:border-blue-800/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs sm:text-sm">
        <div className="flex items-center gap-2.5 text-[#0F2942] dark:text-blue-100">
          <ShieldAlert className="w-4 h-4 text-[var(--brand-primary)] dark:text-blue-400 shrink-0" />
          <span>
            আপনার প্রোফাইল এখনো ভেরিফাইড নয়। পাবলিক ডিরেক্টরিতে যুক্ত হতে এবং জব মার্কেটপ্লেসে সম্পূর্ণ সুবিধা পেতে ভেরিফিকেশন সম্পন্ন করুন।
          </span>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <Link
            to="/verify"
            className="px-3.5 py-1.5 bg-brand text-white font-bold text-xs rounded-lg inline-flex items-center gap-1 transition-colors"
          >
            <span>প্রোফাইল ভেরিফাই করুন</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="ব্যানার বন্ধ করুন"
            className="p-1 text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
