import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  Search,
  MapPin,
  Calendar,
  PlusCircle,
  RotateCcw,
  Star,
  Laptop,
  Building2,
  ArrowRight,
  SlidersHorizontal,
  Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { JobsRlsFixBanner } from '../components/JobsRlsFixBanner';
import {
  fetchProfessions,
  fetchDivisions,
  fetchDistricts,
  fetchUpazilas,
  toEnglishDigits,
} from '../lib/supabase';
import { fetchPublicJobs, fetchMyPostedJobs } from '../lib/marketplaceService';
import { isJobsRlsError } from '../lib/jobsSqlFix';
import type { Job, Profession, Division, District, Upazila } from '../types/database';

export const JobsListing: React.FC = () => {
  const { user, profile } = useAuth();
  const isAuthenticated = Boolean(user || profile);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [rlsError, setRlsError] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [myPendingCount, setMyPendingCount] = useState(0);

  // Lookups
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [upazilas, setUpazilas] = useState<Upazila[]>([]);

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [divisionId, setDivisionId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [upazilaId, setUpazilaId] = useState('');
  const [workMode, setWorkMode] = useState('all');
  const [budgetMinInput, setBudgetMinInput] = useState('');
  const [budgetMaxInput, setBudgetMaxInput] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'budget_high' | 'budget_low' | 'deadline'>('newest');

  useEffect(() => {
    Promise.all([fetchProfessions(), fetchDivisions()])
      .then(([profList, divList]) => {
        setProfessions(profList);
        setDivisions(divList);
      })
      .catch((err) => console.error('[JobsListing] lookups error:', err));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!divisionId) {
      setDistricts([]);
      setDistrictId('');
      setUpazilas([]);
      setUpazilaId('');
      return;
    }
    fetchDistricts(divisionId)
      .then((list) => setDistricts(list.filter((d) => !String(d.id).startsWith('dis-all-'))))
      .catch((err) => console.error('[JobsListing] fetchDistricts error:', err));
  }, [divisionId]);

  useEffect(() => {
    if (!districtId) {
      setUpazilas([]);
      setUpazilaId('');
      return;
    }
    fetchUpazilas(districtId)
      .then((list) => setUpazilas(list.filter((u) => !String(u.id).startsWith('upa-all-'))))
      .catch((err) => console.error('[JobsListing] fetchUpazilas error:', err));
  }, [districtId]);

  useEffect(() => {
    const actorIds = [profile?.id || '', user?.id || ''].filter(Boolean);
    if (actorIds.length === 0) {
      setMyPendingCount(0);
      return;
    }
    fetchMyPostedJobs(actorIds)
      .then((mine) => {
        setMyPendingCount(mine.filter((j) => j.status === 'pending_approval').length);
      })
      .catch(() => {});
  }, [profile?.id, user?.id, reloadNonce]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const selectedDiv = divisions.find((d) => String(d.id) === String(divisionId));
        const selectedDis = districts.find((d) => String(d.id) === String(districtId));
        const selectedUpa = upazilas.find((u) => String(u.id) === String(upazilaId));

        const minNum = budgetMinInput.trim() ? Number(toEnglishDigits(budgetMinInput.trim())) : null;
        const maxNum = budgetMaxInput.trim() ? Number(toEnglishDigits(budgetMaxInput.trim())) : null;

        const list = await fetchPublicJobs({
          search: debouncedSearch,
          category,
          division_id: divisionId || undefined,
          division_name: selectedDiv?.name_bn,
          district_id: districtId || undefined,
          district_name: selectedDis?.name_bn,
          upazila_id: upazilaId || undefined,
          upazila_name: selectedUpa?.name_bn,
          work_mode: workMode,
          budget_min: Number.isFinite(minNum) ? minNum : null,
          budget_max: Number.isFinite(maxNum) ? maxNum : null,
          sortBy,
          throwOnRlsError: true,
        });
        if (active) {
          setJobs(list);
          setRlsError(false);
        }
      } catch (err) {
        console.error('[JobsListing] load error:', err);
        if (active && isJobsRlsError(err)) {
          setRlsError(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [
    debouncedSearch,
    category,
    divisionId,
    districtId,
    upazilaId,
    workMode,
    budgetMinInput,
    budgetMaxInput,
    sortBy,
    divisions.length,
    districts.length,
    upazilas.length,
    reloadNonce,
  ]);

  const handleReset = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setCategory('all');
    setDivisionId('');
    setDistrictId('');
    setUpazilaId('');
    setWorkMode('all');
    setBudgetMinInput('');
    setBudgetMaxInput('');
    setSortBy('newest');
  };

  const formatBudget = (job: Job) => {
    if (job.budget_min && job.budget_max && job.budget_min !== job.budget_max) {
      return `৳${job.budget_min.toLocaleString('bn-BD')} - ৳${job.budget_max.toLocaleString('bn-BD')}`;
    }
    const single = job.budget_max ?? job.budget_min;
    if (single) {
      return `৳${single.toLocaleString('bn-BD')}`;
    }
    return 'আলোচনা সাপেক্ষে';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-[#0F2942] via-[#0B3B78] to-[#0B63E5] text-white rounded-3xl p-6 sm:p-9 shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 text-blue-200 text-xs font-bold uppercase tracking-wider">
            <Briefcase className="w-4 h-4" />
            <span>জমি৩৬০ জব মার্কেটপ্লেস</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black font-siliguri leading-tight">
            ভূমি সেবা, সার্ভে ও আইনি কাজের জবসমূহ
          </h1>
          <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed">
            আপনার জমির মাপজোক, দলিল যাচাই, নামজারি বা দেওয়ানি মামলার কাজের জন্য জব পোস্ট করুন অথবা ভেরিফাইড পেশাজীবী হিসেবে কাজে আবেদন করুন।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            to="/jobs/new"
            className="px-5 py-3 bg-white text-[#0F2942] hover:bg-blue-50 font-extrabold text-xs sm:text-sm rounded-xl inline-flex items-center gap-2 shadow-md transition"
          >
            <PlusCircle className="w-4 h-4 text-[var(--brand-primary)]" />
            <span>নতুন জব পোস্ট করুন</span>
          </Link>
          {isAuthenticated && (
            <>
              <Link
                to="/my-jobs"
                className="px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/25 text-white font-bold text-xs rounded-xl transition"
              >
                আমার পোস্ট করা জব
              </Link>
              <Link
                to="/my-applications"
                className="px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/25 text-white font-bold text-xs rounded-xl transition"
              >
                আমার আবেদনসমূহ
              </Link>
            </>
          )}
        </div>
      </div>

      {rlsError && <JobsRlsFixBanner onRetry={() => setReloadNonce((n) => n + 1)} />}

      {myPendingCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              আপনার পোস্ট করা {myPendingCount}টি জব বর্তমানে অ্যাডমিন অনুমোদনের অপেক্ষায় রয়েছে। অনুমোদিত হলে এখানে প্রদর্শিত হবে।
            </span>
          </div>
          <Link
            to="/my-jobs"
            className="px-4 py-2 bg-brand text-white text-xs font-bold rounded-xl shrink-0 text-center"
          >
            আমার জবসমূহ দেখুন →
          </Link>
        </div>
      )}

      {/* Category Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setCategory('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
            category === 'all'
              ? 'bg-brand text-white border-transparent shadow-sm'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          সকল ক্যাটাগরি
        </button>
        {professions.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setCategory(p.name_bn)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
              category === p.name_bn
                ? 'bg-brand text-white border-transparent shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            {p.name_bn}
          </button>
        ))}
      </div>

      {/* Filter Panel */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <SlidersHorizontal className="w-4 h-4 text-[var(--brand-primary)]" />
            <span>জব খুঁজুন ও ফিল্টার করুন</span>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>রিসেট</span>
          </button>
        </div>

        {/* Row 1: Search, Work Mode, Sort */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="জবের শিরোনাম বা বিবরণ লিখে খুঁজুন..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium"
            />
          </div>

          <select
            value={workMode}
            onChange={(e) => setWorkMode(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold"
          >
            <option value="all">কাজের ধরন: সব</option>
            <option value="onsite">সরাসরি সাইটে (Onsite)</option>
            <option value="remote">রিমোট / অনলাইন (Remote)</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold"
          >
            <option value="newest">সাজান: সর্বশেষ পোস্ট</option>
            <option value="budget_high">বাজেট: বেশি থেকে কম</option>
            <option value="budget_low">বাজেট: কম থেকে বেশি</option>
            <option value="deadline">ডেডলাইন অনুযায়ী</option>
          </select>
        </div>

        {/* Row 2: Division, District, Upazila, Budget Min/Max */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select
            value={divisionId}
            onChange={(e) => setDivisionId(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
          >
            <option value="">সকল বিভাগ</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name_bn}
              </option>
            ))}
          </select>

          <select
            value={districtId}
            onChange={(e) => setDistrictId(e.target.value)}
            disabled={!divisionId}
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold disabled:opacity-50"
          >
            <option value="">সকল জেলা</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name_bn}
              </option>
            ))}
          </select>

          <select
            value={upazilaId}
            onChange={(e) => setUpazilaId(e.target.value)}
            disabled={!districtId}
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold disabled:opacity-50"
          >
            <option value="">সকল উপজেলা</option>
            {upazilas.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name_bn}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={budgetMinInput}
            onChange={(e) => setBudgetMinInput(e.target.value)}
            placeholder="সর্বনিম্ন বাজেট (৳)"
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
          />

          <input
            type="text"
            value={budgetMaxInput}
            onChange={(e) => setBudgetMaxInput(e.target.value)}
            placeholder="সর্বোচ্চ বাজেট (৳)"
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
          />
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
          মোট চলমান জব পাওয়া গেছে: <span className="text-[var(--brand-primary)]">{jobs.length}টি</span>
        </p>
      </div>

      {/* Jobs List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 space-y-4 animate-pulse"
            >
              <div className="h-5 w-2/3 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-3.5 w-1/3 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-14 w-full bg-slate-100 dark:bg-slate-800/70 rounded-xl" />
              <div className="h-9 w-1/2 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            </div>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 border border-slate-200 dark:border-slate-800 text-center space-y-4">
          <Briefcase className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            এই ফিল্টারে কোনো চলমান জব পাওয়া যায়নি
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            ফিল্টার পরিবর্তন করে দেখুন অথবা আপনার প্রয়োজনীয় কাজের জন্য নতুন একটি জব পোস্ট করুন।
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
            >
              ফিল্টার রিসেট করুন
            </button>
            <Link
              to="/jobs/new"
              className="px-5 py-2.5 bg-brand text-white text-xs font-bold rounded-xl"
            >
              + নতুন জব পোস্ট করুন
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {jobs.map((job) => {
            const locText = [job.upazila_name, job.district_name, job.division_name]
              .filter(Boolean)
              .join(', ');

            return (
              <Link
                key={job.id}
                to={`/jobs/${job.id}`}
                className="group bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 hover:border-[var(--brand-primary)] transition shadow-sm hover:shadow-md flex flex-col justify-between gap-5"
              >
                <div className="space-y-3">
                  {/* Top Metadata Line */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-[var(--brand-primary)] uppercase tracking-wide">
                      {job.category || 'ভূমি সেবা'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 font-medium">
                      {job.work_mode === 'remote' ? (
                        <>
                          <Laptop className="w-3.5 h-3.5 text-emerald-600" />
                          <span>রিমোট / অনলাইন</span>
                        </>
                      ) : (
                        <>
                          <Building2 className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                          <span>সরাসরি সাইটে</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white group-hover:text-[var(--brand-primary)] transition line-clamp-2 font-siliguri">
                    {job.title}
                  </h2>

                  {/* Description Excerpt */}
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                    {job.description}
                  </p>

                  {/* Location & Deadline */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs text-slate-500 dark:text-slate-400">
                    {locText && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>{locText}</span>
                      </span>
                    )}
                    {job.deadline && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>ডেডলাইন: {new Date(job.deadline).toLocaleDateString('bn-BD')}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Footer: Budget + Poster + Action */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                      {formatBudget(job)}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {job.budget_type === 'negotiable' ? 'আলোচনা সাপেক্ষে' : 'নির্ধারিত বাজেট (Fixed)'}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {job.poster && (
                      <div className="text-right hidden sm:block">
                        <div className="flex items-center justify-end gap-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                          <span className="truncate max-w-[120px]">{job.poster.full_name}</span>
                          {job.poster.is_verified && <VerifiedBadge size="sm" />}
                        </div>
                        {job.poster.review_count > 0 && (
                          <div className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-bold">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span>{Number(job.poster.avg_rating).toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <span className="px-3.5 py-2 bg-brand text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 shrink-0">
                      <span>বিস্তারিত</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};
