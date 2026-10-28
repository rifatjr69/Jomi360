import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  FileText,
  Lock,
  Share2,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  Upload,
  Save,
  MapPin,
  Trash2,
  PlusCircle,
  Image as ImageIcon,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import {
  fetchProfessions,
  fetchPostsForProfile,
  createPostInDb,
  deletePostInDb,
  uploadPostImage,
  uploadProfileMedia,
  resolveLocationNames,
  toEnglishDigits,
  normalizeBn,
  translateSupabaseError,
  supabase,
  isSupabaseConfigured,
} from '../lib/supabase';
import { saveUserOwnProfile } from '../lib/profileService';
import type { Profession, Post, PublicProfile } from '../types/database';
import { AddressPickerModal, SelectedLocation } from '../components/AddressPickerModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { ProfileCard } from '../components/ProfileCard';

const QUICK_SERVICE_TAGS = [
  '👉 ডিজিটাল সার্ভে',
  '👉 জমি পরিমাপ ও সীমানা নির্ধারণ',
  '👉 বিল্ডিং প্লানিং',
  '👉 স্ট্রাকচারাল ডিজাইন',
  '👉 আর্কিটেকচারাল ডিজাইন',
  '👉 দলিল লিখন ও যাচাই',
  '👉 নামজারি ও খতিয়ান পরামর্শ',
  '👉 দেওয়ানি ও ভূমি মামলা',
];

