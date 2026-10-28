import React, { useState, useEffect } from 'react';
import { RotateCcw, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import { ProfileCard } from './ProfileCard';
import type { PublicProfile } from '../types/database';

interface ListingSectionProps {
  profiles: PublicProfile[];
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  onDeleted?: (id: string) => void;
  title?: string;
  subtitle?: string;
  onResetFilters?: () => void;
}

export const ListingSection: React.FC<ListingSectionProps> = ({
  profiles,
  loading,
  error,
  onRetry,
  onDeleted,
  title = 'পেশাজীবী তালিকা',
  subtitle = 'নিবন্ধিত ও অনুমোদিত পেশাজীবীদের তালিকা',
  onResetFilters,
}) => {
  const [visibleCount, setVisibleCount] = useState<number>(12);

  useEffect(() => {
    setVisibleCount(12);
  }, [profiles]);

  const displayedProfiles = profiles.slice(0, visibleCount);
  const hasMore = visibleCount < profiles.length;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8F0] dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#0F2942] dark:text-white font-siliguri">
            {title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {subtitle}
          </p>
        </div>

        <div className="bg-[#EFF6FF] dark:bg-blue-950/60 border border-[#BFDBFE] dark:border-blue-800/80 px-4 py-2 rounded-xl text-xs font-bold text-[#0B63E5] dark:text-blue-300 self-start sm:self-auto tabular-nums">
          প্রদর্শিত হচ্ছে {displayedProfiles.length} / মোট {profiles.length} জন
        </div>
      </div>

      {/* Friendly Bangla Error State */}
      {error && (
        <div className="p-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-red-800 dark:text-red-200 text-sm font-semibold">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>আবার চেষ্টা করুন</span>
            </button>
          )}
        </div>
      )}

      {/* Loading Skeletons (12 per page layout) */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
            <div
              key={n}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 overflow-hidden shadow-xs animate-pulse"
            >
              <div className="h-24 bg-slate-200 dark:bg-slate-800" />
              <div className="p-5 space-y-3">
                <div className="w-16 h-16 -mt-12 rounded-full bg-slate-300 dark:bg-slate-700 border-4 border-white dark:border-slate-900" />
                <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl w-full mt-4" />
              </div>
            </div>
          ))}
        </div>
      ) : profiles.length === 0 ? (
        /* Empty State in Bangla */
        <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 space-y-4 shadow-xs">
          <p className="text-[#0F2942] dark:text-slate-100 font-bold text-lg font-siliguri">
            কোনো পেশাজীবী পাওয়া যায়নি
          </p>
          <p className="text-slate-500 dark:text-slate-400 text-xs">
            আপনার নির্বাচিত এলাকা, পেশা বা অনুসন্ধানের সাথে মিলে যাওয়া কোনো প্রোফাইল পাওয়া যায়নি।
          </p>
          {onResetFilters && (
            <button
              onClick={onResetFilters}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0B63E5] hover:bg-[#084FC7] text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>ফিল্টার রিসেট করুন</span>
            </button>
          )}
        </div>
      ) : (
        /* 4-Column Grid + 12-per-page Load More */
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {displayedProfiles.map((profile) => (
              <ProfileCard key={profile.id} profile={profile} onDeleted={onDeleted} />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => setVisibleCount((prev) => prev + 12)}
                className="px-8 py-3.5 bg-[#0B63E5] hover:bg-[#084FC7] text-white text-sm font-bold rounded-xl shadow-md shadow-blue-600/15 flex items-center gap-2 transition-all cursor-pointer"
              >
                <span>আরও দেখুন ({profiles.length - displayedProfiles.length} জন বাকি)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
