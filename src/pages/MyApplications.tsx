import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowRight, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { JobsRlsFixBanner } from '../components/JobsRlsFixBanner';
import { isJobsRlsError } from '../lib/jobsSqlFix';
import { translateSupabaseError } from '../lib/supabase';
import { fetchMyApplications, withdrawJobApplication } from '../lib/marketplaceService';
import type { JobApplication } from '../types/database';

const APP_STATUS: Record<string, { label: string; cls: string }> = {
  pending: {
    label: 'বিবেচনাধীন (Pending)',
    cls: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  },
  accepted: {
    label: 'গৃহীত ও নির্বাচিত (Hired)',
    cls: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  },
  rejected: {
    label: 'গৃহীত হয়নি (Rejected)',
    cls: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  },
  withdrawn: {
    label: 'প্রত্যাহারকৃত (Withdrawn)',
    cls: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
};

export const MyApplications: React.FC = () => {
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [rlsError, setRlsError] = useState(false);
  const [filter, setFilter] = useState('all');

  const applicantIds = Array.from(new Set([profile?.id, user?.id].filter(Boolean))) as string[];
  const applicantKey = applicantIds.join(',');

  const load = async () => {
    if (applicantIds.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setRlsError(false);
    try {
      const list = await fetchMyApplications(applicantIds, { throwOnRlsError: true });
      setApplications(list);
    } catch (err) {
      console.error('[MyApplications] error:', err);
      if (isJobsRlsError(err)) {
        setRlsError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [applicantKey]);

  const handleWithdraw = async (id: string) => {
    try {
      await withdrawJobApplication(id);
      showToast('আবেদন প্রত্যাহার করা হয়েছে।', 'info');
      await load();
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'আবেদন প্রত্যাহার করা যায়নি।'), 'error');
    }
  };

  const filtered =
    filter === 'all' ? applications : applications.filter((a) => a.status === filter);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {rlsError && <JobsRlsFixBanner onRetry={load} />}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-siliguri">
            আমার আবেদনসমূহ (Proposals)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            আপনি যে সকল জবে আবেদন করেছেন তার বর্তমান অবস্থা ও মেসেজ দেখুন।
          </p>
        </div>

        <Link
          to="/jobs"
          className="px-5 py-3 bg-brand text-white text-xs sm:text-sm font-bold rounded-xl inline-flex items-center gap-2 shrink-0"
        >
          <Search className="w-4 h-4" />
          <span>নতুন জব খুঁজুন</span>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { key: 'all', label: `সব (${applications.length})` },
          { key: 'pending', label: 'বিবেচনাধীন' },
          { key: 'accepted', label: 'নির্বাচিত (Hired)' },
          { key: 'rejected', label: 'গৃহীত হয়নি' },
          { key: 'withdrawn', label: 'প্রত্যাহারকৃত' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer border transition ${
              filter === tab.key
                ? 'bg-brand text-white border-transparent'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-9 h-9 border-4 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            কোনো আবেদন পাওয়া যায়নি
          </h3>
          <p className="text-xs sm:text-sm text-slate-500">
            জব মার্কেটপ্লেস থেকে আপনার দক্ষতা অনুযায়ী কাজে প্রস্তাব পাঠান।
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((app) => {
            const st = APP_STATUS[app.status] || APP_STATUS.pending;
            return (
              <div
                key={app.id}
                className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-lg border text-xs font-bold ${st.cls}`}>
                      {st.label}
                    </span>
                    <span className="text-xs font-bold text-[var(--brand-primary)]">
                      প্রস্তাবিত মূল্য: ৳{app.proposed_price.toLocaleString('bn-BD')}
                    </span>
                    <span className="text-xs text-slate-500">
                      সময়: {app.estimated_days} দিন
                    </span>
                  </div>

                  <Link
                    to={`/jobs/${app.job_id}`}
                    className="block text-lg font-extrabold text-slate-900 dark:text-white hover:text-[var(--brand-primary)] font-siliguri"
                  >
                    {app.job?.title || 'জব বিস্তারিত দেখুন'}
                  </Link>

                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                    {app.cover_letter}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  {app.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => handleWithdraw(app.id)}
                      className="px-3.5 py-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      প্রত্যাহার করুন
                    </button>
                  )}
                  <Link
                    to={`/jobs/${app.job_id}`}
                    className="px-4 py-2.5 bg-brand text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5"
                  >
                    <span>জব ও মেসেজ দেখুন</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
