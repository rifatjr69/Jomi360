import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Briefcase,
  ShieldAlert,
  Upload,
  X,
  MapPin,
  Save,
  ArrowLeft,
  Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { useToast } from '../components/Toast';
import { JobsRlsFixBanner } from '../components/JobsRlsFixBanner';
import {
  supabase,
  isSupabaseConfigured,
  fetchProfessions,
  fetchDivisions,
  fetchDistricts,
  fetchUpazilas,
  uploadProfileMedia,
  toEnglishDigits,
  translateSupabaseError,
} from '../lib/supabase';
import {
  createJob,
  fetchJobById,
  updateJobInDb,
} from '../lib/marketplaceService';
import { isJobsRlsError } from '../lib/jobsSqlFix';
import type {
  Profession,
  Division,
  District,
  Upazila,
  BudgetType,
  WorkMode,
} from '../types/database';

export const JobCreate: React.FC = () => {
  const { id: editJobId } = useParams<{ id: string }>();
  const isEditing = Boolean(editJobId);

  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();
  const { settings } = useSiteSettings();
  const { showToast } = useToast();

  const [loadingInit, setLoadingInit] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rlsError, setRlsError] = useState(false);
  const prefilledLocationRef = useRef(false);

  // Lookups
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [upazilas, setUpazilas] = useState<Upazila[]>([]);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [professionId, setProfessionId] = useState('');
  const [budgetType, setBudgetType] = useState<BudgetType>('fixed');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [deadline, setDeadline] = useState('');
  const [workMode, setWorkMode] = useState<WorkMode>('onsite');
  const [divisionId, setDivisionId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [upazilaId, setUpazilaId] = useState('');
  const [existingAttachments, setExistingAttachments] = useState<string[]>([]);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);

  const isVerified =
    Boolean(profile?.is_verified) || profile?.verification_status === 'verified';

  const checkJobsTableHealth = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    const { error } = await supabase.from('jobs').select('id').limit(1);
    if (error && isJobsRlsError(error)) {
      setRlsError(true);
    } else {
      setRlsError(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      setLoadingInit(true);
      try {
        checkJobsTableHealth();
        const [profList, divList] = await Promise.all([
          fetchProfessions(),
          fetchDivisions(),
        ]);
        if (!mounted) return;
        setProfessions(profList);
        setDivisions(divList);

        if (editJobId) {
          const job = await fetchJobById(editJobId);
          if (!job) {
            showToast('জবটি খুঁজে পাওয়া যায়নি।', 'error');
            navigate('/jobs');
            return;
          }
          const myIds = [profile?.id, user?.id].filter(Boolean);
          if (!myIds.includes(job.poster_id) && !isAdmin) {
            showToast('আপনার এই জবটি সম্পাদনা করার অনুমতি নেই।', 'error');
            navigate(`/jobs/${job.id}`);
            return;
          }

          setTitle(job.title);
          setDescription(job.description);
          setCategory(job.category);
          setProfessionId(job.profession_id || '');
          setBudgetType(job.budget_type);
          setBudgetMin(job.budget_min ? String(job.budget_min) : '');
          setBudgetMax(job.budget_max ? String(job.budget_max) : '');
          setDeadline(job.deadline ? job.deadline.slice(0, 10) : '');
          setWorkMode(job.work_mode);
          setDivisionId(job.division_id || '');
          setDistrictId(job.district_id || '');
          setUpazilaId(job.upazila_id || '');
          setExistingAttachments(job.attachments || []);
        } else if (profList.length > 0) {
          setCategory((prev) => prev || profList[0].name_bn);
          setProfessionId((prev) => prev || profList[0].id);
        }
      } catch (err) {
        console.error('[JobCreate] init error:', err);
      } finally {
        if (mounted) setLoadingInit(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [editJobId]);

  // Pre-fill default location from user profile once without resetting user edits
  useEffect(() => {
    if (isEditing || prefilledLocationRef.current || !profile) return;
    if (profile.division_id && !divisionId) {
      prefilledLocationRef.current = true;
      setDivisionId(profile.division_id);
      if (profile.district_id) setDistrictId(profile.district_id);
      if (profile.upazila_id) setUpazilaId(profile.upazila_id);
    }
  }, [isEditing, profile, divisionId]);

  useEffect(() => {
    if (!divisionId) {
      setDistricts([]);
      return;
    }
    fetchDistricts(divisionId)
      .then((list) => setDistricts(list.filter((d) => !String(d.id).startsWith('dis-all-'))))
      .catch((err) => console.error('[JobCreate] fetchDistricts error:', err));
  }, [divisionId]);

  useEffect(() => {
    if (!districtId) {
      setUpazilas([]);
      return;
    }
    fetchUpazilas(districtId)
      .then((list) => setUpazilas(list.filter((u) => !String(u.id).startsWith('upa-all-'))))
      .catch((err) => console.error('[JobCreate] fetchUpazilas error:', err));
  }, [districtId]);

  const handleAttachmentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const total = existingAttachments.length + attachmentFiles.length + files.length;
    if (total > 3) {
      showToast('সর্বোচ্চ ৩টি ফাইল বা ছবি সংযুক্ত করা যাবে।', 'error');
      return;
    }

    for (const f of files) {
      if (f.size > 5 * 1024 * 1024) {
        showToast('প্রতিটি ফাইলের সাইজ সর্বোচ্চ ৫ মেগাবাইট (5MB) হতে পারবে।', 'error');
        return;
      }
    }

    setAttachmentFiles((prev) => [...prev, ...files]);
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!title.trim() || title.trim().length < 3) {
      showToast('অনুগ্রহ করে স্পষ্ট জব শিরোনাম লিখুন।', 'error');
      return;
    }
    if (!description.trim() || description.trim().length < 5) {
      showToast('অনুগ্রহ করে কাজের সংক্ষিপ্ত বা বিস্তারিত বিবরণ লিখুন।', 'error');
      return;
    }
    if (!category.trim()) {
      showToast('একটি ক্যাটাগরি নির্বাচন করুন।', 'error');
      return;
    }
    if (workMode === 'onsite' && (!divisionId || !districtId)) {
      showToast('সরাসরি সাইটে কাজের জন্য বিভাগ ও জেলা নির্বাচন করা আবশ্যিক।', 'error');
      return;
    }

    const rawMin = budgetMin.trim() ? Number(toEnglishDigits(budgetMin.trim()).replace(/,/g, '')) : null;
    const rawMax = budgetMax.trim() ? Number(toEnglishDigits(budgetMax.trim()).replace(/,/g, '')) : null;
    const minVal = rawMin !== null && Number.isFinite(rawMin) && rawMin > 0 ? rawMin : null;
    const maxVal = rawMax !== null && Number.isFinite(rawMax) && rawMax > 0 ? rawMax : null;

    if (budgetType === 'fixed' && !minVal && !maxVal) {
      showToast('নির্ধারিত বাজেটের ক্ষেত্রে আনুমানিক বাজেট উল্লেখ করুন (অথবা আলোচনা সাপেক্ষে নির্বাচন করুন)।', 'error');
      return;
    }
    if (minVal && maxVal && minVal > maxVal) {
      showToast('সর্বনিম্ন বাজেট সর্বোচ্চ বাজেটের চেয়ে বেশি হতে পারে না।', 'error');
      return;
    }

    const selectedDiv = divisions.find((d) => String(d.id) === String(divisionId));
    const selectedDis = districts.find((d) => String(d.id) === String(districtId));
    const selectedUpa = upazilas.find((u) => String(u.id) === String(upazilaId));

    setSubmitting(true);
    try {
      if (isEditing && editJobId) {
        const uploadedUrls = [...existingAttachments];
        for (const f of attachmentFiles) {
          const url = await uploadProfileMedia(f, 'job-attachments', user.id);
          if (url) uploadedUrls.push(url);
        }

        const updated = await updateJobInDb(editJobId, {
          title: title.trim(),
          description: description.trim(),
          category: category.trim(),
          profession_id: professionId || null,
          budget_type: budgetType,
          budget_min: minVal,
          budget_max: maxVal ?? minVal,
          deadline: deadline || null,
          work_mode: workMode,
          division_id: divisionId || null,
          district_id: districtId || null,
          upazila_id: upazilaId || null,
          division_name: selectedDiv?.name_bn || '',
          district_name: selectedDis?.name_bn || '',
          upazila_name: selectedUpa?.name_bn || '',
          attachments: uploadedUrls,
        });
        showToast('জব পোস্ট সফলভাবে আপডেট করা হয়েছে!', 'success');
        navigate(`/jobs/${updated.id}`);
      } else {
        const created = await createJob(
          user,
          profile,
          {
            title: title.trim(),
            description: description.trim(),
            category: category.trim(),
            profession_id: professionId || null,
            budget_type: budgetType,
            budget_min: minVal,
            budget_max: maxVal ?? minVal,
            deadline: deadline || null,
            work_mode: workMode,
            division_id: divisionId || null,
            district_id: districtId || null,
            upazila_id: upazilaId || null,
            division_name: selectedDiv?.name_bn || '',
            district_name: selectedDis?.name_bn || '',
            upazila_name: selectedUpa?.name_bn || '',
            attachment_files: attachmentFiles,
            existing_attachments: existingAttachments,
          },
          settings
        );

        if (created.status === 'pending_approval') {
          showToast(
            'জব পোস্ট জমা হয়েছে! অ্যাডমিন অনুমোদনের পর এটি পাবলিক মার্কেটপ্লেসে প্রকাশিত হবে।',
            'success'
          );
          navigate('/my-jobs');
        } else {
          showToast('আপনার জব সফলভাবে প্রকাশিত হয়েছে!', 'success');
          navigate(`/jobs/${created.id}`);
        }
      }
    } catch (err: any) {
      console.error('[JobCreate] handleSubmit error:', err);
      if (isJobsRlsError(err)) {
        setRlsError(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      showToast(translateSupabaseError(err, 'জব সংরক্ষণ করতে সমস্যা হয়েছে।'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInit) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Rule check: Require verified profile to post jobs
  if (!isEditing && settings.require_verified_to_post_job && !isVerified && !isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-amber-200 dark:border-amber-800 shadow-lg text-center space-y-4">
          <ShieldAlert className="w-14 h-14 text-amber-500 mx-auto" />
          <h2 className="text-2xl font-black text-slate-900 dark:text-white font-siliguri">
            জব পোস্ট করতে ভেরিফাইড প্রোফাইল প্রয়োজন
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            নিরাপদ লেনদেন ও বিশ্বস্ততা নিশ্চিত করতে সাইটের নিয়ম অনুযায়ী নতুন জব পোস্ট করার পূর্বে আপনার প্রোফাইল ভেরিফাইড হওয়া আবশ্যিক।
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/verify"
              className="px-6 py-3 bg-brand text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition"
            >
              প্রোফাইল ভেরিফাই করুন →
            </Link>
            <Link
              to="/jobs"
              className="px-5 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl"
            >
              জব তালিকায় ফিরে যান
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/jobs"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-[var(--brand-primary)]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>জব মার্কেটপ্লেসে ফিরে যান</span>
        </Link>
      </div>

      {rlsError && <JobsRlsFixBanner onRetry={checkJobsTableHealth} />}

      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6"
      >
        <div className="border-b border-slate-100 dark:border-slate-800 pb-4 space-y-1">
          <div className="flex items-center gap-2 text-[var(--brand-primary)] text-xs font-bold">
            <Briefcase className="w-4 h-4" />
            <span>জমি৩৬০ মার্কেটপ্লেস</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white font-siliguri">
            {isEditing ? 'জব পোস্ট সম্পাদনা করুন' : 'নতুন জব পোস্ট করুন'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            সঠিক বিবরণ, বাজেট ও লোকেশন উল্লেখ করলে দ্রুত দক্ষ পেশাজীবীর প্রস্তাব পাবেন।
          </p>
        </div>

        {!isEditing && settings.require_job_approval && !isAdmin && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-800 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
            <Info className="w-4 h-4 text-[var(--brand-primary)] shrink-0 mt-0.5" />
            <span>
              জব পোস্ট করার পর অ্যাডমিন যাচাই করে অনুমোদন দিলে এটি পাবলিক তালিকায় প্রদর্শিত হবে। স্ট্যাটাস দেখতে পাবেন <strong>“আমার জবসমূহ”</strong> পেজে।
            </span>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            জবের শিরোনাম *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={140}
            placeholder="যেমন: সাভারে ২০ শতাংশ জমির ডিজিটাল সার্ভে ও সীমানা নির্ধারণ প্রয়োজন"
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold"
          />
        </div>

        {/* Category & Work Mode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              ক্যাটাগরি / পেশা *
            </label>
            <select
              value={professionId}
              onChange={(e) => {
                const pId = e.target.value;
                setProfessionId(pId);
                const found = professions.find((p) => String(p.id) === String(pId));
                setCategory(found ? found.name_bn : 'অন্যান্য');
              }}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold"
            >
              {professions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name_bn}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              কাজের ধরন (Work Mode) *
            </label>
            <select
              value={workMode}
              onChange={(e) => setWorkMode(e.target.value as WorkMode)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold"
            >
              <option value="onsite">সরাসরি সাইটে উপস্থিত হয়ে (Onsite)</option>
              <option value="remote">রিমোট / অনলাইন পরামর্শ বা কাগজ যাচাই (Remote)</option>
            </select>
          </div>
        </div>

        {/* Budget & Deadline */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                বাজেটের ধরন *
              </label>
              <select
                value={budgetType}
                onChange={(e) => setBudgetType(e.target.value as BudgetType)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-bold"
              >
                <option value="fixed">নির্ধারিত বাজেট (Fixed)</option>
                <option value="negotiable">আলোচনা সাপেক্ষে (Negotiable)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                কাজের শেষ তারিখ / ডেডলাইন (ঐচ্ছিক)
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                সর্বনিম্ন বাজেট (৳ টাকা) {budgetType === 'fixed' ? '*' : '(ঐচ্ছিক)'}
              </label>
              <input
                type="text"
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
                placeholder="যেমন: 3000"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                সর্বোচ্চ বাজেট (৳ টাকা) (ঐচ্ছিক)
              </label>
              <input
                type="text"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
                placeholder="যেমন: 5000"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono"
              />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
            <MapPin className="w-4 h-4 text-[var(--brand-primary)]" />
            <span>
              জমির / কাজের লোকেশন {workMode === 'onsite' ? '(আবশ্যিক *)' : '(ঐচ্ছিক)'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={divisionId}
              onChange={(e) => {
                setDivisionId(e.target.value);
                setDistrictId('');
                setUpazilaId('');
              }}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
            >
              <option value="">বিভাগ নির্বাচন করুন</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name_bn}
                </option>
              ))}
            </select>

            <select
              value={districtId}
              onChange={(e) => {
                setDistrictId(e.target.value);
                setUpazilaId('');
              }}
              disabled={!divisionId}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold disabled:opacity-50"
            >
              <option value="">জেলা নির্বাচন করুন</option>
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
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold disabled:opacity-50"
            >
              <option value="">উপজেলা / থানা</option>
              {upazilas.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name_bn}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Detailed Description */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            কাজের বিস্তারিত বিবরণ *
          </label>
          <textarea
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder="কী ধরনের কাজ করাতে চান, জমির পরিমাণ, প্রয়োজনীয় কাগজপত্র বা বিশেষ কোনো নির্দেশনা থাকলে বিস্তারিত লিখুন (ফোন নম্বর লেখার প্রয়োজন নেই—আবেদনকারী গ্রহণ করলে উভয় পক্ষের নম্বর স্বয়ংক্রিয়ভাবে দেখাবে)..."
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium leading-relaxed"
          />
        </div>

        {/* Attachments */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              সংযুক্ত ছবি বা ফাইল (ঐচ্ছিক, সর্বোচ্চ ৩টি)
            </label>
            <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-[var(--brand-primary)] rounded-xl cursor-pointer transition">
              <Upload className="w-3.5 h-3.5" />
              <span>ফাইল যুক্ত করুন</span>
              <input
                type="file"
                accept="image/*,.pdf"
                multiple
                onChange={handleAttachmentSelect}
                className="hidden"
              />
            </label>
          </div>

          {(existingAttachments.length > 0 || attachmentFiles.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {existingAttachments.map((url, idx) => (
                <div
                  key={url}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium"
                >
                  <span>সংযুক্ত ফাইল #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setExistingAttachments((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="text-rose-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {attachmentFiles.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/50 text-[var(--brand-primary)] rounded-lg text-xs font-semibold"
                >
                  <span className="truncate max-w-[180px]">{file.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachmentFiles((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="text-rose-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 bg-brand text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-md transition cursor-pointer disabled:opacity-60"
        >
          {submitting ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>সংরক্ষণ হচ্ছে...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>{isEditing ? 'পরিবর্তন সংরক্ষণ করুন' : 'জব পোস্ট জমা দিন'}</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
