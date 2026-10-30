import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  PlusCircle,
  Users,
  Edit3,
  ArrowRight,
  MapPin,
  AlertCircle,
  Trash2,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { JobsRlsFixBanner } from '../components/JobsRlsFixBanner';
import { isJobsRlsError } from '../lib/jobsSqlFix';
import { translateSupabaseError } from '../lib/supabase';
import {
  fetchMyPostedJobs,
  updateOwnJobStatus,
  deleteOwnJob,
} from '../lib/marketplaceService';
import type { Job } from '../types/database';

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  pending_approval: {
    label: 'অনুমোদনের অপেক্ষায়',
    cls: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  },
  open: {
    label: 'চলমান (Open)',
    cls: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  },
  in_progress: {
    label: 'কাজ চলছে',
    cls: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  },
  delivered: {
    label: 'কাজ জমা হয়েছে',
    cls: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
  },
  completed: {
    label: 'সম্পন্ন',
    cls: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-200 dark:border-emerald-700',
  },
  rejected: {
    label: 'প্রত্যাখ্যাত',
    cls: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  },
  closed: {
    label: 'বন্ধ',
    cls: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
};

export const MyJobs: React.FC = () => {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [rlsError, setRlsError] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const posterIds = Array.from(new Set([profile?.id, user?.id].filter(Boolean))) as string[];
  const posterKey = posterIds.join(',');

  const loadMyJobs = async () => {
    if (posterIds.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setRlsError(false);
    try {
      const list = await fetchMyPostedJobs(posterIds, { throwOnRlsError: true });
      setJobs(list);
    } catch (err) {
      console.error('[MyJobs] error:', err);
      if (isJobsRlsError(err)) {
        setRlsError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMyJobs();
  }, [posterKey]);

  const handleToggleStatus = async (job: Job) => {
    const nextStatus = job.status === 'open' ? 'closed' : 'open';
    setBusyJobId(job.id);
    try {
      await updateOwnJobStatus(job.id, nextStatus);
      showToast(
        nextStatus === 'closed' ? 'জবটি বন্ধ করা হয়েছে।' : 'জবটি পুনরায় চালু করা হয়েছে!',
        'success'
      );
      await loadMyJobs();
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'স্ট্যাটাস পরিবর্তন করা যায়নি।'), 'error');
    } finally {
      setBusyJobId(null);
    }
  };

  const handleDelete = async (jobId: string) => {
    setBusyJobId(jobId);
    try {
      await deleteOwnJob(jobId);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      setConfirmDeleteId(null);
      showToast('জবটি মুছে ফেলা হয়েছে।', 'success');
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'জব মুছে ফেলতে সমস্যা হয়েছে।'), 'error');
    } finally {
      setBusyJobId(null);
    }
  };

  const filtered = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {rlsError && <JobsRlsFixBanner onRetry={loadMyJobs} />}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-siliguri">
            আমার পোস্ট করা জবসমূহ
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            আপনার পোস্ট করা জবের স্ট্যাটাস, আবেদনকারীর তালিকা এবং চলমান কাজের অগ্রগতি পরিচালনা করুন।
          </p>
        </div>

        <Link
          to="/jobs/new"
          className="px-5 py-3 bg-brand text-white text-xs sm:text-sm font-bold rounded-xl inline-flex items-center gap-2 shadow-sm shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>নতুন জব পোস্ট করুন</span>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { key: 'all', label: `সব (${jobs.length})` },
          { key: 'pending_approval', label: 'অনুমোদনের অপেক্ষায়' },
          { key: 'open', label: 'চলমান (Open)' },
          { key: 'in_progress', label: 'কাজ চলছে' },
          { key: 'delivered', label: 'ডেলিভারড' },
          { key: 'completed', label: 'সম্পন্ন' },
          { key: 'rejected', label: 'প্রত্যাখ্যাত' },
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
          <Briefcase className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            কোনো জব পাওয়া যায়নি
          </h3>
          <p className="text-xs sm:text-sm text-slate-500">
            আপনার প্রয়োজনীয় কাজের জন্য এখনই নতুন একটি জব পোস্ট করতে পারেন।
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((job) => {
            const st = STATUS_BADGES[job.status] || STATUS_BADGES.open;
            const loc = [job.upazila_name, job.district_name, job.division_name]
              .filter(Boolean)
              .join(', ');

            return (
              <div
                key={job.id}
                className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-lg border text-xs font-bold ${st.cls}`}>
                      {st.label}
                    </span>
                    <span className="text-xs font-bold text-[var(--brand-primary)]">
                      {job.category}
                    </span>
                    {loc && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-rose-500" />
                        <span>{loc}</span>
                      </span>
                    )}
                  </div>

                  <Link
                    to={`/jobs/${job.id}`}
                    className="block text-lg font-extrabold text-slate-900 dark:text-white hover:text-[var(--brand-primary)] font-siliguri"
                  >
                    {job.title}
                  </Link>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1 font-bold">
                      <Users className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                      <span>মোট আবেদন: {job.applications_count || 0}টি</span>
                    </span>
                    {job.assignee && (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300">
                        <span>নির্বাচিত পেশাজীবী: {job.assignee.full_name}</span>
                        {job.assignee.is_verified && <VerifiedBadge size="sm" />}
                      </span>
                    )}
                  </div>

                  {job.status === 'rejected' && job.admin_note && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>অ্যাডমিন নোট: {job.admin_note}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {job.status === 'open' && (
                    <button
                      type="button"
                      disabled={busyJobId === job.id}
                      onClick={() => handleToggleStatus(job)}
                      className="px-3 py-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold rounded-xl inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>বন্ধ করুন</span>
                    </button>
                  )}

                  {(job.status === 'closed' || job.status === 'cancelled') && (
                    <button
                      type="button"
                      disabled={busyJobId === job.id}
                      onClick={() => handleToggleStatus(job)}
                      className="px-3 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold rounded-xl inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>পুনরায় চালু</span>
                    </button>
                  )}

                  <Link
                    to={`/jobs/${job.id}/edit`}
                    className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl inline-flex items-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>এডিট</span>
                  </Link>

                  {job.status !== 'in_progress' && job.status !== 'delivered' && (
                    confirmDeleteId === job.id ? (
                      <div className="inline-flex items-center gap-1 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 px-2.5 py-1.5 rounded-xl">
                        <button
                          type="button"
                          disabled={busyJobId === job.id}
                          onClick={() => handleDelete(job.id)}
                          className="px-2 py-1 bg-rose-600 text-white text-[11px] font-bold rounded-lg cursor-pointer"
                        >
                          মুছুন
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-lg cursor-pointer"
                        >
                          বাতিল
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={busyJobId === job.id}
                        onClick={() => setConfirmDeleteId(job.id)}
                        className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl cursor-pointer hover:bg-rose-100"
                        title="জব মুছে ফেলুন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )
                  )}

                  <Link
                    to={`/jobs/${job.id}`}
                    className="px-4 py-2.5 bg-brand text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5"
                  >
                    <span>আবেদন ও বিস্তারিত</span>
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