export const Account: React.FC = () => {
  const { profile, user, loading: authLoading, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'profile' | 'posts' | 'password'>('profile');
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState<'avatar' | 'cover' | 'nid' | null>(null);
  const [syncingAccount, setSyncingAccount] = useState(false);

  // Profile Form States
  const [fullName, setFullName] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [phone, setPhone] = useState('');
  const [nidNumber, setNidNumber] = useState('');
  const [nidPhotoUrl, setNidPhotoUrl] = useState('');
  const [professionId, setProfessionId] = useState('');
  const [servicesText, setServicesText] = useState('');
  const [bio, setBio] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [addressPickerOpen, setAddressPickerOpen] = useState(false);

  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [coverPhotoUrl, setCoverPhotoUrl] = useState('');
  const [extraInfo, setExtraInfo] = useState<Record<string, any>>({});

  // Posts State
  const [posts, setPosts] = useState<Post[]>([]);
  const [postContent, setPostContent] = useState('');
  const [postImageFile, setPostImageFile] = useState<File | null>(null);
  const [postImagePreview, setPostImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const postFileInputRef = useRef<HTMLInputElement | null>(null);

  // Password State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPass, setUpdatingPass] = useState(false);

  const isCreatingNewProfile = !profile || !profile.phone || !profile.division_id;

  useEffect(() => {
    fetchProfessions()
      .then((list) => {
        setProfessions(list);
        if (list.length > 0 && !professionId) {
          setProfessionId(list[0].id);
        }
      })
      .catch((err) => {
        console.error('[Account] fetchProfessions error:', err);
      });
  }, []);

  useEffect(() => {
    if (!profile) {
      if (user) {
        const meta = user.user_metadata || {};
        setFullName((prev) => prev || meta.full_name || '');
        setEmailInput(user.email || '');
        setPhone((prev) => prev || meta.phone || '');
      }
      return;
    }

    setFullName(profile.full_name || '');
    setEmailInput(profile.email || user?.email || '');
    setPhone(profile.phone || '');
    setNidNumber(profile.nid_number || '');
    setNidPhotoUrl(profile.nid_photo_url || '');
    setProfessionId(profile.profession_id || (professions[0]?.id ?? ''));
    setServicesText(profile.extra_info?.services || '');
    setBio(profile.bio || '');
    setAddressDetail(profile.address_detail || '');
    setProfilePhotoUrl(profile.profile_photo_url || '');
    setCoverPhotoUrl(profile.cover_photo_url || '');
    setExtraInfo(profile.extra_info || {});

    const loc = resolveLocationNames(
      profile.division_id,
      profile.district_id,
      profile.upazila_id,
      profile.extra_info
    );
    const locText = [loc.upazila_name, loc.district_name, loc.division_name]
      .filter(Boolean)
      .join(', ');
    if (profile.division_id || profile.district_id || locText) {
      setSelectedLocation({
        division_id: profile.division_id || undefined,
        district_id: profile.district_id || undefined,
        upazila_id: profile.upazila_id || undefined,
        division_name: loc.division_name,
        district_name: loc.district_name,
        upazila_name: loc.upazila_name,
        displayText: locText || 'নির্বাচিত এলাকা',
      });
    }

    loadUserPosts(profile.id);
  }, [profile, user?.id, user?.email, professions.length]);

  const loadUserPosts = async (profileId: string) => {
    try {
      const list = await fetchPostsForProfile(profileId);
      setPosts(list);
    } catch (e) {
      console.error('[Account] loadUserPosts error:', e);
    }
  };

  const handleProfileImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'avatar' | 'cover' | 'nid'
  ) => {
    const file = e.target.files?.[0];
    const ownerFolder = profile?.id || user?.id;
    if (!file || !ownerFolder) return;

    if (file.size > 3 * 1024 * 1024) {
      showToast('ফাইলের সাইজ সর্বোচ্চ ৩ মেগাবাইট (3MB) হতে পারবে।', 'error');
      return;
    }

    setUploadingMedia(type);
    try {
      const bucket = type === 'nid' ? 'nid-docs' : 'avatars';
      const uploadedUrl = await uploadProfileMedia(file, bucket, ownerFolder);
      if (type === 'avatar') {
        setProfilePhotoUrl(uploadedUrl);
      } else if (type === 'cover') {
        setCoverPhotoUrl(uploadedUrl);
      } else {
        setNidPhotoUrl(uploadedUrl);
      }
      showToast('ছবি প্রস্তুত হয়েছে। সংরক্ষণ করতে নিচের সেভ বাটনে ক্লিক করুন।', 'info');
    } catch (err: any) {
      console.error('[Account] handleProfileImageUpload error:', err);
      showToast(translateSupabaseError(err, 'ছবি আপলোড করতে সমস্যা হয়েছে।'), 'error');
    } finally {
      setUploadingMedia(null);
    }
  };

  const handleAppendServiceTag = (tag: string) => {
    setServicesText((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return tag;
      if (trimmed.includes(tag)) return trimmed;
      return `${trimmed}, ${tag}`;
    });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user && !profile) return;

    const cleanPhone = toEnglishDigits(phone.trim());
    if (!fullName.trim() || !cleanPhone) {
      showToast('পূর্ণ নাম এবং মোবাইল নম্বর আবশ্যিক।', 'error');
      return;
    }
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      showToast('সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন (যেমন: 01712345678)।', 'error');
      return;
    }
    if (!selectedLocation?.division_id || !selectedLocation?.district_id) {
      showToast('হোম পেজ ও তালিকায় লোকেশন অনুযায়ী প্রদর্শনের জন্য বিভাগ ও জেলা নির্বাচন করুন।', 'error');
      setAddressPickerOpen(true);
      return;
    }

    const finalEmail = (emailInput || profile?.email || user?.email || '').trim().toLowerCase();
    const selectedProfObj = professions.find((p) => String(p.id) === String(professionId));

    setLoading(true);
    try {
      const mergedExtra: Record<string, any> = {
        ...extraInfo,
        services: servicesText.trim(),
        ...(selectedLocation?.division_name ? { _division_name: selectedLocation.division_name } : {}),
        ...(selectedLocation?.district_name ? { _district_name: selectedLocation.district_name } : {}),
        ...(selectedLocation?.upazila_name ? { _upazila_name: selectedLocation.upazila_name } : {}),
        ...(selectedProfObj?.name_bn ? { _profession_name: selectedProfObj.name_bn } : {}),
      };

      const updateData: Record<string, any> = {
        email: finalEmail || null,
        full_name: fullName.trim(),
        phone: cleanPhone,
        nid_number: nidNumber.trim() ? toEnglishDigits(nidNumber.trim()) : null,
        nid_photo_url: nidPhotoUrl || null,
        profession_id: professionId || professions[0]?.id,
        division_id: selectedLocation.division_id,
        district_id: selectedLocation.district_id,
        upazila_id: selectedLocation.upazila_id || null,
        bio: bio.trim(),
        address_detail: addressDetail.trim(),
        profile_photo_url: profilePhotoUrl || null,
        cover_photo_url: coverPhotoUrl || null,
        extra_info: mergedExtra,
      };

      if (user) {
        await saveUserOwnProfile(user, updateData, profile?.id);
      }
      const updated = await refreshProfile();
      if (updated?.status === 'approved') {
        showToast(
          'প্রোফাইল সংরক্ষিত হয়েছে! আপনার নির্বাচিত এলাকা অনুযায়ী হোম পেজ ও পেশাজীবী তালিকায় প্রদর্শিত হচ্ছে।',
          'success'
        );
      } else {
        showToast('প্রোফাইল তথ্য সফলভাবে ডাটাবেসে সংরক্ষিত হয়েছে!', 'success');
      }
    } catch (err: any) {
      console.error('[Account] handleSaveProfile error:', err);
      showToast(translateSupabaseError(err, 'প্রোফাইল সংরক্ষণ ব্যর্থ হয়েছে।'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const clearSelectedPostImage = () => {
    if (postImagePreview && postImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(postImagePreview);
    }
    setPostImageFile(null);
    setPostImagePreview(null);
    if (postFileInputRef.current) {
      postFileInputRef.current.value = '';
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      showToast('পোস্ট করার আগে অনুগ্রহ করে আপনার প্রোফাইল তথ্য সংরক্ষণ করুন।', 'error');
      setActiveTab('profile');
      return;
    }
    if (profile.status !== 'approved') {
      showToast(
        'আপনার প্রোফাইল এখনো অনুমোদিত নয়। পোস্ট করার জন্য অ্যাডমিন অনুমোদনের অপেক্ষা করুন।',
        'error'
      );
      return;
    }
    if (!postContent.trim() && !postImageFile) {
      showToast('পোস্টের বিবরণ লিখুন অথবা একটি ছবি যুক্ত করুন।', 'error');
      return;
    }

    setPosting(true);
    try {
      let imageUrl: string | null = null;
      if (postImageFile) {
        imageUrl = await uploadPostImage(postImageFile, profile.id);
      }

      await createPostInDb({
        profile_id: profile.id,
        content: postContent.trim(),
        image_url: imageUrl,
      });

      setPostContent('');
      clearSelectedPostImage();
      await loadUserPosts(profile.id);
      showToast('পোস্ট সফলভাবে প্রকাশিত হয়েছে!', 'success');
    } catch (err: any) {
      console.error('[Account] handleCreatePost error:', err);
      showToast(translateSupabaseError(err, 'পোস্ট প্রকাশ করতে সমস্যা হয়েছে।'), 'error');
    } finally {
      setPosting(false);
    }
  };

  const confirmDeletePost = async () => {
    if (!deletingPostId) return;
    try {
      await deletePostInDb(deletingPostId);
      if (profile) await loadUserPosts(profile.id);
      showToast('পোস্ট সফলভাবে মুছে ফেলা হয়েছে।', 'success');
    } catch (err: any) {
      console.error('[Account] confirmDeletePost error:', err);
      showToast(translateSupabaseError(err, 'পোস্ট মুছতে সমস্যা হয়েছে।'), 'error');
    } finally {
      setDeletingPostId(null);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      showToast('নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('পাসওয়ার্ড দুটি মিলছে না।', 'error');
      return;
    }

    setUpdatingPass(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('ডাটাবেস সংযোগ কনফিগার করা হয়নি।');
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        console.error('[Account] password update error:', error);
        throw error;
      }
      setNewPassword('');
      setConfirmPassword('');
      showToast('পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!', 'success');
    } catch (err: any) {
      console.error('[Account] handlePasswordChange exception:', err);
      showToast(translateSupabaseError(err, 'পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে।'), 'error');
    } finally {
      setUpdatingPass(false);
    }
  };

  const copyShareLink = async () => {
    if (!profile) return;
    const url = `${window.location.origin}/profile/${profile.id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('প্রোফাইল লিংক কপি করা হয়েছে!', 'success');
    } catch {
      showToast('লিংক কপি করতে সমস্যা হয়েছে।', 'error');
    }
  };

  const handleManualSync = async () => {
    setSyncingAccount(true);
    try {
      await refreshProfile();
      showToast('প্রোফাইল পুনরায় লোড করা হয়েছে।', 'info');
    } catch (err) {
      console.error('[Account] handleManualSync error:', err);
    } finally {
      setSyncingAccount(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-[#0B63E5] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">আপনার অ্যাকাউন্ট লোড হচ্ছে...</p>
      </div>
    );
  }

  if (!user && !profile) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            অনুগ্রহ করে প্রথমে লগইন করুন
          </h2>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#0B63E5] hover:bg-[#084FC7] text-white text-xs font-bold rounded-xl shadow-md transition"
          >
            লগইন পেজে যান
          </Link>
        </div>
      </div>
    );
  }

  const selectedProfObj = professions.find((p) => String(p.id) === String(professionId));
  const selectedProfName = normalizeBn(
    selectedProfObj?.name_bn || profile?.extra_info?._profession_name || ''
  );
  const selectedProfSlug = selectedProfObj?.slug || '';

  const isSurveyor = selectedProfSlug === 'surveyor' || selectedProfName === normalizeBn('সার্ভেয়ার');
  const isDeedWriter = selectedProfSlug === 'deed-writer' || selectedProfName === normalizeBn('দলিল লেখক');
  const isAdvocateOrBarrister =
    selectedProfSlug === 'advocate' ||
    selectedProfSlug === 'barrister' ||
    selectedProfName === normalizeBn('এডভোকেট') ||
    selectedProfName === normalizeBn('ব্যারিস্টার');
  const isCommissioner =
    selectedProfSlug === 'civil-court-commissioner' ||
    selectedProfName === normalizeBn('সিভিল কোর্ট কমিশনার');

  const livePreviewProfile: PublicProfile = {
    id: profile?.id || user?.id || 'preview',
    auth_user_id: user?.id || profile?.auth_user_id || null,
    user_serial: profile?.user_serial || 1,
    full_name: fullName.trim() || 'আপনার পূর্ণ নাম',
    email: emailInput || user?.email || null,
    phone: toEnglishDigits(phone.trim()) || '017XXXXXXXX',
    profession_id: professionId || '',
    profession_name: selectedProfObj?.name_bn || 'সার্ভেয়ার',
    division_id: selectedLocation?.division_id || '',
    division_name: selectedLocation?.division_name || '',
    district_id: selectedLocation?.district_id || '',
    district_name: selectedLocation?.district_name || '',
    upazila_id: selectedLocation?.upazila_id || '',
    upazila_name: selectedLocation?.upazila_name || '',
    address_detail: addressDetail || 'এলাকা নির্বাচন করুন',
    profile_photo_url: profilePhotoUrl || null,
    cover_photo_url: coverPhotoUrl || null,
    bio: bio || 'আপনার সেবা ও অভিজ্ঞতার বিবরণ এখানে দেখাবে...',
    extra_info: {
      ...extraInfo,
      services: servicesText.trim(),
    },
    role: profile?.role || 'user',
    status: profile?.status || 'approved',
    is_verified: Boolean(profile?.is_verified),
    created_at: profile?.created_at || new Date().toISOString(),
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Onboarding / Status Callout for New or Restricted Users */}
      {isCreatingNewProfile && (
        <div className="bg-[#EFF6FF] dark:bg-blue-950/50 text-[#0F2942] dark:text-white rounded-2xl p-6 sm:p-7 border border-[#BFDBFE] dark:border-blue-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-blue-900/60 border border-[#BFDBFE] dark:border-blue-700 text-[#0B63E5] dark:text-blue-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>পেশাজীবী প্রোফাইল তৈরি করুন</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black font-siliguri text-[#0F2942] dark:text-white">
              নিচের ফর্মে আপনার প্রোফাইল ও লোকেশন যুক্ত করুন
            </h2>
            <p className="text-xs sm:text-sm text-[#334155] dark:text-slate-300 leading-relaxed max-w-2xl">
              নাম, মোবাইল, পেশা, ছবি, সেবা সমূহ এবং বিভাগ-জেলা নির্বাচন করে সংরক্ষণ করলেই আপনার প্রোফাইল কার্ডটি সরাসরি <strong>হোম পেজ</strong> ও <strong>পেশাজীবী তালিকায়</strong> আপনার এলাকা অনুযায়ী প্রদর্শিত হবে।
            </p>
          </div>
          <button
            type="button"
            onClick={handleManualSync}
            disabled={syncingAccount}
            className="px-4 py-2.5 bg-[#0B63E5] hover:bg-[#084FC7] text-white text-xs font-bold rounded-xl flex items-center gap-2 shrink-0 cursor-pointer transition shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${syncingAccount ? 'animate-spin' : ''}`} />
            <span>সিঙ্ক করুন</span>
          </button>
        </div>
      )}

      {profile && ['suspended', 'rejected'].includes(profile.status) && (
        <div className="p-5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-start gap-3 text-rose-800 dark:text-rose-200 text-xs sm:text-sm font-semibold">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            আপনার প্রোফাইলটি বর্তমানে অ্যাডমিন কর্তৃক স্থগিত ({profile.status}) অবস্থায় রয়েছে। তাই এটি সাময়িকভাবে পাবলিক তালিকায় লুকানো আছে। তথ্য সংশোধন করে অ্যাডমিনের সাথে যোগাযোগ করুন।
          </div>
        </div>
      )}

      {/* Top Account Summary Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            {profilePhotoUrl ? (
              <img
                src={profilePhotoUrl}
                alt={fullName || 'User'}
                referrerPolicy="no-referrer"
                className="w-20 h-20 rounded-full object-cover border-2 border-[#0B63E5] shadow-md"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[#0B63E5] text-white font-black text-2xl flex items-center justify-center shadow-md">
                {(fullName || user?.email || 'উ').charAt(0).toUpperCase()}
              </div>
            )}
            <span className="absolute -bottom-1.5 -right-1.5 bg-slate-900 text-blue-300 border border-blue-400/40 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shadow">
              #{String(profile?.user_serial || 1).padStart(5, '0')}
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white font-siliguri">
                {fullName || 'নতুন পেশাজীবী প্রোফাইল'}
              </h1>
              {profile?.is_verified && (
                <span
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#15803D] dark:text-emerald-400"
                  title="অ্যাডমিন যাচাইকৃত প্রোফাইল"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>অ্যাডমিন যাচাইকৃত</span>
                </span>
              )}
            </div>
            <p className="text-xs text-[#0B63E5] dark:text-blue-400 font-bold">
              {selectedProfObj?.name_bn || 'পেশাজীবী'} • {emailInput || user?.email || 'ই-মেইল সংযুক্ত নেই'}
            </p>
            {selectedLocation?.displayText && selectedLocation.displayText !== 'সকল বাংলাদেশ' && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#0B63E5] shrink-0" />
                <span>এলাকা: {selectedLocation.displayText}</span>
              </p>
            )}

            {/* Status Badge */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {!profile ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#EFF6FF] dark:bg-blue-950/60 text-[#0B63E5] dark:text-blue-300 rounded-full text-xs font-bold border border-[#BFDBFE] dark:border-[#0B63E5]">
                  <Sparkles className="w-3.5 h-3.5" />
                  প্রোফাইল তৈরি করুন
                </span>
              ) : (
                <>
                  {profile.status === 'approved' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#E6F7ED] dark:bg-emerald-950/60 text-[#15803D] dark:text-emerald-300 rounded-full text-xs font-bold border border-[#BBF7D0] dark:border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      ডিরেক্টরিতে প্রকাশিত ও সক্রিয়
                    </span>
                  )}
                  {profile.status === 'pending' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded-full text-xs font-bold border border-amber-200 dark:border-amber-800">
                      <Clock className="w-3.5 h-3.5" />
                      অনুমোদনের অপেক্ষায় (Pending)
                    </span>
                  )}
                  {['rejected', 'suspended'].includes(profile.status) && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 rounded-full text-xs font-bold border border-red-200 dark:border-red-800">
                      <AlertCircle className="w-3.5 h-3.5" />
                      অ্যাডমিন কর্তৃক স্থগিত
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Public View & Share Buttons */}
        {profile && (
          <div className="flex flex-wrap items-center gap-3">
            {profile.status === 'approved' && (
              <Link
                to={`/profile/${profile.id}`}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 transition"
              >
                <Eye className="w-4 h-4 text-[#0B63E5]" />
                পাবলিক প্রোফাইল দেখুন
              </Link>
            )}
            <button
              type="button"
              onClick={copyShareLink}
              className="px-4 py-2.5 bg-[#0B63E5] hover:bg-[#084FC7] text-white text-xs font-bold rounded-xl flex items-center gap-2 transition shadow-md shadow-blue-600/15 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              শেয়ার লিংক কপি করুন
            </button>
          </div>
        )}
      </div>

      {/* Tabs Header */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`px-5 py-3 font-bold text-sm rounded-t-2xl flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'profile'
              ? 'bg-white dark:bg-slate-900 text-[#0B63E5] border-t-2 border-[#0B63E5] shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <User className="w-4 h-4" />
          <span>{profile ? 'আমার প্রোফাইল ও এডিট' : 'নতুন প্রোফাইল তৈরি করুন'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('posts')}
          className={`px-5 py-3 font-bold text-sm rounded-t-2xl flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'posts'
              ? 'bg-white dark:bg-slate-900 text-[#0B63E5] border-t-2 border-[#0B63E5] shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>আমার পোস্ট ({posts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('password')}
          className={`px-5 py-3 font-bold text-sm rounded-t-2xl flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'password'
              ? 'bg-white dark:bg-slate-900 text-[#0B63E5] border-t-2 border-[#0B63E5] shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>পাসওয়ার্ড পরিবর্তন</span>
        </button>
      </div>

      {/* TAB 1: PROFILE CREATE / EDIT + LIVE CARD PREVIEW */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Main Form (2 cols) */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {profile ? 'পেশাজীবী প্রোফাইল তথ্য এডিট করুন' : 'আপনার পেশাজীবী প্রোফাইল তৈরি করুন'}
              </h3>
              <span className="text-[11px] font-semibold text-[#0B63E5] dark:text-blue-400">
                ডানপাশে লাইভ প্রিভিউ দেখুন →
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  পূর্ণ নাম *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="যেমন: MUHAMMED NAZMUL HUDA"
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ই-মেইল ঠিকানা
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  readOnly={Boolean(user?.email)}
                  placeholder="example@gmail.com"
                  className={`w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium ${
                    user?.email
                      ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-500 cursor-not-allowed'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  মোবাইল নম্বর (১১ সংখ্যা) *
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
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  পেশা নির্বাচন করুন *
                </label>
                <select
                  value={professionId}
                  onChange={(e) => setProfessionId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-[#0B63E5] dark:text-blue-400"
                >
                  {professions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name_bn}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Location Picker (Required for Home & Listing location display) */}
            <div className="p-4 sm:p-5 bg-[#EFF6FF]/60 dark:bg-blue-950/20 rounded-2xl border border-[#BFDBFE] dark:border-blue-800/60 space-y-3">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                আপনার কর্মক্ষেত্রের এলাকা নির্বাচন করুন (বিভাগ → জেলা → উপজেলা) *
              </label>
              <button
                type="button"
                onClick={() => setAddressPickerOpen(true)}
                className="w-full py-3.5 px-4 bg-white dark:bg-slate-800 border border-[#BFDBFE] dark:border-blue-700 rounded-xl flex items-center justify-between text-xs sm:text-sm font-bold text-[#0F2942] dark:text-blue-200 hover:bg-[#EFF6FF] dark:hover:bg-slate-700 transition cursor-pointer shadow-xs"
              >
                <span className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#0B63E5] shrink-0" />
                  <span>
                    {selectedLocation?.displayText || 'এখানে ক্লিক করে বিভাগ, জেলা ও উপজেলা বাছাই করুন *'}
                  </span>
                </span>
                <span className="text-[#0B63E5] dark:text-blue-400 underline shrink-0 ml-2">
                  পরিবর্তন
                </span>
              </button>

              <input
                type="text"
                value={addressDetail}
                onChange={(e) => setAddressDetail(e.target.value)}
                placeholder="বিস্তারিত চেম্বার / অফিস ঠিকানা (যেমন: কোর্ট রোড, চেম্বার নং ১২)"
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium"
              />
            </div>

            {/* Services (সেবা সমূহ - Shown directly on ProfileCard like the reference screenshot) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  সেবা সমূহ (কার্ডে সরাসরি প্রদর্শিত হবে)
                </label>
                <span className="text-[11px] text-slate-400">এক ক্লিকে ট্যাগ যোগ করুন</span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {QUICK_SERVICE_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleAppendServiceTag(tag)}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-[#EFF6FF] dark:hover:bg-blue-950/50 text-slate-700 dark:text-slate-300 hover:text-[#0B63E5] dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                  >
                    + {tag}
                  </button>
                ))}
              </div>

              <textarea
                rows={2}
                value={servicesText}
                onChange={(e) => setServicesText(e.target.value)}
                maxLength={300}
                placeholder="যেমন: 👉 বিল্ডিং প্লানিং, 👉 স্ট্রাকচারাল ডিজাইন, 👉 আর্কিটেকচারাল ডিজাইন, 👉 ডিজিটাল সার্ভে..."
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium"
              />
            </div>

            {/* Photo Uploads + URL Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  প্রোফাইল ছবি (গোল অবতার)
                </label>
                <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#EFF6FF] dark:bg-blue-950/40 hover:bg-[#DBEAFE] dark:hover:bg-blue-900/50 border border-[#BFDBFE] dark:border-blue-800 text-[#0F2942] dark:text-blue-300 text-xs font-bold rounded-xl cursor-pointer transition w-full justify-center">
                  <Upload className="w-4 h-4" />
                  <span>
                    {uploadingMedia === 'avatar' ? 'আপলোড হচ্ছে...' : 'গ্যালারি থেকে প্রোফাইল ছবি নিন'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleProfileImageUpload(e, 'avatar')}
                    className="hidden"
                  />
                </label>
                <input
                  type="text"
                  value={profilePhotoUrl}
                  onChange={(e) => setProfilePhotoUrl(e.target.value)}
                  placeholder="অথবা ছবির লিংক দিন (https://...)"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  কভার ব্যানার ছবি (ঐচ্ছিক)
                </label>
                <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer transition w-full justify-center">
                  <Upload className="w-4 h-4" />
                  <span>
                    {uploadingMedia === 'cover' ? 'আপলোড হচ্ছে...' : 'গ্যালারি থেকে কভার ছবি নিন'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleProfileImageUpload(e, 'cover')}
                    className="hidden"
                  />
                </label>
                <input
                  type="text"
                  value={coverPhotoUrl}
                  onChange={(e) => setCoverPhotoUrl(e.target.value)}
                  placeholder="অথবা কভার ছবির লিংক দিন (https://...)"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                />
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                বিস্তারিত পরিচিতি / বায়ো (সর্বোচ্চ ৫০০ অক্ষর)
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                placeholder="আপনার কাজের অভিজ্ঞতা, দক্ষতা ও পেশাগত পরিচিতি সম্পর্কে লিখুন..."
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium"
              ></textarea>
            </div>

            {/* Profession-specific ID / License / Experience Fields */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
              <h4 className="text-xs font-bold text-[#0B63E5] dark:text-blue-400 uppercase tracking-wider">
                পেশাগত লাইসেন্স / সনদ ও অভিজ্ঞতার তথ্য
              </h4>

              {isSurveyor && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      সনদ / লাইসেন্স নম্বর
                    </label>
                    <input
                      type="text"
                      value={extraInfo.license_no || ''}
                      onChange={(e) => setExtraInfo({ ...extraInfo, license_no: e.target.value })}
                      placeholder="যেমন: SRV-2045"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      সনদ প্রাপ্তির সাল
                    </label>
                    <input
                      type="text"
                      value={extraInfo.cert_year || ''}
                      onChange={(e) => setExtraInfo({ ...extraInfo, cert_year: e.target.value })}
                      placeholder="যেমন: ২০১৬"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      সনদ প্রদানকারী প্রতিষ্ঠান
                    </label>
                    <input
                      type="text"
                      value={extraInfo.cert_issuer || ''}
                      onChange={(e) => setExtraInfo({ ...extraInfo, cert_issuer: e.target.value })}
                      placeholder="যেমন: বাংলাদেশ কারিগরি শিক্ষা বোর্ড"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      অভিজ্ঞতা (বছর)
                    </label>
                    <input
                      type="text"
                      value={extraInfo.experience_years || ''}
                      onChange={(e) => setExtraInfo({ ...extraInfo, experience_years: e.target.value })}
                      placeholder="যেমন: ৮ বছর"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>
                </div>
              )}

              {isDeedWriter && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      দলিল লেখক লাইসেন্স নম্বর
                    </label>
                    <input
                      type="text"
                      value={extraInfo.license_no || ''}
                      onChange={(e) => setExtraInfo({ ...extraInfo, license_no: e.target.value })}
                      placeholder="যেমন: DW-4451"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      সাব-রেজিস্ট্রি অফিস
                    </label>
                    <input
                      type="text"
                      value={extraInfo.sub_registry_office || ''}
                      onChange={(e) => setExtraInfo({ ...extraInfo, sub_registry_office: e.target.value })}
                      placeholder="যেমন: সদর সাব-রেজিস্ট্রি অফিস"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>
                </div>
              )}

              {isAdvocateOrBarrister && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      বার কাউন্সিল সনদ নম্বর
                    </label>
                    <input
                      type="text"
                      value={extraInfo.bar_council_no || ''}
                      onChange={(e) => setExtraInfo({ ...extraInfo, bar_council_no: e.target.value })}
                      placeholder="যেমন: BC-98421"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      কোর্ট / আদালত
                    </label>
                    <input
                      type="text"
                      value={extraInfo.court || ''}
                      onChange={(e) => setExtraInfo({ ...extraInfo, court: e.target.value })}
                      placeholder="যেমন: জজ কোর্ট, ঢাকা"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      বিশেষজ্ঞতার ক্ষেত্র
                    </label>
                    <input
                      type="text"
                      value={extraInfo.specialization || ''}
                      onChange={(e) => setExtraInfo({ ...extraInfo, specialization: e.target.value })}
                      placeholder="যেমন: ভূমি ও দেওয়ানি মামলা"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      অভিজ্ঞতা (বছর)
                    </label>
                    <input
                      type="text"
                      value={extraInfo.experience_years || ''}
                      onChange={(e) => setExtraInfo({ ...extraInfo, experience_years: e.target.value })}
                      placeholder="যেমন: ১০ বছর"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>
                </div>
              )}

              {isCommissioner && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      সনদ / নিয়োগ নম্বর
                    </label>
                    <input
                      type="text"
                      value={extraInfo.license_no || ''}
                      onChange={(e) => setExtraInfo({ ...extraInfo, license_no: e.target.value })}
                      placeholder="যেমন: CCC-312"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      কোর্ট / জেলা
                    </label>
                    <input
                      type="text"
                      value={extraInfo.court || ''}
                      onChange={(e) => setExtraInfo({ ...extraInfo, court: e.target.value })}
                      placeholder="যেমন: জেলা জজ আদালত"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>
                </div>
              )}

              {!isSurveyor && !isDeedWriter && !isAdvocateOrBarrister && !isCommissioner && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      লাইসেন্স / রেজিস্ট্রেশন নম্বর (থাকলে)
                    </label>
                    <input
                      type="text"
                      value={extraInfo.license_no || ''}
                      onChange={(e) => setExtraInfo({ ...extraInfo, license_no: e.target.value })}
                      placeholder="আইডি বা লাইসেন্স নম্বর"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      অভিজ্ঞতা (বছর)
                    </label>
                    <input
                      type="text"
                      value={extraInfo.experience_years || ''}
                      onChange={(e) => setExtraInfo({ ...extraInfo, experience_years: e.target.value })}
                      placeholder="যেমন: ৫ বছর"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* NID Verification Section (For Admin Verified Badge) */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#0B63E5]" />
                  <span>অ্যাডমিন যাচাইকরণ তথ্য (NID — গোপনীয়, শুধুমাত্র অ্যাডমিন দেখবেন)</span>
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <input
                  type="text"
                  value={nidNumber}
                  onChange={(e) => setNidNumber(e.target.value)}
                  placeholder="১০, ১৩ বা ১৭ সংখ্যার NID নম্বর (ঐচ্ছিক)"
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-medium"
                />
                <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer transition justify-center">
                  <Upload className="w-4 h-4 text-[#0B63E5]" />
                  <span>
                    {uploadingMedia === 'nid'
                      ? 'আপলোড হচ্ছে...'
                      : nidPhotoUrl
                      ? '✓ NID ডকুমেন্ট সংযুক্ত (পরিবর্তন করুন)'
                      : 'NID ছবি যুক্ত করুন (ঐচ্ছিক)'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleProfileImageUpload(e, 'nid')}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || Boolean(uploadingMedia)}
              className="w-full py-3.5 bg-[#0B63E5] hover:bg-[#084FC7] text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/15 transition cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>
                    {isCreatingNewProfile
                      ? 'প্রোফাইল তৈরি ও ডিরেক্টরিতে প্রকাশ করুন'
                      : 'প্রোফাইল পরিবর্তন সংরক্ষণ করুন'}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Exact Live Card Preview (1 col, sticky) */}
          <div className="space-y-4 lg:sticky lg:top-24">
            <div className="bg-white dark:bg-slate-900 text-[#0F2942] dark:text-white p-5 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B63E5] dark:text-blue-400">
                  লাইভ প্রোফাইল কার্ড প্রিভিউ
                </h4>
                <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#EFF6FF] dark:bg-blue-950/60 text-[#0B63E5] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-800">
                  হোম ও তালিকা ভিউ
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                সংরক্ষণ করার পর আপনার প্রোফাইলটি <strong>হোম পেজ</strong> এবং <strong>পেশাজীবী তালিকা</strong> পেজে ঠিক এভাবে প্রদর্শিত হবে:
              </p>

              <ProfileCard profile={livePreviewProfile} isPreview={true} />

              {!profile?.is_verified && (
                <p className="text-[11px] text-slate-600 dark:text-slate-300 bg-[#F8FAFC] dark:bg-slate-800/80 p-3 rounded-xl border border-[#E2E8F0] dark:border-slate-700/70 leading-relaxed">
                  💡 অ্যাডমিন আপনার প্রোফাইল যাচাই করলে কার্ডে সবুজ <strong>“অ্যাডমিন যাচাইকৃত প্রোফাইল”</strong> ব্যাজ যুক্ত হবে।
                </p>
              )}
            </div>
          </div>

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
        </form>
      )}

      {/* TAB 2: MY POSTS */}
      {activeTab === 'posts' && (
        <div className="space-y-8">
          {!profile ? (
            <div className="p-6 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-amber-800 dark:text-amber-200 text-sm font-semibold text-center">
              পোস্ট করার আগে প্রথমে <strong>“নতুন প্রোফাইল তৈরি করুন”</strong> ট্যাব থেকে আপনার প্রোফাইল সংরক্ষণ করুন।
            </div>
          ) : profile.status !== 'approved' ? (
            <div className="p-6 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-amber-800 dark:text-amber-200 text-sm font-semibold text-center">
              আপনার প্রোফাইলটি বর্তমানে <strong>{profile.status}</strong> অবস্থায় আছে। শুধুমাত্র অনুমোদিত (Approved) প্রফেশনালরাই নতুন পোস্ট করতে পারেন।
            </div>
          ) : (
            <form
              onSubmit={handleCreatePost}
              className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-4"
            >
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-[#0B63E5]" />
                <span>নতুন পোস্ট লিখুন</span>
              </h3>

              <textarea
                rows={3}
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder="আপনার পেশাগত মতামত বা পরামর্শ লিখুন..."
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium"
              ></textarea>

              {postImagePreview && (
                <div className="relative inline-block rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 max-w-xs">
                  <img src={postImagePreview} alt="Preview" className="max-h-48 w-auto object-cover block" />
                  <button
                    type="button"
                    onClick={clearSelectedPostImage}
                    className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg transition cursor-pointer"
                    title="ছবি সরান"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition">
                    <ImageIcon className="w-4 h-4 text-[#0B63E5]" />
                    <span>{postImageFile ? 'ছবি পরিবর্তন করুন' : 'ছবি যুক্ত করুন'}</span>
                    <input
                      ref={postFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (!f.type.startsWith('image/')) {
                          showToast('অনুগ্রহ করে একটি বৈধ ছবি ফাইল নির্বাচন করুন।', 'error');
                          e.target.value = '';
                          return;
                        }
                        if (f.size > 5 * 1024 * 1024) {
                          showToast('ছবির সাইজ সর্বোচ্চ ৫ মেগাবাইট (5MB) হতে পারবে।', 'error');
                          e.target.value = '';
                          return;
                        }
                        if (postImagePreview && postImagePreview.startsWith('blob:')) {
                          URL.revokeObjectURL(postImagePreview);
                        }
                        setPostImageFile(f);
                        setPostImagePreview(URL.createObjectURL(f));
                      }}
                      className="hidden"
                    />
                  </label>
                  {postImagePreview && (
                    <span className="text-xs text-[#0B63E5] font-bold">✓ ছবি নির্বাচিত হয়েছে</span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={posting}
                  className="w-full sm:w-auto px-6 py-2.5 bg-[#0B63E5] hover:bg-[#084FC7] text-white font-bold text-xs rounded-xl transition shadow-md shadow-blue-600/15 cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  {posting && (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  )}
                  <span>{posting ? 'পোস্ট হচ্ছে...' : 'পোস্ট প্রকাশ করুন'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Posts List */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">আপনার পোস্টসমূহ</h3>

            {posts.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-500">
                কোনো পোস্ট পাওয়া যায়নি।
              </div>
            ) : (
              posts.map((post) => (
                <div
                  key={post.id}
                  className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      {post.created_at
                        ? new Date(post.created_at).toLocaleDateString('bn-BD')
                        : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDeletingPostId(post.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition cursor-pointer"
                      title="মুছে ফেলুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {post.content && (
                    <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {post.content}
                    </p>
                  )}

                  {post.image_url && (
                    <div className="rounded-xl overflow-hidden max-h-80 border border-slate-200 dark:border-slate-800">
                      <img
                        src={post.image_url}
                        alt="Post Attachment"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PASSWORD CHANGE */}
      {activeTab === 'password' && (
        <form
          onSubmit={handlePasswordChange}
          className="max-w-xl mx-auto bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-6"
        >
          <h3 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
            পাসওয়ার্ড পরিবর্তন করুন
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              নতুন পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর) *
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              নতুন পাসওয়ার্ড নিশ্চিত করুন *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={updatingPass}
            className="w-full py-3.5 bg-[#0B63E5] hover:bg-[#084FC7] text-white font-bold text-sm rounded-xl transition shadow-lg shadow-blue-600/15 cursor-pointer disabled:opacity-60"
          >
            {updatingPass ? 'পরিবর্তন হচ্ছে...' : 'পাসওয়ার্ড পরিবর্তন করুন'}
          </button>
        </form>
      )}

      {/* Post Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingPostId)}
        title="পোস্ট মুছে ফেলুন"
        message="আপনি কি নিশ্চিতভাবে এই পোস্টটি মুছে ফেলতে চান?"
        confirmText="হ্যাঁ, মুছে ফেলুন"
        cancelText="বাতিল"
        isDanger={true}
        onConfirm={confirmDeletePost}
        onClose={() => setDeletingPostId(null)}
      />
    </div>
  );
};
