import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Clock,
  XCircle,
  Upload,
  CheckCircle2,
  MapPin,
  Lock,
  Eye,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { VerifiedBadge } from '../components/VerifiedBadge';
import {
  fetchProfessions,
  fetchDivisions,
  fetchDistricts,
  fetchUpazilas,
  getVerificationDocSignedUrl,
  toEnglishDigits,
  translateSupabaseError,
} from '../lib/supabase';
import {
  fetchMyVerificationRequest,
  submitVerificationRequest,
} from '../lib/marketplaceService';
import type {
  Profession,
  Division,
  District,
  Upazila,
  VerificationRequest,
} from '../types/database';

export const VerifyProfile: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [loadingInit, setLoadingInit] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingRequest, setExistingRequest] = useState<VerificationRequest | null>(null);

  // Lookups
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [upazilas, setUpazilas] = useState<Upazila[]>([]);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [professionId, setProfessionId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [upazilaId, setUpazilaId] = useState('');
  const [shortBio, setShortBio] = useState('');
  const [nidNumber, setNidNumber] = useState('');

  // Private files & previews
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (!user) return;
      setLoadingInit(true);
      try {
        const [profList, divList, myReq] = await Promise.all([
          fetchProfessions(),
          fetchDivisions(),
          fetchMyVerificationRequest(user.id),
        ]);
        if (!mounted) return;
        setProfessions(profList);
        setDivisions(divList);
        setExistingRequest(myReq);

        const initName = myReq?.full_name || profile?.full_name || user.user_metadata?.full_name || '';
        const initPhone = myReq?.phone || profile?.phone || '';
        const initProf = myReq?.profession_id || profile?.profession_id || profList[0]?.id || '';
        const initDiv = myReq?.division_id || profile?.division_id || '';
        const initDis = myReq?.district_id || profile?.district_id || '';
        const initUpa = myReq?.upazila_id || profile?.upazila_id || '';
        const initBio = myReq?.short_bio || profile?.bio || '';
        const initNid = myReq?.nid_number || '';

        setFullName(initName);
        setPhone(initPhone);
        setProfessionId(initProf);
        setDivisionId(initDiv);
        setDistrictId(initDis);
        setUpazilaId(initUpa);
        setShortBio(initBio);
        setNidNumber(initNid);

        if (myReq?.id_front_path) {
          const url = await getVerificationDocSignedUrl(myReq.id_front_path);
          if (mounted && url) setFrontPreview(url);
        }
        if (myReq?.id_back_path) {
          const url = await getVerificationDocSignedUrl(myReq.id_back_path);
          if (mounted && url) setBackPreview(url);
        }
        if (myReq?.selfie_path) {
          const url = await getVerificationDocSignedUrl(myReq.selfie_path);
          if (mounted && url) setSelfiePreview(url);
        }
      } catch (err) {
        console.error('[VerifyProfile] init error:', err);
      } finally {
        if (mounted) setLoadingInit(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [user?.id, profile?.id]);

  // Load Districts when Division changes
  useEffect(() => {
    if (!divisionId) {
      setDistricts([]);
      return;
    }
    fetchDistricts(divisionId)
      .then((list) => {
        const filtered = list.filter((d) => !String(d.id).startsWith('dis-all-'));
        setDistricts(filtered);
      })
      .catch((err) => console.error('[VerifyProfile] fetchDistricts error:', err));
  }, [divisionId]);

  // Load Upazilas when District changes
  useEffect(() => {
    if (!districtId) {
      setUpazilas([]);
      return;
    }
    fetchUpazilas(districtId)
      .then((list) => {
        const filtered = list.filter((u) => !String(u.id).startsWith('upa-all-'));
        setUpazilas(filtered);
      })
      .catch((err) => console.error('[VerifyProfile] fetchUpazilas error:', err));
  }, [districtId]);

  const handleFilePick = (
    e: React.ChangeEvent<HTMLInputElement>,
    slot: 'front' | 'back' | 'selfie'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('অনুগ্রহ করে একটি বৈধ ছবি ফাইল নির্বাচন করুন।', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('ছবির সাইজ সর্বোচ্চ ৫ মেগাবাইট (5MB) হতে পারবে।', 'error');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    if (slot === 'front') {
      setFrontFile(file);
      setFrontPreview(previewUrl);
    } else if (slot === 'back') {
      setBackFile(file);
      setBackPreview(previewUrl);
    } else {
      setSelfieFile(file);
      setSelfiePreview(previewUrl);
    }
  };

  const currentStatus =
    existingRequest?.status === 'pending'
      ? 'pending'
      : profile?.verification_status ||
        (profile?.is_verified ? 'verified' : existingRequest?.status || 'unverified');

  const rejectionReason =
    existingRequest?.rejection_reason || profile?.verification_rejection_reason || null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const cleanPhone = toEnglishDigits(phone.trim());
    const cleanNid = toEnglishDigits(nidNumber.trim());

    if (!fullName.trim()) {
      showToast('আপনার পূর্ণ নাম লিখুন।', 'error');
      return;
    }
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      showToast('সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন (যেমন: 01712345678)।', 'error');
      return;
    }
    if (!professionId) {
      showToast('আপনার পেশা / ক্যাটাগরি নির্বাচন করুন।', 'error');
      return;
    }
    if (!divisionId || !districtId) {
      showToast('অনুগ্রহ করে বিভাগ এবং জেলা নির্বাচন করুন।', 'error');
      return;
    }
    if (!shortBio.trim() || shortBio.trim().length < 15) {
      showToast('কমপক্ষে ১৫ অক্ষরের সংক্ষিপ্ত পরিচিতি (Short Bio) লিখুন।', 'error');
      return;
    }
    if (!cleanNid || cleanNid.length < 8) {
      showToast('সঠিক জাতীয় পরিচয়পত্র (NID) বা আইডি নম্বর লিখুন।', 'error');
      return;
    }

    const hasFront = Boolean(frontFile || existingRequest?.id_front_path);
    const hasBack = Boolean(backFile || existingRequest?.id_back_path);
    const hasSelfie = Boolean(selfieFile || existingRequest?.selfie_path);

    if (!hasFront || !hasBack || !hasSelfie) {
      showToast('আইডির সামনের ছবি, পেছনের ছবি এবং আপনার সেলফি — তিনটিই আবশ্যিক।', 'error');
      return;
    }

    const selectedProf = professions.find((p) => String(p.id) === String(professionId));
    const selectedDiv = divisions.find((d) => String(d.id) === String(divisionId));
    const selectedDis = districts.find((d) => String(d.id) === String(districtId));
    const selectedUpa = upazilas.find((u) => String(u.id) === String(upazilaId));

    setSubmitting(true);
    try {
      const saved = await submitVerificationRequest(
        user,
        {
          full_name: fullName.trim(),
          phone: cleanPhone,
          profession_id: professionId,
          category_name: selectedProf?.name_bn || '',
          division_id: divisionId,
          district_id: districtId,
          upazila_id: upazilaId || '',
          division_name: selectedDiv?.name_bn || '',
          district_name: selectedDis?.name_bn || '',
          upazila_name: selectedUpa?.name_bn || '',
          short_bio: shortBio.trim(),
          nid_number: cleanNid,
          id_front_file: frontFile,
          id_back_file: backFile,
          selfie_file: selfieFile,
          existing_front_path: existingRequest?.id_front_path,
          existing_back_path: existingRequest?.id_back_path,
          existing_selfie_path: existingRequest?.selfie_path,
        },
        profile?.id
      );

      setExistingRequest(saved);
      setFrontFile(null);
      setBackFile(null);
      setSelfieFile(null);
      await refreshProfile();
      showToast(
        'আপনার ভেরিফিকেশন আবেদন সফলভাবে জমা হয়েছে! অ্যাডমিন যাচাই করে অনুমোদন দেবেন।',
        'success'
      );
    } catch (err: any) {
      console.error('[VerifyProfile] handleSubmit error:', err);
      showToast(translateSupabaseError(err, 'ভেরিফিকেশন আবেদন জমা দিতে সমস্যা হয়েছে।'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInit) {
    return (
      <div className="min-h-[65vh] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
          ভেরিফিকেশন তথ্য লোড হচ্ছে...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-[var(--brand-primary)]" />
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-siliguri">
                প্রোফাইল ভেরিফিকেশন
              </h1>
              {currentStatus === 'verified' && <VerifiedBadge size="md" showLabel />}
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              পাবলিক পেশাজীবী ডিরেক্টরিতে যুক্ত হতে এবং ব্লু ভেরিফাইড ব্যাজ পেতে নিচের তথ্য ও আইডি ডকুমেন্ট জমা দিন।
            </p>
          </div>

          <Link
            to="/account"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition shrink-0"
          >
            <span>প্রোফাইল এডিটে ফিরে যান</span>
          </Link>
        </div>

        {/* Privacy Notice */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-start gap-3">
          <Lock className="w-5 h-5 text-[var(--brand-primary)] shrink-0 mt-0.5" />
          <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            <strong>সম্পূর্ণ গোপনীয় ও নিরাপদ:</strong> আপনার NID নম্বর, আইডি কার্ডের ছবি এবং সেলফি আলাদা প্রাইভেট স্টোরেজে সংরক্ষিত থাকে। শুধুমাত্র আপনি এবং অ্যাডমিন এই ডকুমেন্ট দেখতে পারবেন—কখনোই পাবলিক প্রোফাইলে প্রদর্শিত হবে না।
          </div>
        </div>
      </div>

      {/* Status Banner */}
      {currentStatus === 'verified' && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h2 className="text-lg font-extrabold text-emerald-950 dark:text-emerald-200 flex items-center gap-2">
                <span>অভিনন্দন! আপনার প্রোফাইল ভেরিফাইড</span>
                <VerifiedBadge size="md" />
              </h2>
              <p className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-300/90 leading-relaxed">
                আপনার প্রোফাইল পাবলিক পেশাজীবী তালিকায় প্রকাশিত রয়েছে এবং আপনি জব পোস্ট ও জবে আবেদন করতে পারবেন।
              </p>
            </div>
          </div>
          {profile?.id && (
            <Link
              to={`/profile/${profile.id}`}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-2 shrink-0 transition"
            >
              <Eye className="w-4 h-4" />
              <span>পাবলিক প্রোফাইল দেখুন</span>
            </Link>
          )}
        </div>
      )}

      {currentStatus === 'pending' && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-3xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <Clock className="w-7 h-7 text-[var(--brand-primary)] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                আপনার ভেরিফিকেশন আবেদন বর্তমানে যাচাইাধীন (Pending) আছে
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                অ্যাডমিন আপনার ডকুমেন্ট যাচাই করার পর নোটিফিকেশনের মাধ্যমে আপনাকে জানানো হবে। প্রয়োজনে নিচে তথ্য আপডেট করতে পারেন।
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              await refreshProfile();
              if (user) {
                const latest = await fetchMyVerificationRequest(user.id);
                setExistingRequest(latest);
              }
              showToast('স্ট্যাটাস রিফ্রেশ করা হয়েছে।', 'info');
            }}
            className="px-4 py-2 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 text-xs font-bold text-[var(--brand-primary)] rounded-xl inline-flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>স্ট্যাটাস চেক করুন</span>
          </button>
        </div>
      )}

      {currentStatus === 'rejected' && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-3xl p-6 space-y-2">
          <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200 font-bold text-base">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>আপনার পূর্ববর্তী ভেরিফিকেশন আবেদন প্রত্যাখ্যাত হয়েছে</span>
          </div>
          {rejectionReason && (
            <p className="text-xs sm:text-sm text-rose-700 dark:text-rose-300 bg-white/80 dark:bg-rose-950/60 p-3.5 rounded-xl border border-rose-200 dark:border-rose-800 font-semibold">
              অ্যাডমিনের নোট / কারণ: {rejectionReason}
            </p>
          )}
          <p className="text-xs text-rose-700 dark:text-rose-300">
            নিচের ফর্মে সঠিক তথ্য ও স্পষ্ট ডকুমেন্ট আপলোড করে পুনরায় আবেদন জমা দিন।
          </p>
        </div>
      )}

      {/* Verification Form (Shown when unverified, rejected, or pending update) */}
      {currentStatus !== 'verified' && (
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6"
        >
          <h3 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
            ভেরিফিকেশন আবেদন ফর্ম
          </h3>

          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                পূর্ণ নাম (NID অনুযায়ী) *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="আপনার পূর্ণ নাম"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                সচল মোবাইল নম্বর (১১ সংখ্যা) *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                maxLength={11}
                placeholder="01712345678"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                পেশা / ক্যাটাগরি *
              </label>
              <select
                value={professionId}
                onChange={(e) => setProfessionId(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white"
              >
                <option value="">পেশা নির্বাচন করুন</option>
                {professions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name_bn}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                জাতীয় পরিচয়পত্র (NID) / আইডি নম্বর *
              </label>
              <input
                type="text"
                value={nidNumber}
                onChange={(e) => setNidNumber(e.target.value)}
                required
                placeholder="১০, ১৩ বা ১৭ সংখ্যার NID নম্বর"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-medium"
              />
            </div>
          </div>

          {/* Cascading Location */}
          <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
              <MapPin className="w-4 h-4 text-[var(--brand-primary)]" />
              <span>কর্মক্ষেত্রের ঠিকানা (বিভাগ → জেলা → উপজেলা) *</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={divisionId}
                onChange={(e) => {
                  setDivisionId(e.target.value);
                  setDistrictId('');
                  setUpazilaId('');
                }}
                required
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold"
              >
                <option value="">বিভাগ নির্বাচন করুন *</option>
                {divisions.map((div) => (
                  <option key={div.id} value={div.id}>
                    {div.name_bn}
                  </option>
                ))}
              </select>

              <select
                value={districtId}
                onChange={(e) => {
                  setDistrictId(e.target.value);
                  setUpazilaId('');
                }}
                required
                disabled={!divisionId}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold disabled:opacity-50"
              >
                <option value="">জেলা নির্বাচন করুন *</option>
                {districts.map((dis) => (
                  <option key={dis.id} value={dis.id}>
                    {dis.name_bn}
                  </option>
                ))}
              </select>

              <select
                value={upazilaId}
                onChange={(e) => setUpazilaId(e.target.value)}
                disabled={!districtId}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold disabled:opacity-50"
              >
                <option value="">উপজেলা / থানা (ঐচ্ছিক)</option>
                {upazilas.map((upa) => (
                  <option key={upa.id} value={upa.id}>
                    {upa.name_bn}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Short Bio */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              সংক্ষিপ্ত পেশাগত পরিচিতি (Short Bio) *
            </label>
            <textarea
              rows={3}
              value={shortBio}
              onChange={(e) => setShortBio(e.target.value)}
              required
              maxLength={400}
              placeholder="আপনার অভিজ্ঞতা, শিক্ষাগত যোগ্যতা এবং কী ধরনের সেবা প্রদান করেন তা সংক্ষেপে লিখুন..."
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium"
            />
          </div>

          {/* Private ID & Selfie Uploads */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              পরিচয় যাচাইকরণের ছবি (স্পষ্ট ও আলোকিত ছবি আপলোড করুন) *
            </label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* ID Front */}
              <div className="p-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    ১. আইডির সামনের অংশ *
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    NID / স্মার্ট কার্ডের সামনের ছবি
                  </p>
                </div>

                {frontPreview && (
                  <img
                    src={frontPreview}
                    alt="ID Front"
                    className="w-full h-32 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                  />
                )}

                <label className="w-full py-2.5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-[var(--brand-primary)] flex items-center justify-center gap-1.5 cursor-pointer transition">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{frontPreview ? 'পরিবর্তন করুন' : 'ছবি নির্বাচন করুন'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFilePick(e, 'front')}
                    className="hidden"
                  />
                </label>
              </div>

              {/* ID Back */}
              <div className="p-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    ২. আইডির পেছনের অংশ *
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    ঠিকানা সংবলিত পেছনের ছবি
                  </p>
                </div>

                {backPreview && (
                  <img
                    src={backPreview}
                    alt="ID Back"
                    className="w-full h-32 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                  />
                )}

                <label className="w-full py-2.5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-[var(--brand-primary)] flex items-center justify-center gap-1.5 cursor-pointer transition">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{backPreview ? 'পরিবর্তন করুন' : 'ছবি নির্বাচন করুন'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFilePick(e, 'back')}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Selfie */}
              <div className="p-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    ৩. আপনার স্পষ্ট সেলফি *
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    মুখমণ্ডল স্পষ্ট দেখা যায় এমন ছবি
                  </p>
                </div>

                {selfiePreview && (
                  <img
                    src={selfiePreview}
                    alt="Selfie"
                    className="w-full h-32 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                  />
                )}

                <label className="w-full py-2.5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-[var(--brand-primary)] flex items-center justify-center gap-1.5 cursor-pointer transition">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{selfiePreview ? 'পরিবর্তন করুন' : 'সেলফি নির্বাচন করুন'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFilePick(e, 'selfie')}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-brand text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-md transition cursor-pointer disabled:opacity-60"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>ডকুমেন্ট আপলোড ও জমা হচ্ছে...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {currentStatus === 'pending'
                    ? 'ভেরিফিকেশন তথ্য আপডেট করুন'
                    : currentStatus === 'rejected'
                    ? 'পুনরায় ভেরিফিকেশন আবেদন জমা দিন'
                    : 'ভেরিফিকেশন আবেদন জমা দিন'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
};
