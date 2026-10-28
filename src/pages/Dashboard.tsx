import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Edit,
  Eye,
  Briefcase,
  RefreshCw,
  ShieldCheck,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import {
  adminFetchAllProfiles,
  adminUpdateProfileStatus,
  adminToggleVerified,
  adminDeleteProfile,
  adminCreatePost,
  adminGetSignedNidUrl,
  uploadPostImage,
  fetchAllPostsForAdmin,
  toggleHidePostInDb,
  deletePostInDb,
  fetchProfessions,
  fetchDivisions,
  fetchSiteSettings,
  updateSiteSettingsInDb,
  resolveLocationNames,
  toEnglishDigits,
  normalizeBn,
  translateSupabaseError,
} from '../lib/supabase';
import type { Profile, Post, Profession, Division, ProfileStatus, SiteSettings } from '../types/database';

export const Dashboard: React.FC = () => {
  const { profile: currentUserProfile } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'posts' | 'professions' | 'settings'>('overview');

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters for User Management
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [professionFilter, setProfessionFilter] = useState('all');
  const [divisionFilter, setDivisionFilter] = useState('all');

  // Admin Create Post Form State
  const [selectedPostProfileId, setSelectedPostProfileId] = useState('');
  const [adminPostContent, setAdminPostContent] = useState('');
  const [adminPostImageFile, setAdminPostImageFile] = useState<File | null>(null);
  const [adminPostImagePreview, setAdminPostImagePreview] = useState<string | null>(null);
  const [adminPostImageUrlInput, setAdminPostImageUrlInput] = useState('');
  const [creatingAdminPost, setCreatingAdminPost] = useState(false);
  const adminPostFileInputRef = useRef<HTMLInputElement | null>(null);

  // NID Modal State
  const [nidPreviewUrl, setNidPreviewUrl] = useState<string | null>(null);
  const [nidModalUser, setNidModalUser] = useState<Profile | null>(null);

  // Delete confirmation modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingType, setDeletingType] = useState<'profile' | 'post'>('profile');

  // Settings form state
  const [settingsForm, setSettingsForm] = useState<SiteSettings>({
    site_name: 'জমি৩৬০',
    site_name_en: 'Jomi360',
    hero_title: '',
    video_url: '',
    footer_about: '',
    owner_name: '',
    owner_designation: '',
    contact_email: '',
    contact_phone: '',
    contact_address: '',
  });

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [profsData, postsData, profsList, divsList, settingsData] = await Promise.all([
        adminFetchAllProfiles(),
        fetchAllPostsForAdmin(),
        fetchProfessions(),
        fetchDivisions(),
        fetchSiteSettings(),
      ]);
      setProfiles(profsData);
      setPosts(postsData);
      setProfessions(profsList);
      setDivisions(divsList);
      if (settingsData) {
        setSettingsForm(settingsData);
      }
    } catch (err: any) {
      console.error('[Dashboard] loadData error:', err);
      const friendly = translateSupabaseError(err, 'ড্যাশবোর্ড ডেটা লোড করতে সমস্যা হয়েছে।');
      setLoadError(friendly);
      showToast(friendly, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handlers for profiles
  const handleStatusChange = async (profileId: string, status: ProfileStatus) => {
    try {
      await adminUpdateProfileStatus(profileId, status);
      await loadData();
      showToast(`প্রোফাইলের স্ট্যাটাস '${status}'-এ আপডেট করা হয়েছে।`, 'success');
    } catch (err: any) {
      console.error('[Dashboard] handleStatusChange error:', err);
      showToast(translateSupabaseError(err, 'স্ট্যাটাস আপডেট ব্যর্থ হয়েছে।'), 'error');
    }
  };

  const handleToggleVerified = async (profileId: string, current: boolean) => {
    try {
      await adminToggleVerified(profileId, !current);
      await loadData();
      showToast(!current ? 'অ্যাডমিন যাচাইকৃত ব্যাজ প্রদান করা হয়েছে।' : 'ভেরিফাইড ব্যাজ সরানো হয়েছে।', 'success');
    } catch (err: any) {
      console.error('[Dashboard] handleToggleVerified error:', err);
      showToast(translateSupabaseError(err, 'ভেরিফিকেশন আপডেট ব্যর্থ হয়েছে।'), 'error');
    }
  };

  const handleViewNid = async (p: Profile) => {
    setNidModalUser(p);
    if (p.nid_photo_url) {
      const signed = await adminGetSignedNidUrl(p.nid_photo_url);
      setNidPreviewUrl(signed);
    } else {
      setNidPreviewUrl(null);
    }
  };

  const confirmDelete = (id: string, type: 'profile' | 'post') => {
    setDeletingId(id);
    setDeletingType(type);
    setDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (!deletingId) return;
    try {
      if (deletingType === 'profile') {
        if (deletingId === currentUserProfile?.id) {
          showToast('আপনি নিজের অ্যাকাউন্ট এই প্যানেল থেকে ডিলিট করতে পারবেন না।', 'error');
          setDeleteModalOpen(false);
          return;
        }
        await adminDeleteProfile(deletingId);
        showToast('প্রোফাইল সফলভাবে মুছে ফেলা হয়েছে।', 'success');
      } else {
        await deletePostInDb(deletingId);
        showToast('পোস্ট সফলভাবে মুছে ফেলা হয়েছে।', 'success');
      }
      await loadData();
    } catch (err: any) {
      console.error('[Dashboard] executeDelete error:', err);
      showToast(translateSupabaseError(err, 'মুছে ফেলতে সমস্যা হয়েছে।'), 'error');
    } finally {
      setDeleteModalOpen(false);
      setDeletingId(null);
    }
  };

  const handleAdminPostImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('অনুগ্রহ করে একটি বৈধ ছবি ফাইল (JPG, PNG, WEBP) নির্বাচন করুন।', 'error');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('ছবির সাইজ সর্বোচ্চ ৫ মেগাবাইট (5MB) হতে পারবে।', 'error');
      e.target.value = '';
      return;
    }

    if (adminPostImagePreview && adminPostImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(adminPostImagePreview);
    }

    setAdminPostImageFile(file);
    setAdminPostImagePreview(URL.createObjectURL(file));
    setAdminPostImageUrlInput('');
  };

  const clearAdminPostImage = () => {
    if (adminPostImagePreview && adminPostImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(adminPostImagePreview);
    }
    setAdminPostImageFile(null);
    setAdminPostImagePreview(null);
    setAdminPostImageUrlInput('');
    if (adminPostFileInputRef.current) {
      adminPostFileInputRef.current.value = '';
    }
  };

  const handleAdminCreatePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPostProfileId) {
      showToast('অনুগ্রহ করে একজন প্রফেশনাল নির্বাচন করুন!', 'error');
      return;
    }
    if (!adminPostContent.trim() && !adminPostImageFile && !adminPostImageUrlInput.trim()) {
      showToast('পোস্টের কন্টেন্ট লিখুন অথবা একটি ছবি যুক্ত করুন!', 'error');
      return;
    }

    setCreatingAdminPost(true);
    try {
      let uploadedImageUrl: string | null = null;
      if (adminPostImageFile) {
        uploadedImageUrl = await uploadPostImage(adminPostImageFile, selectedPostProfileId);
      } else if (adminPostImageUrlInput.trim()) {
        uploadedImageUrl = adminPostImageUrlInput.trim();
      }

      await adminCreatePost({
        profile_id: selectedPostProfileId,
        content: adminPostContent.trim(),
        image_url: uploadedImageUrl,
      });

      setAdminPostContent('');
      setSelectedPostProfileId('');
      clearAdminPostImage();
      showToast('পোস্ট সফলভাবে তৈরি হয়েছে!', 'success');
      await loadData();
    } catch (err: any) {
      console.error('[Dashboard] handleAdminCreatePostSubmit error:', err);
      showToast(translateSupabaseError(err, 'পোস্ট তৈরি করতে সমস্যা হয়েছে।'), 'error');
    } finally {
      setCreatingAdminPost(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSiteSettingsInDb(settingsForm);
      showToast('সাইট সেটিংস সফলভাবে সংরক্ষিত হয়েছে!', 'success');
      await loadData();
    } catch (err: any) {
      console.error('[Dashboard] handleSaveSettings error:', err);
      showToast(translateSupabaseError(err, 'সেটিংস সংরক্ষণ ব্যর্থ হয়েছে।'), 'error');
    }
  };

  // Filter profiles for User Management (supports Bangla & English digits + Unicode normalization + Location)
  const filteredProfiles = profiles.filter((p) => {
    const loc = resolveLocationNames(
      p.division_id,
      p.district_id,
      p.upazila_id,
      p.extra_info
    );
    const areaFull = [loc.upazila_name, loc.district_name, loc.division_name]
      .filter(Boolean)
      .join(' ');

    const qRaw = searchQuery.trim();
    let matchesSearch = true;
    if (qRaw) {
      const qLower = qRaw.toLowerCase();
      const qNorm = normalizeBn(qRaw).toLowerCase();
      const qEn = toEnglishDigits(qRaw).replace(/^#/, '').toLowerCase();
      const serialPadded = String(p.user_serial || 1).padStart(5, '0');

      matchesSearch =
        (p.full_name || '').toLowerCase().includes(qLower) ||
        normalizeBn(p.full_name || '').toLowerCase().includes(qNorm) ||
        toEnglishDigits(p.phone || '').includes(qEn) ||
        Boolean(p.email && p.email.toLowerCase().includes(qLower)) ||
        String(p.user_serial || '').includes(qEn) ||
        serialPadded.includes(qEn) ||
        toEnglishDigits(p.nid_number || '').includes(qEn) ||
        normalizeBn(areaFull).toLowerCase().includes(qNorm);
    }

    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;

    let matchesProf = true;
    if (professionFilter !== 'all') {
      const selectedProf = professions.find((pr) => String(pr.id) === String(professionFilter));
      const profNameNorm = normalizeBn(selectedProf?.name_bn || '');
      const rowProfNorm = normalizeBn(p.extra_info?._profession_name || '');
      matchesProf =
        String(p.profession_id) === String(professionFilter) ||
        (Boolean(profNameNorm) && rowProfNorm === profNameNorm);
    }

    let matchesDivision = true;
    if (divisionFilter !== 'all') {
      const selectedDiv = divisions.find((dv) => String(dv.id) === String(divisionFilter));
      const divNameNorm = normalizeBn(selectedDiv?.name_bn || '');
      const rowDivNorm = normalizeBn(loc.division_name || '');
      matchesDivision =
        String(p.division_id) === String(divisionFilter) ||
        (Boolean(divNameNorm) && rowDivNorm === divNameNorm);
    }

    return matchesSearch && matchesStatus && matchesProf && matchesDivision;
  });

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-[#0B63E5] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 font-siliguri">
          অ্যাডমিন ড্যাশবোর্ড লোড হচ্ছে...
        </p>
      </div>
    );
  }

  // Stats calculation
  const totalUsers = profiles.length;
  const pendingUsers = profiles.filter((p) => p.status === 'pending').length;
  const approvedUsers = profiles.filter((p) => p.status === 'approved').length;
  const totalPosts = posts.length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 text-[#0F2942] dark:text-white rounded-2xl p-6 sm:p-8 border border-[#E2E8F0] dark:border-slate-800 shadow-[0_2px_12px_rgba(15,41,66,0.05)] flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-[#0B63E5] flex items-center justify-center text-white shadow-md shadow-blue-600/20">
            <LayoutDashboard className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black font-siliguri text-[#0F2942] dark:text-white">অ্যাডমিন কন্ট্রোল প্যানেল</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">জমি৩৬০ ডিরেক্টরি ম্যানেজমেন্ট ও মডারেশন</p>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <Link
            to="/dashboard/profiles/new"
            className="px-5 py-3 bg-[#0B63E5] hover:bg-[#084FC7] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm shadow-blue-600/15 transition"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন প্রফেশনাল যোগ করুন</span>
          </Link>
          <button
            type="button"
            onClick={loadData}
            className="p-3 bg-[#F8FAFC] dark:bg-slate-800 hover:bg-[#EFF6FF] dark:hover:bg-slate-700 text-[#0F2942] dark:text-slate-300 border border-[#E2E8F0] dark:border-slate-700 rounded-xl transition cursor-pointer"
            title="রিফ্রেশ করুন"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error Banner if Supabase call failed */}
      {loadError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center justify-between gap-4 text-rose-700 dark:text-rose-300 text-xs font-semibold">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shrink-0 cursor-pointer"
          >
            আবার চেষ্টা করুন
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-5 py-3 font-bold text-sm rounded-t-2xl flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-white dark:bg-slate-900 text-[#0B63E5] border-t-2 border-[#0B63E5] shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>ওভারভিউ</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`px-5 py-3 font-bold text-sm rounded-t-2xl flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-white dark:bg-slate-900 text-[#0B63E5] border-t-2 border-[#0B63E5] shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>ইউজার ম্যানেজমেন্ট ({totalUsers})</span>
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
          <span>পোস্ট মডারেশন ({totalPosts})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('professions')}
          className={`px-5 py-3 font-bold text-sm rounded-t-2xl flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'professions'
              ? 'bg-white dark:bg-slate-900 text-[#0B63E5] border-t-2 border-[#0B63E5] shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>পেশা তালিকা</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`px-5 py-3 font-bold text-sm rounded-t-2xl flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'settings'
              ? 'bg-white dark:bg-slate-900 text-[#0B63E5] border-t-2 border-[#0B63E5] shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>সাইট সেটিংস</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Stat Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase">মোট প্রফেশনাল ইউজার</p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white">{totalUsers}</h3>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-2">
              <p className="text-xs font-bold text-amber-600 uppercase">অনুমোদনের অপেক্ষায় (Pending)</p>
              <h3 className="text-3xl font-black text-amber-600">{pendingUsers}</h3>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-2">
              <p className="text-xs font-bold text-[#16A34A] uppercase">অনুমোদিত ও সক্রিয়</p>
              <h3 className="text-3xl font-black text-[#16A34A] tabular-nums">{approvedUsers}</h3>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase">মোট পোস্ট</p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white">{totalPosts}</h3>
            </div>
          </div>

          {/* Recent Registrations Table */}
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">সাম্প্রতিক নিবন্ধনসমূহ</h3>

            {profiles.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-sm">
                এখনো কোনো প্রোফাইল নিবন্ধিত হয়নি।
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold uppercase">
                    <tr>
                      <th className="p-3.5 rounded-l-xl">আইডি</th>
                      <th className="p-3.5">নাম ও ইমেইল</th>
                      <th className="p-3.5">পেশা ও এলাকা</th>
                      <th className="p-3.5">মোবাইল</th>
                      <th className="p-3.5">স্ট্যাটাস</th>
                      <th className="p-3.5 rounded-r-xl text-right">কার্যক্রম</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {profiles.slice(0, 6).map((p) => {
                      const profObj = professions.find((pr) => String(pr.id) === String(p.profession_id));
                      const loc = resolveLocationNames(
                        p.division_id,
                        p.district_id,
                        p.upazila_id,
                        p.extra_info
                      );
                      const areaStr = [loc.upazila_name, loc.district_name].filter(Boolean).join(', ');
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="p-3.5 font-mono font-bold">#{p.user_serial || 1}</td>
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900 dark:text-white">{p.full_name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{p.email || '—'}</div>
                          </td>
                          <td className="p-3.5">
                            <div className="font-semibold">
                              {profObj?.name_bn || p.extra_info?._profession_name || 'পেশাজীবী'}
                            </div>
                            {areaStr && <div className="text-[10px] text-slate-500">{areaStr}</div>}
                          </td>
                          <td className="p-3.5 font-mono">{p.phone}</td>
                          <td className="p-3.5">
                            <span
                              className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                                p.status === 'approved'
                                  ? 'bg-[#E6F7ED] text-[#15803D]'
                                  : p.status === 'pending'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <Link
                              to={`/dashboard/profiles/${p.id}/edit`}
                              className="text-[#0B63E5] font-bold hover:underline"
                            >
                              এডিট
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          {/* Search & Filters */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="নাম, এলাকা, ফোন বা #আইডি দিয়ে খুঁজুন..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <select
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              >
                <option value="all">সকল এলাকা (বিভাগ)</option>
                {divisions.map((dv) => (
                  <option key={dv.id} value={dv.id}>
                    {dv.name_bn}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              >
                <option value="all">সকল স্ট্যাটাস</option>
                <option value="approved">Approved (প্রকাশিত)</option>
                <option value="pending">Pending (অপেক্ষমাণ)</option>
                <option value="suspended">Suspended (স্থগিত)</option>
                <option value="rejected">Rejected (বাতিল)</option>
              </select>

              <select
                value={professionFilter}
                onChange={(e) => setProfessionFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              >
                <option value="all">সকল পেশা</option>
                {professions.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.name_bn}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Users Table */}
          {filteredProfiles.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              কোনো পেশাজীবী পাওয়া যায়নি।
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold uppercase">
                  <tr>
                    <th className="p-3.5 rounded-l-xl">আইডি</th>
                    <th className="p-3.5">পেশাজীবী ও ইমেইল</th>
                    <th className="p-3.5">পেশা ও এলাকা</th>
                    <th className="p-3.5">মোবাইল</th>
                    <th className="p-3.5">স্ট্যাটাস কন্ট্রোল</th>
                    <th className="p-3.5">অ্যাডমিন যাচাই</th>
                    <th className="p-3.5 rounded-r-xl text-right">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredProfiles.map((p) => {
                    const profObj = professions.find((pr) => String(pr.id) === String(p.profession_id));
                    const loc = resolveLocationNames(
                      p.division_id,
                      p.district_id,
                      p.upazila_id,
                      p.extra_info
                    );
                    const rawAreaParts = [loc.upazila_name, loc.district_name, loc.division_name].filter(
                      (x): x is string => Boolean(x && x.trim())
                    );
                    const areaParts: string[] = [];
                    for (const part of rawAreaParts) {
                      if (!areaParts.includes(part.trim())) {
                        areaParts.push(part.trim());
                      }
                    }
                    const areaText = areaParts.join(', ');
                    const paddedId = String(p.user_serial || 1).padStart(5, '0');

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="p-3.5 font-mono font-bold tabular-nums text-[#0B63E5] dark:text-blue-400">
                          #{paddedId}
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-2.5">
                            {p.profile_photo_url ? (
                              <img
                                src={p.profile_photo_url}
                                alt={p.full_name}
                                referrerPolicy="no-referrer"
                                className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-[#EFF6FF] dark:bg-blue-950 text-[#0B63E5] dark:text-blue-300 font-bold flex items-center justify-center text-xs shrink-0">
                                {(p.full_name || 'U').slice(0, 1).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <span>{p.full_name}</span>
                                {p.role === 'admin' && (
                                  <span className="px-1.5 py-0.5 bg-[#EFF6FF] dark:bg-blue-950 text-[#0B63E5] dark:text-blue-300 text-[9px] rounded font-mono">
                                    ADMIN
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">{p.email || 'ইমেইল নেই'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-semibold text-[#0B63E5] dark:text-blue-400">
                            {profObj?.name_bn || p.extra_info?._profession_name || 'পেশাজীবী'}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {areaText ? `এলাকা: ${areaText}` : 'এলাকা যুক্ত নেই'}
                          </div>
                        </td>
                        <td className="p-3.5 font-mono tabular-nums">{p.phone}</td>
                        <td className="p-3.5">
                          <select
                            value={p.status}
                            onChange={(e) => handleStatusChange(p.id, e.target.value as ProfileStatus)}
                            className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] border cursor-pointer outline-none ${
                              p.status === 'approved'
                                ? 'bg-[#E6F7ED] dark:bg-emerald-950/60 text-[#15803D] dark:text-emerald-300 border-[#BBF7D0] dark:border-emerald-800'
                                : p.status === 'pending'
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                : 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                            }`}
                          >
                            <option value="approved">Approved (প্রকাশিত)</option>
                            <option value="pending">Pending (লুকানো)</option>
                            <option value="suspended">Suspended (স্থগিত)</option>
                            <option value="rejected">Rejected (বাতিল)</option>
                          </select>
                        </td>
                        <td className="p-3.5">
                          <button
                            type="button"
                            onClick={() => handleToggleVerified(p.id, Boolean(p.is_verified))}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                              p.is_verified
                                ? 'bg-[#E6F7ED] dark:bg-emerald-950/80 text-[#15803D] dark:text-emerald-300 hover:bg-[#DCFCE7]'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
                            }`}
                            title="অ্যাডমিন যাচাইকৃত ব্যাজ চালু/বন্ধ করুন"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{p.is_verified ? 'যাচাইকৃত ✓' : 'অযাচাইকৃত'}</span>
                          </button>
                        </td>
                        <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                          {(p.nid_number || p.nid_photo_url) && (
                            <button
                              type="button"
                              onClick={() => handleViewNid(p)}
                              className="inline-block p-1.5 bg-[#EFF6FF] dark:bg-blue-950/60 hover:bg-[#EFF6FF] rounded-lg text-[#0B63E5] dark:text-blue-300 cursor-pointer"
                              title="NID তথ্য দেখুন"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <Link
                            to={`/profile/${p.id}`}
                            className="inline-block p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg text-slate-700 dark:text-slate-300"
                            title="পাবলিক প্রোফাইল দেখুন"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                          <Link
                            to={`/dashboard/profiles/${p.id}/edit`}
                            className="inline-block p-1.5 bg-[#EFF6FF] dark:bg-blue-950/60 hover:bg-[#EFF6FF] rounded-lg text-[#0B63E5] dark:text-blue-300"
                            title="সম্পূর্ণ প্রোফাইল এডিট ও কন্ট্রোল"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => confirmDelete(p.id, 'profile')}
                            className="p-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg cursor-pointer"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: POST MODERATION */}
      {activeTab === 'posts' && (
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">পোস্ট মডারেশন ও নিয়ন্ত্রণ</h3>

          {/* Admin Create Post Form */}
          <form
            onSubmit={handleAdminCreatePostSubmit}
            className="p-5 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3.5"
          >
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">ইউজারের পক্ষ থেকে পোস্ট করুন</h4>
            <select
              value={selectedPostProfileId}
              onChange={(e) => setSelectedPostProfileId(e.target.value)}
              className="w-full p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="">প্রফেশনাল নির্বাচন করুন</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} (#{p.user_serial || 1})
                </option>
              ))}
            </select>

            <textarea
              rows={3}
              value={adminPostContent}
              onChange={(e) => setAdminPostContent(e.target.value)}
              placeholder="পোস্টের কন্টেন্ট লিখুন..."
              className="w-full p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
            ></textarea>

            {/* Image Attachment Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-[#EFF6FF] dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition shrink-0">
                <ImageIcon className="w-4 h-4 text-[#0B63E5]" />
                <span>{adminPostImageFile ? 'ছবি পরিবর্তন করুন' : 'ছবি যুক্ত করুন'}</span>
                <input
                  ref={adminPostFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAdminPostImageSelect}
                  className="hidden"
                />
              </label>

              <input
                type="url"
                value={adminPostImageUrlInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setAdminPostImageUrlInput(val);
                  if (val.trim() && adminPostImageFile) {
                    if (adminPostImagePreview && adminPostImagePreview.startsWith('blob:')) {
                      URL.revokeObjectURL(adminPostImagePreview);
                    }
                    setAdminPostImageFile(null);
                    setAdminPostImagePreview(null);
                    if (adminPostFileInputRef.current) {
                      adminPostFileInputRef.current.value = '';
                    }
                  }
                }}
                placeholder="অথবা ছবির সরাসরি লিংক দিন (ঐচ্ছিক https://...)"
                className="flex-1 p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Live Selected Image Preview */}
            {(adminPostImagePreview || adminPostImageUrlInput.trim()) && (
              <div className="relative inline-block rounded-2xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-900/50 max-w-xs">
                <img
                  src={adminPostImagePreview || adminPostImageUrlInput.trim()}
                  alt="পোস্টের ছবির প্রিভিউ"
                  className="max-h-48 w-auto object-cover block"
                />
                <button
                  type="button"
                  onClick={clearAdminPostImage}
                  className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg transition cursor-pointer"
                  title="ছবি সরান"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="pt-1">
              <button
                type="submit"
                disabled={creatingAdminPost}
                className="px-5 py-2.5 bg-[#0B63E5] hover:bg-[#084FC7] text-white font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-60 inline-flex items-center gap-2"
              >
                {creatingAdminPost && (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                )}
                <span>{creatingAdminPost ? 'পোস্ট হচ্ছে...' : 'পোস্ট করুন'}</span>
              </button>
            </div>
          </form>

          <div className="space-y-4">
            {posts.length === 0 ? (
              <div className="text-center py-12 text-slate-500">কোনো পোস্ট পাওয়া যায়নি।</div>
            ) : (
              posts.map((post) => {
                const author = profiles.find((pr) => pr.id === post.profile_id);
                return (
                  <div
                    key={post.id}
                    className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start justify-between gap-4"
                  >
                    <div className="space-y-2.5 max-w-2xl w-full">
                      <div className="flex flex-wrap items-center gap-2">
                        {author && (
                          <Link
                            to={`/profile/${author.id}`}
                            className="text-xs font-bold text-[#0B63E5] dark:text-blue-400 hover:underline"
                          >
                            {author.full_name} (#{author.user_serial || 1})
                          </Link>
                        )}
                        <span className="text-xs font-bold text-slate-400">
                          {post.created_at
                            ? new Date(post.created_at).toLocaleDateString('bn-BD')
                            : ''}
                        </span>
                        {post.is_hidden && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-600 font-bold text-[10px] rounded-full">
                            লুকানো (Hidden)
                          </span>
                        )}
                      </div>

                      {post.content && (
                        <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                          {post.content}
                        </p>
                      )}

                      {post.image_url && (
                        <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 max-w-sm max-h-64 bg-slate-900/40">
                          <img
                            src={post.image_url}
                            alt="Post Attachment"
                            className="w-full max-h-64 object-cover"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await toggleHidePostInDb(post.id, !post.is_hidden);
                            await loadData();
                            showToast('পোস্ট দৃশ্যমানতা আপডেট হয়েছে।', 'success');
                          } catch (err: any) {
                            showToast(translateSupabaseError(err, 'পোস্ট আপডেট ব্যর্থ হয়েছে।'), 'error');
                          }
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                          post.is_hidden ? 'bg-[#0B63E5] text-white' : 'bg-amber-500 text-slate-950'
                        }`}
                      >
                        {post.is_hidden ? 'প্রকাশ করুন' : 'লুকিয়ে রাখুন'}
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmDelete(post.id, 'post')}
                        className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-xl cursor-pointer"
                        title="ডিলিট করুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 4: PROFESSIONS MANAGEMENT */}
      {activeTab === 'professions' && (
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">পেশা তালিকা ব্যবস্থাপনা</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {professions.map((pr) => (
              <div
                key={pr.id}
                className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between"
              >
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">{pr.name_bn}</h4>
                  <p className="text-[10px] font-mono text-slate-400">Slug: {pr.slug}</p>
                </div>
                <span className="px-2.5 py-1 bg-[#E6F7ED] text-[#15803D] text-[10px] font-bold rounded-full">
                  সক্রিয়
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: SITE SETTINGS */}
      {activeTab === 'settings' && (
        <form
          onSubmit={handleSaveSettings}
          className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-6"
        >
          <h3 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
            ওয়েবসাইট সেটিংস ও ব্র্যান্ডিং
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                সাইটের নাম (বাংলা)
              </label>
              <input
                type="text"
                value={settingsForm.site_name}
                onChange={(e) => setSettingsForm({ ...settingsForm, site_name: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                সাইটের নাম (ইংরেজি)
              </label>
              <input
                type="text"
                value={settingsForm.site_name_en}
                onChange={(e) => setSettingsForm({ ...settingsForm, site_name_en: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              হিরো সেকশন শিরোনাম
            </label>
            <input
              type="text"
              value={settingsForm.hero_title}
              onChange={(e) => setSettingsForm({ ...settingsForm, hero_title: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              ফুটার সম্পর্কে (Footer About)
            </label>
            <textarea
              rows={3}
              value={settingsForm.footer_about}
              onChange={(e) => setSettingsForm({ ...settingsForm, footer_about: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium"
            ></textarea>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                যোগাযোগের ইমেইল
              </label>
              <input
                type="email"
                value={settingsForm.contact_email}
                onChange={(e) => setSettingsForm({ ...settingsForm, contact_email: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                যোগাযোগের মোবাইল / হোয়াটসঅ্যাপ
              </label>
              <input
                type="text"
                value={settingsForm.contact_phone}
                onChange={(e) => setSettingsForm({ ...settingsForm, contact_phone: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                অফিস ঠিকানা
              </label>
              <input
                type="text"
                value={settingsForm.contact_address}
                onChange={(e) => setSettingsForm({ ...settingsForm, contact_address: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-[#0B63E5] hover:bg-[#084FC7] text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/15 transition cursor-pointer"
          >
            সেটিংস সংরক্ষণ করুন
          </button>
        </form>
      )}

      {/* NID Verification Modal */}
      {nidModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#0B63E5]" />
                <span>NID ভেরিফিকেশন তথ্য</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setNidModalUser(null);
                  setNidPreviewUrl(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <p>
                <strong>নাম:</strong> {nidModalUser.full_name}
              </p>
              <p>
                <strong>ই-মেইল:</strong> {nidModalUser.email || '—'}
              </p>
              <p>
                <strong>NID নম্বর:</strong>{' '}
                <span className="font-mono font-bold">{nidModalUser.nid_number || 'দেওয়া হয়নি'}</span>
              </p>
            </div>
            {nidPreviewUrl ? (
              <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-72">
                <img src={nidPreviewUrl} alt="NID Document" className="w-full h-full object-contain" />
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center py-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                কোনো NID ছবি সংযুক্ত নেই।
              </p>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto text-2xl font-bold">
              ⚠️
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              আপনি কি নিশ্চিতভাবে এটি মুছে ফেলতে চান?
            </h3>
            <p className="text-xs text-slate-500">এই প্রক্রিয়াটি স্থায়ী এবং ফিরিয়ে আনা সম্ভব নয়।</p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-red-600/30 cursor-pointer"
              >
                নিশ্চিত ডিলিট
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
