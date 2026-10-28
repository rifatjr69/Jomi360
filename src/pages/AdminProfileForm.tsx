import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Plus,
  Save,
} from 'lucide-react';
import {
  getCurrentSessionProfile,
  fetchProfessions,
  fetchDivisions,
  fetchDistricts,
  fetchUpazilas,
  adminCreateDisplayProfile,
  adminGetProfileById,
  adminUpdateProfileFull,
  uploadProfileMedia,
  resolveLocationNames,
  toEnglishDigits,
  normalizeBn,
  translateSupabaseError,
} from '../lib/supabase';
import type { Profession, ProfileStatus, Division, District, Upazila } from '../types/database';
import { AddressPickerModal, SelectedLocation } from '../components/AddressPickerModal';
import { Avatar } from '../components/Avatar';
import { useToast } from '../components/Toast';
import { ProfileCard } from '../components/ProfileCard';
import { useAuth } from '../context/AuthContext';

export const AdminProfileForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id);
  const { showToast } = useToast();
  const { profile: authProfile, isAdmin, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [upazilas, setUpazilas] = useState<Upazila[]>([]);

  // Form Fields — Section 1: Basic Info
  const [userSerial, setUserSerial] = useState<number>(1);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [nidNumber, setNidNumber] = useState('');
  const [professionId, setProfessionId] = useState('');
  const [servicesText, setServicesText] = useState('');
  const [bio, setBio] = useState('');

  // Form Fields — Section 2: Photos
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [coverPhotoUrl, setCoverPhotoUrl] = useState('');
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [coverPhotoFile, setCoverPhotoFile] = useState<File | null>(null);

  // Form Fields — Section 3: Address
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [addressPickerOpen, setAddressPickerOpen] = useState(false);
  const [addressDetail, setAddressDetail] = useState('');

  // Form Fields — Section 4: Profession-specific Extra Info (jsonb)
  const [extraInfo, setExtraInfo] = useState<Record<string, any>>({});
  const [customKey, setCustomKey] = useState('');
  const [customVal, setCustomVal] = useState('');

  // Form Fields — Section 5: Status & Publishing
  const [status, setStatus] = useState<ProfileStatus>('approved');
  const [isVerified, setIsVerified] = useState(true);

  // Load initial data and existing profile if edit mode
  useEffect(() => {
    async function init() {
      if (authLoading) return;

      const user = authProfile || getCurrentSessionProfile();
      if (!user || (!isAdmin && user.role !== 'admin')) {
        showToast('অনুমতি নেই, আপনি অ্যাডমিন হিসেবে লগইন আছেন কিনা দেখুন।', 'error');
        navigate('/account', { replace: true });
        return;
      }

      try {
        const [profs, divs, dis, upas] = await Promise.all([
          fetchProfessions(),
          fetchDivisions(),
          fetchDistricts(),
          fetchUpazilas(),
        ]);
        setProfessions(profs);
        setDivisions(divs);
        setDistricts(dis);
        setUpazilas(upas);

        if (profs.length > 0 && !professionId) {
          setProfessionId(profs[0].id);
        }

        if (isEditMode && id) {
          const existing = await adminGetProfileById(id);
          if (existing) {
            setUserSerial(existing.user_serial || 1);
            setFullName(existing.full_name || '');
            setPhone(existing.phone || '');
            setEmail(existing.email || '');
            setNidNumber(existing.nid_number || '');
            setProfessionId(existing.profession_id || (profs[0]?.id ?? ''));
            setServicesText(existing.extra_info?.services || '');
            setBio(existing.bio || '');
            setProfilePhotoUrl(existing.profile_photo_url || '');
            setCoverPhotoUrl(existing.cover_photo_url || '');
            setAddressDetail(existing.address_detail || '');
            setStatus(existing.status || 'approved');
            setIsVerified(existing.is_verified ?? true);
            setExtraInfo(existing.extra_info || {});

            const loc = resolveLocationNames(
              existing.division_id,
              existing.district_id,
              existing.upazila_id,
              existing.extra_info
            );
            const locDisplay = [loc.upazila_name, loc.district_name, loc.division_name]
              .filter(Boolean)
              .join(', ');

            if (existing.division_id || existing.district_id || locDisplay) {
              setSelectedLocation({
                division_id: existing.division_id || undefined,
                district_id: existing.district_id || undefined,
                upazila_id: existing.upazila_id || undefined,
                division_name: loc.division_name,
                district_name: loc.district_name,
                upazila_name: loc.upazila_name,
                displayText: locDisplay || 'নির্বাচিত এলাকা (পরিবর্তন করতে ক্লিক করুন)',
              });
            }
          } else {
            showToast('প্রোফাইল পাওয়া যায়নি।', 'error');
            navigate('/dashboard');
            return;
          }
        }
      } catch (err: any) {
        console.error('[AdminProfileForm] init error:', err);
        showToast(translateSupabaseError(err, 'ফর্ম লোড করতে সমস্যা হয়েছে।'), 'error');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [id, isEditMode, navigate, authLoading, authProfile, isAdmin]);

  // Handle file selection & preview
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'cover') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      showToast('ছবির সাইজ ৩MB এর বেশি হতে পারবে না।', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      if (type === 'profile') {
        setProfilePhotoFile(file);
        setProfilePhotoUrl(res);
      } else {
        setCoverPhotoFile(file);
        setCoverPhotoUrl(res);
      }
    };
    reader.readAsDataURL(file);
  };

  // Selected profession object
  const selectedProfession = professions.find((p) => String(p.id) === String(professionId));
  const professionSlug = selectedProfession?.slug || '';
  const professionNameBn = normalizeBn(selectedProfession?.name_bn || '');

  const isSurveyor = professionSlug === 'surveyor' || professionNameBn === normalizeBn('সার্ভেয়ার');
  const isAdvocateOrBarrister =
    professionSlug === 'advocate' ||
    professionSlug === 'barrister' ||
    professionNameBn === normalizeBn('এডভোকেট') ||
    professionNameBn === normalizeBn('ব্যারিস্টার');
  const isDeedWriter =
    professionSlug === 'deed-writer' || professionNameBn === normalizeBn('দলিল লেখক');
  const isCommissioner =
    professionSlug === 'civil-court-commissioner' ||
    professionNameBn === normalizeBn('সিভিল কোর্ট কমিশনার');

  const handleAddCustomField = () => {
    if (!customKey.trim() || !customVal.trim()) return;
    setExtraInfo({ ...extraInfo, [customKey.trim()]: customVal.trim() });
    setCustomKey('');
    setCustomVal('');
  };

  const handleRemoveCustomField = (key: string) => {
    const copy = { ...extraInfo };
    delete copy[key];
    setExtraInfo(copy);
  };

  // Validation & Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      showToast('পূর্ণ নাম আবশ্যক।', 'error');
      return;
    }

    const cleanPhone = toEnglishDigits(phone.trim());
    const phoneRegex = /^01[3-9]\d{8}$/;
    if (!phoneRegex.test(cleanPhone)) {
      showToast('সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন (যেমন: 01712345678)।', 'error');
      return;
    }

    if (!selectedLocation?.division_id || !selectedLocation?.district_id) {
      showToast('কমপক্ষে বিভাগ ও জেলা নির্বাচন বাধ্যতামূলক।', 'error');
      return;
    }

    setSaving(true);

    try {
      let finalProfilePhotoUrl = profilePhotoUrl;
      let finalCoverPhotoUrl = coverPhotoUrl;

      if (profilePhotoFile) {
        finalProfilePhotoUrl = await uploadProfileMedia(profilePhotoFile, 'avatars', 'admin');
      }
      if (coverPhotoFile) {
        finalCoverPhotoUrl = await uploadProfileMedia(coverPhotoFile, 'avatars', 'admin');
      }

      const mergedExtra = {
        ...extraInfo,
        services: servicesText.trim(),
        ...(selectedLocation.division_name ? { _division_name: selectedLocation.division_name } : {}),
        ...(selectedLocation.district_name ? { _district_name: selectedLocation.district_name } : {}),
        ...(selectedLocation.upazila_name ? { _upazila_name: selectedLocation.upazila_name } : {}),
        ...(selectedProfession?.name_bn ? { _profession_name: selectedProfession.name_bn } : {}),
      };

      const payload = {
        full_name: fullName.trim(),
        phone: cleanPhone,
        email: email.trim() ? email.trim().toLowerCase() : null,
        nid_number: nidNumber.trim() ? toEnglishDigits(nidNumber.trim()) : null,
        profession_id: professionId,
        division_id: selectedLocation.division_id,
        district_id: selectedLocation.district_id,
        upazila_id: selectedLocation.upazila_id || undefined,
        address_detail: addressDetail.trim() || null,
        bio: bio.trim() || null,
        profile_photo_url: finalProfilePhotoUrl || null,
        cover_photo_url: finalCoverPhotoUrl || null,
        extra_info: mergedExtra,
        status,
        is_verified: isVerified,
      };

      if (isEditMode && id) {
        await adminUpdateProfileFull(id, payload);
        showToast('প্রোফাইল সফলভাবে আপডেট করা হয়েছে!', 'success');
        navigate('/dashboard');
      } else {
        await adminCreateDisplayProfile(payload);
        showToast('প্রোফাইল সফলভাবে ডিরেক্টরিতে যোগ করা হয়েছে!', 'success');
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error('[AdminProfileForm] submit error:', err);
      showToast(
        translateSupabaseError(err, 'প্রোফাইল সংরক্ষণ ব্যর্থ হয়েছে। আপনার অ্যাডমিন অনুমতি ও ডাটাবেস চেক করুন।'),
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const selectedDiv = divisions.find((d) => String(d.id) === String(selectedLocation?.division_id));
  const selectedDis = districts.find((d) => String(d.id) === String(selectedLocation?.district_id));
  const selectedUpa = upazilas.find((u) => String(u.id) === String(selectedLocation?.upazila_id));

  const previewProfile = {
    id: id || 'preview-id',
    auth_user_id: null,
    user_serial: isEditMode ? userSerial : 1,
    full_name: fullName || 'পূর্ণ নাম এখানে দেখাবে',
    phone: toEnglishDigits(phone) || '017XXXXXXXX',
    email: email || 'email@domain.com',
    profession_id: professionId,
    profession_name: selectedProfession?.name_bn || 'পেশা',
    division_id: selectedLocation?.division_id || '',
    division_name: selectedLocation?.division_name || selectedDiv?.name_bn || 'বিভাগ',
    district_id: selectedLocation?.district_id || '',
    district_name: selectedLocation?.district_name || selectedDis?.name_bn || 'জেলা',
    upazila_id: selectedLocation?.upazila_id || '',
    upazila_name: selectedLocation?.upazila_name || selectedUpa?.name_bn || '',
    address_detail: addressDetail,
    profile_photo_url: profilePhotoUrl,
    cover_photo_url: coverPhotoUrl,
    bio: bio || 'এখানে আপনার সংক্ষিপ্ত বিবরণ বা বায়ো প্রদর্শিত হবে...',
    extra_info: {
      ...extraInfo,
      services: servicesText.trim(),
    },
    role: 'user' as const,
    status,
    is_verified: isVerified,
    created_at: new Date().toISOString(),
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-24 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-[#0B63E5] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 font-siliguri">
          ফর্ম লোড হচ্ছে...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-20">
      {/* Top Header */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white font-siliguri">
              {isEditMode ? 'প্রোফাইল তথ্য এডিট করুন' : '➕ নতুন পেশাজীবী প্রোফাইল যোগ করুন'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              অ্যাডমিন প্যানেল · সরাসরি ডিরেক্টরিতে প্রোফাইল প্রকাশ করুন
            </p>
          </div>
        </div>

        <Link
          to="/dashboard"
          className="text-xs font-bold text-[#0B63E5] dark:text-blue-400 hover:underline hidden sm:block"
        >
          ← অ্যাডমিন প্যানেলে ফিরুন
        </Link>
      </div>

      {/* Main Grid: Form on Left, Live Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Form Container (2 Columns) */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-8">
          {/* SECTION 1: মৌলিক তথ্য (Basic Info) */}
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md space-y-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-[#EFF6FF] dark:bg-blue-950 text-[#0B63E5] dark:text-blue-400 text-xs font-bold flex items-center justify-center">
                ১
              </span>
              <span>মৌলিক তথ্য</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">পূর্ণ নাম *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="যেমন: প্রকৌশলী মো. রফিকুল ইসলাম"
                  required
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#0B63E5]"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  মোবাইল নম্বর (01XXXXXXXXX) *
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01712345678"
                  required
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-mono font-medium text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#0B63E5]"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">ই-মেইল (ঐচ্ছিক)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@gmail.com"
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-mono text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">পেশা নির্বাচন *</label>
                <select
                  value={professionId}
                  onChange={(e) => setProfessionId(e.target.value)}
                  required
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-[#0B63E5] dark:text-blue-300 focus:ring-2 focus:ring-[#0B63E5]"
                >
                  {professions.map((prof) => (
                    <option key={prof.id} value={prof.id}>
                      {prof.name_bn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  জাতীয় পরিচয়পত্র (NID) নম্বর (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={nidNumber}
                  onChange={(e) => setNidNumber(e.target.value)}
                  placeholder="১০, ১৩ বা ১৭ সংখ্যার NID নম্বর"
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-mono text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 text-xs mb-1">
                সেবা সমূহ (কার্ডে সরাসরি প্রদর্শিত হবে)
              </label>
              <textarea
                value={servicesText}
                onChange={(e) => setServicesText(e.target.value)}
                rows={2}
                maxLength={300}
                placeholder="যেমন: 👉 বিল্ডিং প্লানিং, 👉 স্ট্রাকচারাল ডিজাইন, 👉 ডিজিটাল সার্ভে..."
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1 text-xs">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  সংক্ষিপ্ত বিবরণ / Bio
                </label>
                <span className={`font-mono ${bio.length > 500 ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                  {bio.length}/৫০০ অক্ষর
                </span>
              </div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="পেশাজীবীর কাজের অভিজ্ঞতা, দক্ষতা ও বিশেষত্ব সম্পর্কে লিখুন..."
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* SECTION 2: ছবি (Photos) */}
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md space-y-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-[#EFF6FF] dark:bg-blue-950 text-[#0B63E5] dark:text-blue-400 text-xs font-bold flex items-center justify-center">
                ২
              </span>
              <span>প্রোফাইল ও কভার ছবি</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
              {/* Profile Photo Upload */}
              <div className="space-y-3">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  প্রোফাইল ছবি (গোল প্রিভিউ)
                </label>
                <div className="flex items-center gap-4">
                  <Avatar
                    src={profilePhotoUrl}
                    name={fullName || 'User'}
                    size="lg"
                    className="ring-4 ring-blue-500/20"
                  />
                  <div className="space-y-2 flex-1">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => handleFileChange(e, 'profile')}
                      className="block w-full text-[11px] text-slate-500 file:mr-2 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-[#0B63E5] file:text-white file:font-bold hover:file:bg-[#084FC7] cursor-pointer"
                    />
                    {profilePhotoUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setProfilePhotoUrl('');
                          setProfilePhotoFile(null);
                        }}
                        className="text-rose-600 dark:text-rose-400 font-bold hover:underline text-[11px] cursor-pointer"
                      >
                        ছবি মুছুন
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Cover Photo Upload */}
              <div className="space-y-3">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  কভার ছবি (ঐচ্ছিক)
                </label>
                <div className="space-y-2">
                  <div className="h-20 w-full rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden relative">
                    {coverPhotoUrl ? (
                      <img src={coverPhotoUrl} alt="Cover preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400 text-[11px]">
                        কভার ছবি নেই
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleFileChange(e, 'cover')}
                    className="block w-full text-[11px] text-slate-500 file:mr-2 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-slate-700 file:text-white file:font-bold hover:file:bg-slate-800 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: ঠিকানা (Address) */}
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md space-y-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-[#EFF6FF] dark:bg-blue-950 text-[#0B63E5] dark:text-blue-400 text-xs font-bold flex items-center justify-center">
                ৩
              </span>
              <span>ঠিকানা / এলাকা নির্বাচন *</span>
            </h3>

            <div className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  বিভাগ, জেলা ও উপজেলা বাছাই করুন *
                </label>
                <button
                  type="button"
                  onClick={() => setAddressPickerOpen(true)}
                  className="w-full py-3.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border border-slate-200 dark:border-slate-700 rounded-2xl text-left flex items-center justify-between text-slate-900 dark:text-slate-100 font-bold cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-[#0B63E5] shrink-0" />
                    <span className="truncate">
                      {selectedLocation?.displayText || 'এলাকা নির্বাচন করতে ক্লিক করুন (বাধ্যতামূলক)'}
                    </span>
                  </div>
                  <span className="text-[#0B63E5] dark:text-blue-400 text-xs">পরিবর্তন ❯</span>
                </button>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  বিস্তারিত ঠিকানা (গ্রাম/রাস্তা/অফিস)
                </label>
                <input
                  type="text"
                  value={addressDetail}
                  onChange={(e) => setAddressDetail(e.target.value)}
                  placeholder="যেমন: জজ কোর্ট রোড, চেম্বার নং ১২"
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: পেশাভিত্তিক বিশেষ তথ্য (Profession-specific Info stored in extra_info) */}
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md space-y-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-[#EFF6FF] dark:bg-blue-950 text-[#0B63E5] dark:text-blue-400 text-xs font-bold flex items-center justify-center">
                ৪
              </span>
              <span>পেশাভিত্তিক বিশেষ তথ্য ({selectedProfession?.name_bn || 'সাধারণ'})</span>
            </h3>

            <div className="space-y-4 text-xs font-semibold">
              {/* Surveyor Specific Fields */}
              {isSurveyor && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">সনদ / লাইসেন্স নম্বর</label>
                    <input
                      type="text"
                      value={extraInfo.license_no || ''}
                      onChange={(e) => setExtraInfo({ ...extraInfo, license_no: e.target.value })}
                      placeholder="যেমন: SRV-2045"
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">সনদ প্রাপ্তির সাল</label>
                    <input
                      type="text"
                      value={extraInfo.cert_year || ''}
                      onChange={(e) => setExtraInfo({ ...extraInfo, cert_year: e.target.value })}
                      placeholder="যেমন: ২০১০"
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">সনদ প্রদানকারী প্রতিষ্ঠান</label>
                    <input
                      type="text"
                      value={extraInfo.cert_issuer || ''}
                      onChange={(e) => setExtraInfo({ ...extraInfo, cert_issuer: e.target.value })}
                      placeholder="যেমন: বাংলাদেশ সার্ভে ইন্সটিটিউট"
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">সার্ভেয়ারের ধরন</label>
                    <select
                      value={extraInfo.surveyor_type || 'both'}
                      onChange={(e) => setExtraInfo({ ...extraInfo, surveyor_type: e.target.value })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold"
                    >
                      <option value="analog">এনালগ</option>
                      <option value="digital">ডিজিটাল</option>
                      <option value="both">উভয় (এনালগ ও ডিজিটাল)</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">অভিজ্ঞতা (বছর)</label>
                    <input
                      type="text"
                      value={extraInfo.experience_years || ''}
                      onChange={(e) => setExtraInfo({ ...extraInfo, experience_years: e.target.value })}
                      placeholder="যেমন: ১০ বছর"
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl"
                    />
                  </div>
                </div>
              )}

              {/* Advocate & Barrister Specific Fields */}
              {isAdvocateOrBarrister && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">বার কাউন্সিল নম্বর</label>
                    <input
                      type="text"
                      value={extraInfo.bar_council_no || ''}
                      onChange={(e) => setExtraInfo({ ...extraInfo, bar_council_no: e.target.value })}
                      placeholder="যেমন: BC-98421"
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">কোর্ট / ট্রাইব্যুনাল</label>
                    <input
                      type="text"
                      value={extraInfo.court || ''}
                      onChange={(e) => setExtraInfo({ ...extraInfo, court: e.target.value })}
                      placeholder="যেমন: জেলা ও দায়রা জজ আদালত, ঢাকা"
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">বিশেষজ্ঞতার ক্ষেত্র</label>
                    <input
                      type="text"
                      value={extraInfo.specialization || ''}
                      onChange={(e) => setExtraInfo({ ...extraInfo, specialization: e.target.value })}
                      placeholder="যেমন: দেওয়ানি ও ল্যান্ড ট্রাইব্যুনাল"
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">অভিজ্ঞতা (বছর)</label>
                    <input
                      type="text"
                      value={extraInfo.experience_years || ''}
                      onChange={(e) => setExtraInfo({ ...extraInfo, experience_years: e.target.value })}
                      placeholder="যেমন: ১২ বছর"
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl"
                    />
                  </div>
                </div>
              )}

              {/* Deed Writer Specific Fields */}
              {isDeedWriter && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">লাইসেন্স নম্বর</label>
                    <input
                      type="text"
                      value={extraInfo.license_no || ''}
                      onChange={(e) => setExtraInfo({ ...extraInfo, license_no: e.target.value })}
                      placeholder="যেমন: BSR-4451"
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">সাব-রেজিস্ট্রি অফিস</label>
                    <input
                      type="text"
                      value={extraInfo.sub_registry_office || ''}
                      onChange={(e) => setExtraInfo({ ...extraInfo, sub_registry_office: e.target.value })}
                      placeholder="যেমন: সদর সাব-রেজিস্ট্রি অফিস"
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl"
                    />
                  </div>
                </div>
              )}

              {/* Civil Court Commissioner Specific Fields */}
              {isCommissioner && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">নিয়োগের সাল</label>
                    <input
                      type="text"
                      value={extraInfo.appointment_year || ''}
                      onChange={(e) => setExtraInfo({ ...extraInfo, appointment_year: e.target.value })}
                      placeholder="যেমন: ২০১৫"
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">কোর্ট / জেলা</label>
                    <input
                      type="text"
                      value={extraInfo.court || ''}
                      onChange={(e) => setExtraInfo({ ...extraInfo, court: e.target.value })}
                      placeholder="যেমন: জেলা জজ আদালত"
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl"
                    />
                  </div>
                </div>
              )}

              {/* Custom Extra Fields Manager for ALL professions */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <label className="block font-bold text-slate-800 dark:text-slate-200">
                  অতিরিক্ত কাস্টম তথ্য যোগ করুন (Key-Value)
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  <input
                    type="text"
                    value={customKey}
                    onChange={(e) => setCustomKey(e.target.value)}
                    placeholder="লেবেল (যেমন: ডিগ্রি)"
                    className="sm:col-span-2 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                  <input
                    type="text"
                    value={customVal}
                    onChange={(e) => setCustomVal(e.target.value)}
                    placeholder="মান (যেমন: LL.B)"
                    className="sm:col-span-2 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomField}
                    className="px-4 py-2 bg-[#0B63E5] hover:bg-[#084FC7] text-white font-bold rounded-xl flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>যোগ</span>
                  </button>
                </div>

                {Object.keys(extraInfo).filter((k) => !k.startsWith('_')).length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {Object.entries(extraInfo)
                      .filter(([k]) => !k.startsWith('_'))
                      .map(([k, v]) => (
                        <span
                          key={k}
                          className="inline-flex items-center gap-2 bg-[#EFF6FF] dark:bg-blue-950/60 text-[#0F2942] dark:text-blue-200 px-3 py-1.5 rounded-xl border border-[#BFDBFE] dark:border-[#0B63E5] font-mono text-[11px]"
                        >
                          <strong>{k}:</strong> {String(v)}
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomField(k)}
                            className="text-rose-600 hover:text-rose-800 ml-1 font-bold cursor-pointer"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 5: স্ট্যাটাস ও প্রকাশ (Status & Publishing) */}
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md space-y-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-[#EFF6FF] dark:bg-blue-950 text-[#0B63E5] dark:text-blue-400 text-xs font-bold flex items-center justify-center">
                ৫
              </span>
              <span>স্ট্যাটাস ও ভেরিফিকেশন</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">প্রোফাইল স্ট্যাটাস *</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProfileStatus)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-[#0B63E5] dark:text-blue-300"
                >
                  <option value="approved">অনুমোদিত (Approved - হোম পেজে দেখাবে)</option>
                  <option value="pending">যাচাইয়ের অপেক্ষায় (Pending)</option>
                  <option value="rejected">প্রত্যাখ্যাত (Rejected)</option>
                  <option value="suspended">স্থগিত (Suspended)</option>
                </select>
              </div>

              <div className="flex items-center pt-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isVerified}
                    onChange={(e) => setIsVerified(e.target.checked)}
                    className="w-5 h-5 rounded text-[#0B63E5] focus:ring-[#0B63E5]"
                  />
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    অ্যাডমিন ভেরিফাইড ব্যাজ দিন (Verified Badge)
                  </span>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-4">
              <Link
                to="/dashboard"
                className="px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-2xl transition-colors"
              >
                বাতিল করুন
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="px-8 py-3 bg-[#0B63E5] hover:bg-[#084FC7] dark:bg-[#0B63E5] dark:hover:bg-[#084FC7] text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-600/15 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>
                  {saving ? 'সংরক্ষণ হচ্ছে...' : isEditMode ? 'পরিবর্তন সেভ করুন' : 'প্রোফাইল প্রকাশ করুন'}
                </span>
              </button>
            </div>
          </div>
        </form>

        {/* Live Preview Card on Right */}
        <div className="lg:col-span-1 space-y-4 lg:sticky lg:top-24">
          <div className="bg-white dark:bg-slate-900 text-[#0F2942] dark:text-white p-5 rounded-2xl shadow-sm border border-[#E2E8F0] dark:border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B63E5] dark:text-blue-400 mb-2 flex items-center gap-1.5">
              <span>👁️</span> লাইভ কার্ড প্রিভিউ (Home Preview)
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
              হোম পেজ ও ডিরেক্টরিতে এই পেশাজীবীর কার্ডটি যেভাবে প্রদর্শিত হবে:
            </p>

            <div>
              <ProfileCard profile={previewProfile} isPreview={true} />
            </div>
          </div>
        </div>
      </div>

      {/* Address Picker Modal */}
      <AddressPickerModal
        isOpen={addressPickerOpen}
        onClose={() => setAddressPickerOpen(false)}
        onSelect={(loc) => setSelectedLocation(loc)}
        initialLocation={{
          division_id: selectedLocation?.division_id,
          district_id: selectedLocation?.district_id,
          upazila_id: selectedLocation?.upazila_id,
        }}
      />
    </div>
  );
};
