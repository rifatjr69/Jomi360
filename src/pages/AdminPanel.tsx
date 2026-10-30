import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  ShieldCheck,
  Briefcase,
  FileCheck2,
  Users,
  Images,
  Settings,
  Sliders,
  FileText,
  RefreshCw,
  Search,
  Eye,
  CheckCircle2,
  XCircle,
  Trash2,
  Edit3,
  Plus,
  Upload,
  ArrowUp,
  ArrowDown,
  X,
  Save,
  UserPlus,
  Ban,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { useToast } from '../components/Toast';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { JobsRlsFixBanner } from '../components/JobsRlsFixBanner';
import { isJobsRlsError } from '../lib/jobsSqlFix';
import {
  adminFetchAllProfiles,
  fetchAllPostsForAdmin,
  toggleHidePostInDb,
  deletePostInDb,
  getVerificationDocSignedUrl,
  uploadProfileMedia,
  translateSupabaseError,
} from '../lib/supabase';
import {
  adminFetchVerificationRequests,
  adminReviewVerificationRequest,
  adminFetchAllJobs,
  adminReviewJob,
  adminDeleteJob,
  adminFetchAllApplications,
  adminApproveApplicationInDb,
  adminDeleteApplication,
  adminUpdateUserRole,
  adminUpdateUserSuspension,
  adminToggleUserVerified,
  adminFetchAllBanners,
  adminSaveBanner,
  adminDeleteBanner,
} from '../lib/marketplaceService';
import type {
  Profile,
  VerificationRequest,
  Job,
  JobApplication,
  Banner,
  Post,
  SiteSettings,
} from '../types/database';

type AdminSection =
  | 'dashboard'
  | 'verifications'
  | 'jobs'
  | 'applications'
  | 'users'
  | 'banners'
  | 'settings'
  | 'rules'
  | 'posts';

export const AdminPanel: React.FC = () => {
  const { user, profile: adminProfile } = useAuth();
  const { settings, saveSettings } = useSiteSettings();
  const { showToast } = useToast();

  const [section, setSection] = useState<AdminSection>('dashboard');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Data states
  const [users, setUsers] = useState<Profile[]>([]);
  const [verifications, setVerifications] = useState<VerificationRequest[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsRlsError, setJobsRlsError] = useState(false);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);

  // Filters
  const [verifFilter, setVerifFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState('all');
  const [userSearch, setUserSearch] = useState('');

  // Verification Detail Modal
  const [selectedVerif, setSelectedVerif] = useState<VerificationRequest | null>(null);
  const [verifSignedUrls, setVerifSignedUrls] = useState<{
    front: string | null;
    back: string | null;
    selfie: string | null;
  }>({ front: null, back: null, selfie: null });
  const [rejectReason, setRejectReason] = useState('');

  // Job Reject Note Modal
  const [rejectingJob, setRejectingJob] = useState<Job | null>(null);
  const [jobRejectNote, setJobRejectNote] = useState('');

  // Banner Form Modal
  const [bannerModalOpen, setBannerModalOpen] = useState(false);
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [bTitle, setBTitle] = useState('');
  const [bSubtitle, setBSubtitle] = useState('');
  const [bImageUrl, setBImageUrl] = useState('');
  const [bMobileImageUrl, setBMobileImageUrl] = useState('');
  const [bLinkUrl, setBLinkUrl] = useState('');
  const [bButtonText, setBButtonText] = useState('');
  const [bSortOrder, setBSortOrder] = useState(0);
  const [bIsActive, setBIsActive] = useState(true);
  const [bStartDate, setBStartDate] = useState('');
  const [bEndDate, setBEndDate] = useState('');
  const [uploadingBannerImg, setUploadingBannerImg] = useState(false);

  // Site Settings Local State
  const [siteForm, setSiteForm] = useState<SiteSettings>(settings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingBrandAsset, setUploadingBrandAsset] = useState<'logo' | 'favicon' | null>(null);

  useEffect(() => {
    setSiteForm(settings);
  }, [settings]);

  const loadAllAdminData = async () => {
    setLoading(true);
    try {
      const [uRes, vRes, jRes, aRes, bRes, pRes] = await Promise.allSettled([
        adminFetchAllProfiles(),
        adminFetchVerificationRequests('all'),
        adminFetchAllJobs(),
        adminFetchAllApplications(),
        adminFetchAllBanners(),
        fetchAllPostsForAdmin(),
      ]);

      if (uRes.status === 'fulfilled') setUsers(uRes.value);
      if (vRes.status === 'fulfilled') setVerifications(vRes.value);
      if (jRes.status === 'fulfilled') {
        setJobs(jRes.value);
        setJobsRlsError(false);
      } else if (isJobsRlsError(jRes.reason)) {
        setJobsRlsError(true);
      }
      if (aRes.status === 'fulfilled') setApplications(aRes.value);
      if (bRes.status === 'fulfilled') setBanners(bRes.value);
      if (pRes.status === 'fulfilled') setPosts(pRes.value);
    } catch (err) {
      console.error('[AdminPanel] loadAllAdminData error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllAdminData();
  }, []);

  // Open Verification Details with Signed Private Storage URLs
  const openVerifModal = async (req: VerificationRequest) => {
    setSelectedVerif(req);
    setRejectReason(req.rejection_reason || '');
    setVerifSignedUrls({ front: null, back: null, selfie: null });

    const [front, back, selfie] = await Promise.all([
      req.id_front_path ? getVerificationDocSignedUrl(req.id_front_path) : Promise.resolve(null),
      req.id_back_path ? getVerificationDocSignedUrl(req.id_back_path) : Promise.resolve(null),
      req.selfie_path ? getVerificationDocSignedUrl(req.selfie_path) : Promise.resolve(null),
    ]);
    setVerifSignedUrls({ front, back, selfie });
  };

  const handleVerifDecision = async (action: 'approve' | 'reject') => {
    if (!selectedVerif || !user) return;
    if (action === 'reject' && !rejectReason.trim()) {
      showToast('প্রত্যাখ্যানের কারণ উল্লেখ করা আবশ্যিক।', 'error');
      return;
    }

    setBusyId(selectedVerif.id);
    try {
      await adminReviewVerificationRequest({
        request: selectedVerif,
        action,
        rejection_reason: rejectReason.trim(),
        admin_user_id: user.id,
      });
      showToast(
        action === 'approve'
          ? 'ভেরিফিকেশন অনুমোদিত হয়েছে এবং প্রোফাইলে ব্লু ব্যাজ যুক্ত হয়েছে!'
          : 'ভেরিফিকেশন আবেদন প্রত্যাখ্যান করা হয়েছে।',
        'success'
      );
      setSelectedVerif(null);
      await loadAllAdminData();
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'ভেরিফিকেশন আপডেট ব্যর্থ হয়েছে।'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  // Job actions
  const handleJobQuickAction = async (job: Job, action: 'approve' | 'close') => {
    setBusyId(job.id);
    try {
      await adminReviewJob({ job, action });
      showToast(
        action === 'approve' ? 'জব অনুমোদিত ও ওপেন করা হয়েছে!' : 'জবটি বন্ধ করা হয়েছে।',
        'success'
      );
      await loadAllAdminData();
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'জব আপডেট করা যায়নি।'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const confirmRejectJob = async () => {
    if (!rejectingJob) return;
    setBusyId(rejectingJob.id);
    try {
      await adminReviewJob({
        job: rejectingJob,
        action: 'reject',
        admin_note: jobRejectNote.trim() || 'সাইটের নীতিমালার সাথে সামঞ্জস্যপূর্ণ নয়।',
      });
      showToast('জবটি নোটসহ প্রত্যাখ্যান করা হয়েছে।', 'info');
      setRejectingJob(null);
      setJobRejectNote('');
      await loadAllAdminData();
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'জব প্রত্যাখ্যান ব্যর্থ হয়েছে।'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    setBusyId(jobId);
    try {
      await adminDeleteJob(jobId);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      showToast('জব মুছে ফেলা হয়েছে।', 'success');
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'জব মুছে ফেলা যায়নি।'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  // Application actions
  const handleApproveApp = async (app: JobApplication) => {
    setBusyId(app.id);
    try {
      await adminApproveApplicationInDb(app);
      showToast('আবেদন অনুমোদিত হয়েছে।', 'success');
      await loadAllAdminData();
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'অনুমোদন ব্যর্থ হয়েছে।'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemoveApp = async (appId: string) => {
    setBusyId(appId);
    try {
      await adminDeleteApplication(appId);
      setApplications((prev) => prev.filter((a) => a.id !== appId));
      showToast('আবেদনটি মুছে ফেলা হয়েছে।', 'info');
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'আবেদন মুছতে সমস্যা হয়েছে।'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  // User actions
  const handleRoleToggle = async (u: Profile) => {
    if (u.id === adminProfile?.id) {
      showToast('নিজের অ্যাডমিন রোল পরিবর্তন করা যাবে না।', 'error');
      return;
    }
    const nextRole = u.role === 'admin' ? 'user' : 'admin';
    setBusyId(u.id);
    try {
      const updated = await adminUpdateUserRole(u.id, nextRole);
      setUsers((prev) => prev.map((item) => (item.id === u.id ? updated : item)));
      showToast(`ইউজারের রোল "${nextRole}" করা হয়েছে।`, 'success');
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'রোল পরিবর্তন ব্যর্থ হয়েছে।'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleManualVerifyToggle = async (u: Profile) => {
    const nextVerify = !(u.is_verified || u.verification_status === 'verified');
    setBusyId(u.id);
    try {
      const updated = await adminToggleUserVerified(u.id, nextVerify);
      setUsers((prev) => prev.map((item) => (item.id === u.id ? updated : item)));
      showToast(
        nextVerify ? 'প্রোফাইল ভেরিফাইড করা হয়েছে!' : 'প্রোফাইল আনভেরিফাইড করা হয়েছে।',
        'success'
      );
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'ভেরিফিকেশন আপডেট ব্যর্থ হয়েছে।'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleSuspendToggle = async (u: Profile) => {
    if (u.id === adminProfile?.id) {
      showToast('নিজের অ্যাকাউন্ট সাসপেন্ড করা যাবে না।', 'error');
      return;
    }
    const nextSuspend = !u.is_suspended;
    setBusyId(u.id);
    try {
      const updated = await adminUpdateUserSuspension(u.id, nextSuspend);
      setUsers((prev) => prev.map((item) => (item.id === u.id ? updated : item)));
      showToast(
        nextSuspend ? 'ইউজার সাসপেন্ড করা হয়েছে।' : 'ইউজার পুনরায় সক্রিয় করা হয়েছে।',
        'info'
      );
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'সাসপেনশন আপডেট ব্যর্থ হয়েছে।'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  // Banner modal & actions
  const openNewBannerModal = () => {
    setEditingBannerId(null);
    setBTitle('');
    setBSubtitle('');
    setBImageUrl('');
    setBMobileImageUrl('');
    setBLinkUrl('');
    setBButtonText('বিস্তারিত দেখুন');
    setBSortOrder(banners.length + 1);
    setBIsActive(true);
    setBStartDate('');
    setBEndDate('');
    setBannerModalOpen(true);
  };

  const openEditBannerModal = (b: Banner) => {
    setEditingBannerId(b.id);
    setBTitle(b.title || '');
    setBSubtitle(b.subtitle || '');
    setBImageUrl(b.image_url);
    setBMobileImageUrl(b.mobile_image_url || '');
    setBLinkUrl(b.link_url || '');
    setBButtonText(b.button_text || '');
    setBSortOrder(b.sort_order);
    setBIsActive(b.is_active);
    setBStartDate(b.start_date ? b.start_date.slice(0, 10) : '');
    setBEndDate(b.end_date ? b.end_date.slice(0, 10) : '');
    setBannerModalOpen(true);
  };

  const handleBannerImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    slot: 'desktop' | 'mobile'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBannerImg(true);
    try {
      const url = await uploadProfileMedia(file, 'banners', slot);
      if (slot === 'desktop') setBImageUrl(url);
      else setBMobileImageUrl(url);
      showToast('ব্যানার ছবি আপলোড হয়েছে!', 'success');
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'ছবি আপলোড ব্যর্থ হয়েছে।'), 'error');
    } finally {
      setUploadingBannerImg(false);
    }
  };

  const handleSaveBannerForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bImageUrl.trim()) {
      showToast('ডেস্কটপ ব্যানার ছবি আবশ্যিক।', 'error');
      return;
    }

    setBusyId('banner-save');
    try {
      await adminSaveBanner({
        id: editingBannerId || undefined,
        title: bTitle.trim(),
        subtitle: bSubtitle.trim() || null,
        image_url: bImageUrl.trim(),
        mobile_image_url: bMobileImageUrl.trim() || null,
        link_url: bLinkUrl.trim() || null,
        button_text: bButtonText.trim() || null,
        sort_order: Number(bSortOrder || 0),
        is_active: bIsActive,
        start_date: bStartDate ? new Date(bStartDate).toISOString() : null,
        end_date: bEndDate ? new Date(bEndDate).toISOString() : null,
      });
      setBannerModalOpen(false);
      showToast('ব্যানার সংরক্ষিত হয়েছে!', 'success');
      await loadAllAdminData();
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'ব্যানার সংরক্ষণ ব্যর্থ হয়েছে।'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleReorderBanner = async (b: Banner, delta: number) => {
    setBusyId(b.id);
    try {
      await adminSaveBanner({
        ...b,
        sort_order: Math.max(0, b.sort_order + delta),
      });
      await loadAllAdminData();
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'ক্রম পরিবর্তন ব্যর্থ হয়েছে।'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleBannerActive = async (b: Banner) => {
    setBusyId(b.id);
    try {
      await adminSaveBanner({ ...b, is_active: !b.is_active });
      await loadAllAdminData();
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে।'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteBannerItem = async (id: string) => {
    setBusyId(id);
    try {
      await adminDeleteBanner(id);
      setBanners((prev) => prev.filter((b) => b.id !== id));
      showToast('ব্যানার মুছে ফেলা হয়েছে।', 'info');
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'ব্যানার মুছে ফেলা যায়নি।'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  // Site Settings & Brand Assets
  const handleBrandUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: 'logo' | 'favicon'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBrandAsset(kind);
    try {
      const url = await uploadProfileMedia(file, 'site-assets', kind);
      setSiteForm((prev) =>
        kind === 'logo' ? { ...prev, logo_url: url } : { ...prev, favicon_url: url }
      );
      showToast(
        kind === 'logo'
          ? 'লোগো আপলোড হয়েছে! সংরক্ষণ বাটনে ক্লিক করুন।'
          : 'ফ্যাভিকন আপলোড হয়েছে! সংরক্ষণ বাটনে ক্লিক করুন।',
        'info'
      );
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'আপলোড ব্যর্থ হয়েছে।'), 'error');
    } finally {
      setUploadingBrandAsset(null);
    }
  };

  const handleSaveSiteSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await saveSettings(siteForm);
      showToast('সাইট সেটিংস সফলভাবে সংরক্ষিত ও লাইভ আপডেট হয়েছে!', 'success');
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'সাইট সেটিংস সংরক্ষণ ব্যর্থ হয়েছে।'), 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleRule = async (
    key:
      | 'require_job_approval'
      | 'require_application_approval'
      | 'require_verified_to_post_job'
      | 'require_verified_to_apply_job'
  ) => {
    const nextValue = !siteForm[key];
    const updated = { ...siteForm, [key]: nextValue };
    setSiteForm(updated);
    setSavingSettings(true);
    try {
      await saveSettings({ [key]: nextValue });
      showToast('নিয়মাবলি (Rule) সফলভাবে আপডেট হয়েছে!', 'success');
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'রুল আপডেট করা যায়নি।'), 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Derived metrics
  const pendingVerifCount = verifications.filter((v) => v.status === 'pending').length;
  const pendingJobsCount = jobs.filter((j) => j.status === 'pending_approval').length;
  const openJobsCount = jobs.filter((j) => j.status === 'open').length;
  const inProgressJobsCount = jobs.filter(
    (j) => j.status === 'in_progress' || j.status === 'delivered'
  ).length;
  const completedJobsCount = jobs.filter((j) => j.status === 'completed').length;
  const verifiedUsersCount = users.filter(
    (u) => u.is_verified || u.verification_status === 'verified'
  ).length;

  const filteredVerifs =
    verifFilter === 'all'
      ? verifications
      : verifications.filter((v) => v.status === verifFilter);

  const filteredJobs =
    jobFilter === 'all' ? jobs : jobs.filter((j) => j.status === jobFilter);

  const filteredUsers = users.filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.trim().toLowerCase();
    return (
      u.full_name.toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      u.phone.toLowerCase().includes(q)
    );
  });

  const navItems: { id: AdminSection; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: 'ড্যাশবোর্ড ওভারভিউ', icon: <LayoutDashboard className="w-4 h-4" /> },
    {
      id: 'verifications',
      label: 'ভেরিফিকেশন রিকোয়েস্ট',
      icon: <ShieldCheck className="w-4 h-4" />,
      badge: pendingVerifCount,
    },
    {
      id: 'jobs',
      label: 'জব ম্যানেজমেন্ট',
      icon: <Briefcase className="w-4 h-4" />,
      badge: pendingJobsCount,
    },
    {
      id: 'applications',
      label: 'আবেদন ও হায়ার',
      icon: <FileCheck2 className="w-4 h-4" />,
    },
    { id: 'users', label: 'ইউজার ম্যানেজমেন্ট', icon: <Users className="w-4 h-4" /> },
    { id: 'banners', label: 'হোম ব্যানার স্লাইডার', icon: <Images className="w-4 h-4" /> },
    { id: 'settings', label: 'সাইট সেটিংস ও থিম', icon: <Settings className="w-4 h-4" /> },
    { id: 'rules', label: 'রুলস ও অনুমোদন টগল', icon: <Sliders className="w-4 h-4" /> },
    { id: 'posts', label: 'পোস্ট মডারেশন', icon: <FileText className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* SIDEBAR */}
        <aside className="w-full lg:w-64 shrink-0 bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm lg:sticky lg:top-24">
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white font-siliguri">
                অ্যাডমিন প্যানেল
              </h2>
              <p className="text-[11px] text-slate-500">পূর্ণ নিয়ন্ত্রণ কেন্দ্র</p>
            </div>
            <button
              type="button"
              onClick={loadAllAdminData}
              className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 cursor-pointer"
              title="রিফ্রেশ"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <nav className="flex lg:flex-col gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {navItems.map((item) => {
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    active
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                        active ? 'bg-white text-[#0F2942]' : 'bg-rose-600 text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* MAIN CONTENT */}
        <div className="flex-1 w-full space-y-6">
          {jobsRlsError && <JobsRlsFixBanner onRetry={loadAllAdminData} />}

          {/* (a) DASHBOARD OVERVIEW */}
          {section === 'dashboard' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-black text-slate-900 dark:text-white font-siliguri">
                    অ্যাডমিন ড্যাশবোর্ড সারসংক্ষেপ
                  </h1>
                  <p className="text-xs text-slate-500">
                    প্ল্যাটফর্মের ইউজার, ভেরিফিকেশন ও জব মার্কেটপ্লেসের তাৎক্ষণিক পরিসংখ্যান।
                  </p>
                </div>
                <Link
                  to="/admin/profiles/new"
                  className="px-4 py-2.5 bg-brand text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 shrink-0"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>নতুন প্রফেশনাল যোগ করুন</span>
                </Link>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    label: 'মোট নিবন্ধিত ইউজার',
                    val: users.length,
                    sub: `${verifiedUsersCount} জন ভেরিফাইড`,
                    target: 'users' as AdminSection,
                  },
                  {
                    label: 'পেন্ডিং ভেরিফিকেশন',
                    val: pendingVerifCount,
                    sub: 'অ্যাডমিন রিভিউ প্রয়োজন',
                    target: 'verifications' as AdminSection,
                  },
                  {
                    label: 'পেন্ডিং জব পোস্ট',
                    val: pendingJobsCount,
                    sub: 'অনুমোদনের অপেক্ষায়',
                    target: 'jobs' as AdminSection,
                  },
                  {
                    label: 'চলমান (Open) জব',
                    val: openJobsCount,
                    sub: `${inProgressJobsCount}টি ইন-প্রগ্রেস`,
                    target: 'jobs' as AdminSection,
                  },
                  {
                    label: 'ইন-প্রগ্রেস কাজ',
                    val: inProgressJobsCount,
                    sub: 'কর্মী নিযুক্ত আছে',
                    target: 'applications' as AdminSection,
                  },
                  {
                    label: 'সম্পন্ন জব (Completed)',
                    val: completedJobsCount,
                    sub: 'সফল ডেলিভারি',
                    target: 'jobs' as AdminSection,
                  },
                  {
                    label: 'মোট জব আবেদন',
                    val: applications.length,
                    sub: 'প্রস্তাবসমূহ',
                    target: 'applications' as AdminSection,
                  },
                  {
                    label: 'সক্রিয় হোম ব্যানার',
                    val: banners.filter((b) => b.is_active).length,
                    sub: `মোট ${banners.length}টি ব্যানার`,
                    target: 'banners' as AdminSection,
                  },
                ].map((stat, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSection(stat.target)}
                    className="text-left bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 hover:border-[var(--brand-primary)] transition shadow-sm cursor-pointer space-y-1"
                  >
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {stat.label}
                    </p>
                    <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                      {stat.val}
                    </p>
                    <p className="text-[11px] font-semibold text-[var(--brand-primary)]">
                      {stat.sub}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* (b) VERIFICATION REQUESTS */}
          {section === 'verifications' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white font-siliguri">
                    ভেরিফিকেশন রিকোয়েস্ট ({filteredVerifs.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    প্রাইভেট বাকেট থেকে সাইনড লিংকের মাধ্যমে ইউজারের NID ও সেলফি যাচাই করে অনুমোদন বা প্রত্যাখ্যান করুন।
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {['all', 'pending', 'verified', 'rejected'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setVerifFilter(st)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                        verifFilter === st
                          ? 'bg-brand text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {st === 'all'
                        ? 'সব'
                        : st === 'pending'
                        ? 'পেন্ডিং'
                        : st === 'verified'
                        ? 'ভেরিফাইড'
                        : 'প্রত্যাখ্যাত'}
                    </button>
                  ))}
                </div>
              </div>

              {filteredVerifs.length === 0 ? (
                <p className="text-center py-12 text-xs text-slate-500">
                  কোনো ভেরিফিকেশন রিকোয়েস্ট পাওয়া যায়নি।
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredVerifs.map((req) => (
                    <div
                      key={req.id}
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                            {req.full_name}
                          </span>
                          <span className="text-xs font-bold text-[var(--brand-primary)]">
                            ({req.category_name})
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          মোবাইল: {req.phone} • NID: {req.nid_number} • এলাকা:{' '}
                          {[req.upazila_name, req.district_name, req.division_name]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                            req.status === 'verified'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : req.status === 'rejected'
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          }`}
                        >
                          {req.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => openVerifModal(req)}
                          className="px-4 py-2 bg-brand text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>আইডি ছবি ও যাচাই</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* (c) JOBS MANAGEMENT */}
          {section === 'jobs' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white font-siliguri">
                    সকল জব ম্যানেজমেন্ট ({filteredJobs.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    যেকোনো জব অনুমোদন, নোটসহ প্রত্যাখ্যান, এডিট, ক্লোজ বা ডিলিট করুন।
                  </p>
                </div>

                <select
                  value={jobFilter}
                  onChange={(e) => setJobFilter(e.target.value)}
                  className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                >
                  <option value="all">সকল স্ট্যাটাস</option>
                  <option value="pending_approval">অ্যাডমিন অনুমোদনের অপেক্ষায়</option>
                  <option value="open">ওপেন (Open)</option>
                  <option value="in_progress">ইন-প্রগ্রেস</option>
                  <option value="delivered">ডেলিভারড</option>
                  <option value="completed">সম্পন্ন</option>
                  <option value="rejected">প্রত্যাখ্যাত</option>
                  <option value="closed">বন্ধ (Closed)</option>
                </select>
              </div>

              {filteredJobs.length === 0 ? (
                <p className="text-center py-12 text-xs text-slate-500">কোনো জব পাওয়া যায়নি।</p>
              ) : (
                <div className="space-y-3">
                  {filteredJobs.map((j) => (
                    <div
                      key={j.id}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                            {j.status}
                          </span>
                          <span className="text-xs font-bold text-[var(--brand-primary)]">
                            {j.category}
                          </span>
                          <span className="text-xs text-slate-400">
                            পোস্টকারী: {j.poster?.full_name || j.poster_id.slice(0, 8)}
                          </span>
                        </div>
                        <Link
                          to={`/jobs/${j.id}`}
                          className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white hover:text-[var(--brand-primary)] block"
                        >
                          {j.title}
                        </Link>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {j.status !== 'open' && j.status !== 'completed' && (
                          <button
                            type="button"
                            disabled={busyId === j.id}
                            onClick={() => handleJobQuickAction(j, 'approve')}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg cursor-pointer"
                          >
                            অনুমোদন (Open)
                          </button>
                        )}
                        {j.status !== 'rejected' && (
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingJob(j);
                              setJobRejectNote(j.admin_note || '');
                            }}
                            className="px-3 py-1.5 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 text-xs font-bold rounded-lg cursor-pointer"
                          >
                            প্রত্যাখ্যান
                          </button>
                        )}
                        {j.status !== 'closed' && (
                          <button
                            type="button"
                            disabled={busyId === j.id}
                            onClick={() => handleJobQuickAction(j, 'close')}
                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg cursor-pointer"
                          >
                            বন্ধ করুন
                          </button>
                        )}
                        <Link
                          to={`/jobs/${j.id}/edit`}
                          className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg"
                          title="এডিট"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          type="button"
                          disabled={busyId === j.id}
                          onClick={() => handleDeleteJob(j.id)}
                          className="p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-lg cursor-pointer"
                          title="ডিলিট"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* (d) APPLICATIONS & HIRES */}
          {section === 'applications' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white font-siliguri">
                  আবেদন ও হায়ার তালিকা ({applications.length})
                </h2>
                <p className="text-xs text-slate-500">
                  কে কোন জবে আবেদন করেছেন এবং কাকে হায়ার করা হয়েছে তা দেখুন ও নিয়ন্ত্রণ করুন।
                </p>
              </div>

              {applications.length === 0 ? (
                <p className="text-center py-12 text-xs text-slate-500">কোনো আবেদন পাওয়া যায়নি।</p>
              ) : (
                <div className="space-y-3">
                  {applications.map((app) => (
                    <div
                      key={app.id}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-extrabold text-slate-900 dark:text-white">
                            আবেদনকারী: {app.applicant?.full_name || app.applicant_id.slice(0, 8)}
                          </span>
                          {app.applicant?.is_verified && <VerifiedBadge size="sm" />}
                          <span className="text-[var(--brand-primary)] font-bold">
                            প্রস্তাব: ৳{app.proposed_price} ({app.estimated_days} দিন)
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold">
                            {app.status}
                          </span>
                        </div>
                        <Link
                          to={`/jobs/${app.job_id}`}
                          className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:underline block"
                        >
                          জব: {app.job?.title || app.job_id}
                        </Link>
                        {app.job?.assigned_to && (
                          <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                            ✓ এই জবে হায়ার করা হয়েছে:{' '}
                            {app.job.assignee?.full_name || app.job.assigned_to}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!app.is_admin_approved && (
                          <button
                            type="button"
                            disabled={busyId === app.id}
                            onClick={() => handleApproveApp(app)}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg cursor-pointer"
                          >
                            অ্যাপ্রুভ করুন
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busyId === app.id}
                          onClick={() => handleRemoveApp(app.id)}
                          className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs font-bold rounded-lg inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>মুছুন</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* (e) USERS MANAGEMENT */}
          {section === 'users' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white font-siliguri">
                    ইউজার ম্যানেজমেন্ট ({filteredUsers.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    রোল পরিবর্তন (User/Admin), ম্যানুয়ালি ভেরিফাই/আনভেরিফাই এবং সাসপেন্ড/আনসাসপেন্ড করুন।
                  </p>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="নাম, ইমেইল বা ফোন খুঁজুন..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {filteredUsers.map((u) => {
                  const isVer = Boolean(u.is_verified || u.verification_status === 'verified');
                  return (
                    <div
                      key={u.id}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                            {u.full_name || 'নামবিহীন ইউজার'}
                          </span>
                          {isVer && <VerifiedBadge size="sm" showLabel />}
                          {u.role === 'admin' && (
                            <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 text-[10px] font-black uppercase">
                              ADMIN
                            </span>
                          )}
                          {u.is_suspended && (
                            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-black">
                              SUSPENDED
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {u.email || 'ইমেইল নেই'} • {u.phone || 'ফোন নেই'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={busyId === u.id}
                          onClick={() => handleManualVerifyToggle(u)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                            isVer
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          {isVer ? 'আনভেরিফাই করুন' : '✓ ভেরিফাই করুন'}
                        </button>

                        <button
                          type="button"
                          disabled={busyId === u.id}
                          onClick={() => handleRoleToggle(u)}
                          className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          {u.role === 'admin' ? 'User বানান' : 'Admin বানান'}
                        </button>

                        <button
                          type="button"
                          disabled={busyId === u.id}
                          onClick={() => handleSuspendToggle(u)}
                          className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Ban className="w-3 h-3" />
                          <span>{u.is_suspended ? 'সচল করুন' : 'সাসপেন্ড'}</span>
                        </button>

                        <Link
                          to={`/admin/profiles/${u.id}/edit`}
                          className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg"
                          title="প্রোফাইল এডিট"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* (f) HOME BANNERS SLIDER */}
          {section === 'banners' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white font-siliguri">
                    হোম পেজ ব্যানার স্লাইডার ({banners.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    হোম পেজের উপরের ক্যারোসেল ব্যানার যোগ, সম্পাদনা, ক্রম পরিবর্তন ও সক্রিয়/নিষ্ক্রিয় করুন। (সক্রিয় ব্যানার না থাকলে স্লাইডার স্বয়ংক্রিয়ভাবে লুকানো থাকবে।)
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openNewBannerModal}
                  className="px-4 py-2.5 bg-brand text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>নতুন ব্যানার যোগ করুন</span>
                </button>
              </div>

              {banners.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-500">
                  কোনো ব্যানার যুক্ত করা হয়নি।
                </div>
              ) : (
                <div className="space-y-3">
                  {banners.map((b) => (
                    <div
                      key={b.id}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5">
                        <img
                          src={b.image_url}
                          alt={b.title?.trim() || 'প্রোমোশনাল ব্যানার'}
                          className="w-24 h-14 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                              {b.title?.trim() || 'শিরোনামহীন ব্যানার'}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              #{b.sort_order}
                            </span>
                          </div>
                          {b.subtitle && (
                            <p className="text-xs text-slate-500 line-clamp-1">{b.subtitle}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleReorderBanner(b, -1)}
                          className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                          title="উপরে নিন"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReorderBanner(b, 1)}
                          className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                          title="নিচে নিন"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleBannerActive(b)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                            b.is_active
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {b.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditBannerModal(b)}
                          className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBannerItem(b.id)}
                          className="p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* (g) SITE SETTINGS */}
          {section === 'settings' && (
            <form
              onSubmit={handleSaveSiteSettings}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6"
            >
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white font-siliguri">
                  সাইট সেটিংস, ব্র্যান্ডিং ও থিম কালার
                </h2>
                <p className="text-xs text-slate-500">
                  এখান থেকে পরিবর্তন সংরক্ষণ করলে সাথে সাথে হেডার, ফুটার, ব্রাউজার ট্যাব টাইটেল, ফ্যাভিকন ও সম্পূর্ণ সাইটের রঙ আপডেট হবে।
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    সাইটের নাম (Site Name) *
                  </label>
                  <input
                    type="text"
                    value={siteForm.site_name}
                    onChange={(e) => setSiteForm({ ...siteForm, site_name: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ট্যাগলাইন (Tagline)
                  </label>
                  <input
                    type="text"
                    value={siteForm.tagline}
                    onChange={(e) => setSiteForm({ ...siteForm, tagline: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    হোম হিরো শিরোনাম (Hero Title) *
                  </label>
                  <input
                    type="text"
                    value={siteForm.hero_title}
                    onChange={(e) => setSiteForm({ ...siteForm, hero_title: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    হোম হিরো সাবটাইটেল (Hero Subtitle)
                  </label>
                  <textarea
                    rows={2}
                    value={siteForm.hero_subtitle}
                    onChange={(e) => setSiteForm({ ...siteForm, hero_subtitle: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  />
                </div>
              </div>

              {/* Logo & Favicon Upload */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    সাইট লোগো (Logo Upload)
                  </label>
                  {siteForm.logo_url && (
                    <img
                      src={siteForm.logo_url}
                      alt="Logo"
                      className="h-10 w-auto object-contain rounded"
                    />
                  )}
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-[var(--brand-primary)] cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>
                      {uploadingBrandAsset === 'logo' ? 'আপলোড হচ্ছে...' : 'লোগো আপলোড করুন'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleBrandUpload(e, 'logo')}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    ব্রাউজার ফ্যাভিকন (Favicon Upload)
                  </label>
                  {siteForm.favicon_url && (
                    <img
                      src={siteForm.favicon_url}
                      alt="Favicon"
                      className="h-8 w-8 object-contain rounded"
                    />
                  )}
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-[var(--brand-primary)] cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>
                      {uploadingBrandAsset === 'favicon' ? 'আপলোড হচ্ছে...' : 'ফ্যাভিকন আপলোড করুন'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleBrandUpload(e, 'favicon')}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Colors & Default Theme */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    প্রাইমারি কালার (Primary Color)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={siteForm.primary_color || '#0B63E5'}
                      onChange={(e) => setSiteForm({ ...siteForm, primary_color: e.target.value })}
                      className="h-10 w-14 rounded-lg cursor-pointer border border-slate-200"
                    />
                    <input
                      type="text"
                      value={siteForm.primary_color}
                      onChange={(e) => setSiteForm({ ...siteForm, primary_color: e.target.value })}
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    অ্যাকসেন্ট কালার (Accent Color)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={siteForm.accent_color || '#16A34A'}
                      onChange={(e) => setSiteForm({ ...siteForm, accent_color: e.target.value })}
                      className="h-10 w-14 rounded-lg cursor-pointer border border-slate-200"
                    />
                    <input
                      type="text"
                      value={siteForm.accent_color}
                      onChange={(e) => setSiteForm({ ...siteForm, accent_color: e.target.value })}
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ডিফল্ট থিম (Default Theme)
                  </label>
                  <select
                    value={siteForm.default_theme}
                    onChange={(e) =>
                      setSiteForm({
                        ...siteForm,
                        default_theme: e.target.value as 'light' | 'dark',
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                  >
                    <option value="light">লাইট মোড (Light)</option>
                    <option value="dark">ডার্ক মোড (Dark)</option>
                  </select>
                </div>
              </div>

              {/* Footer & Support Contacts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    সাপোর্ট হোয়াটসঅ্যাপ / ফোন নম্বর
                  </label>
                  <input
                    type="text"
                    value={siteForm.support_whatsapp || siteForm.contact_phone}
                    onChange={(e) =>
                      setSiteForm({
                        ...siteForm,
                        support_whatsapp: e.target.value,
                        contact_phone: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    সাপোর্ট ইমেইল
                  </label>
                  <input
                    type="email"
                    value={siteForm.contact_email}
                    onChange={(e) => setSiteForm({ ...siteForm, contact_email: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ফুটার টেক্সট / পরিচিতি (Footer Text)
                </label>
                <textarea
                  rows={3}
                  value={siteForm.footer_about}
                  onChange={(e) => setSiteForm({ ...siteForm, footer_about: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="px-6 py-3 bg-brand text-white text-xs sm:text-sm font-bold rounded-xl inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingSettings ? 'সংরক্ষণ হচ্ছে...' : 'সাইট সেটিংস সংরক্ষণ করুন'}</span>
              </button>
            </form>
          )}

          {/* (h) RULES TOGGLES */}
          {section === 'rules' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white font-siliguri">
                  মার্কেটপ্লেস রুলস ও অনুমোদন নিয়মাবলি
                </h2>
                <p className="text-xs text-slate-500">
                  জব পোস্ট এবং জবে আবেদনের ক্ষেত্রে ভেরিফিকেশন ও অ্যাডমিন অনুমোদনের শর্তাবলি অন/অফ করুন।
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    key: 'require_job_approval' as const,
                    title: 'নতুন জব পোস্টে অ্যাডমিন অনুমোদন আবশ্যিক (Require admin approval for new jobs)',
                    desc: 'চালু থাকলে ইউজার নতুন জব পোস্ট করলে তা প্রথমে Pending থাকবে এবং অ্যাডমিন অনুমোদন দিলে পাবলিক হবে।',
                  },
                  {
                    key: 'require_application_approval' as const,
                    title: 'জবের আবেদনে অ্যাডমিন অনুমোদন আবশ্যিক (Require admin approval for applications)',
                    desc: 'চালু থাকলে আবেদনকারীর প্রস্তাব অ্যাডমিন অনুমোদন করার পর জব দাতা দেখতে পাবেন। (ডিফল্ট: বন্ধ)',
                  },
                  {
                    key: 'require_verified_to_post_job' as const,
                    title: 'জব পোস্ট করতে ভেরিফাইড প্রোফাইল আবশ্যিক (Require verified profile to post jobs)',
                    desc: 'চালু থাকলে শুধুমাত্র ব্লু-ব্যাজ ভেরিফাইড ইউজাররা নতুন জব পোস্ট করতে পারবেন।',
                  },
                  {
                    key: 'require_verified_to_apply_job' as const,
                    title: 'জবে আবেদন করতে ভেরিফাইড প্রোফাইল আবশ্যিক (Require verified profile to apply)',
                    desc: 'চালু থাকলে শুধুমাত্র ভেরিফাইড পেশাজীবীরা জবে প্রস্তাব পাঠাতে পারবেন।',
                  },
                ].map((rule) => {
                  const enabled = Boolean(siteForm[rule.key]);
                  return (
                    <div
                      key={rule.key}
                      className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {rule.title}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{rule.desc}</p>
                      </div>

                      <button
                        type="button"
                        disabled={savingSettings}
                        onClick={() => handleToggleRule(rule.key)}
                        className={`w-14 h-8 rounded-full transition p-1 cursor-pointer shrink-0 ${
                          enabled ? 'bg-brand' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`block w-6 h-6 rounded-full bg-white shadow transform transition ${
                            enabled ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* POSTS MODERATION (Preserved feature) */}
          {section === 'posts' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h2 className="text-xl font-black text-slate-900 dark:text-white font-siliguri">
                প্রোফাইল পোস্ট মডারেশন ({posts.length})
              </h2>
              {posts.length === 0 ? (
                <p className="text-xs text-slate-500 py-8 text-center">কোনো পোস্ট নেই।</p>
              ) : (
                <div className="space-y-3">
                  {posts.map((p) => (
                    <div
                      key={p.id}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <p className="text-xs text-slate-400">
                          {new Date(p.created_at).toLocaleDateString('bn-BD')}
                        </p>
                        <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                          {p.content}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            await toggleHidePostInDb(p.id, !p.is_hidden);
                            await loadAllAdminData();
                          }}
                          className="px-3 py-1.5 bg-amber-50 text-amber-800 text-xs font-bold rounded-lg cursor-pointer"
                        >
                          {p.is_hidden ? 'দেখান' : 'লুকিয়ে রাখুন'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await deletePostInDb(p.id);
                            await loadAllAdminData();
                          }}
                          className="p-2 bg-rose-50 text-rose-600 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* VERIFICATION REVIEW MODAL (Signed URLs) */}
      {selectedVerif && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full p-6 sm:p-8 border border-slate-200 dark:border-slate-800 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  ভেরিফিকেশন ডকুমেন্ট যাচাই — {selectedVerif.full_name}
                </h3>
                <p className="text-xs text-slate-500">
                  মোবাইল: {selectedVerif.phone} • NID: {selectedVerif.nid_number} • পেশা:{' '}
                  {selectedVerif.category_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVerif(null)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs text-slate-700 dark:text-slate-300">
              <strong>সংক্ষিপ্ত পরিচিতি:</strong> {selectedVerif.short_bio}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'আইডি সামনের অংশ', url: verifSignedUrls.front },
                { label: 'আইডি পেছনের অংশ', url: verifSignedUrls.back },
                { label: 'সেলফি', url: verifSignedUrls.selfie },
              ].map((doc) => (
                <div key={doc.label} className="space-y-1.5">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{doc.label}</p>
                  {doc.url ? (
                    <a href={doc.url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={doc.url}
                        alt={doc.label}
                        className="w-full h-44 object-cover rounded-2xl border border-slate-200 dark:border-slate-700"
                      />
                    </a>
                  ) : (
                    <div className="w-full h-44 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs text-slate-400">
                      লোড হচ্ছে...
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                প্রত্যাখ্যানের কারণ (শুধুমাত্র Reject করার ক্ষেত্রে আবশ্যিক)
              </label>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="যেমন: NID কার্ডের লেখা অস্পষ্ট, অনুগ্রহ করে পরিষ্কার ছবি দিন"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={busyId === selectedVerif.id}
                onClick={() => handleVerifDecision('reject')}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span>প্রত্যাখ্যান করুন (Reject)</span>
              </button>
              <button
                type="button"
                disabled={busyId === selectedVerif.id}
                onClick={() => handleVerifDecision('approve')}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>অনুমোদন ও ভেরিফাই করুন (Approve)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JOB REJECT MODAL */}
      {rejectingJob && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              জব প্রত্যাখ্যানের নোট লিখুন
            </h3>
            <textarea
              rows={3}
              value={jobRejectNote}
              onChange={(e) => setJobRejectNote(e.target.value)}
              placeholder="কেন জবটি অনুমোদিত হয়নি তা সংক্ষেপে লিখুন..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectingJob(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-xs font-bold rounded-xl cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={confirmRejectJob}
                className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                প্রত্যাখ্যান নিশ্চিত করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BANNER ADD/EDIT MODAL */}
      {bannerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveBannerForm}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {editingBannerId ? 'ব্যানার সম্পাদনা করুন' : 'নতুন হোম ব্যানার যোগ করুন'}
              </h3>
              <button
                type="button"
                onClick={() => setBannerModalOpen(false)}
                className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">ব্যানার শিরোনাম (ঐচ্ছিক)</label>
              <input
                type="text"
                value={bTitle}
                onChange={(e) => setBTitle(e.target.value)}
                placeholder="শিরোনাম দিন (খালি রাখলে শুধু ছবি দেখাবে)"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">সাবটাইটেল (ঐচ্ছিক)</label>
              <input
                type="text"
                value={bSubtitle}
                onChange={(e) => setBSubtitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold">ডেস্কটপ ব্যানার ছবি *</label>
                <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 dark:bg-blue-950/40 text-[var(--brand-primary)] rounded-xl text-xs font-bold cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingBannerImg ? 'আপলোড হচ্ছে...' : 'ছবি আপলোড'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleBannerImageUpload(e, 'desktop')}
                    className="hidden"
                  />
                </label>
                <input
                  type="text"
                  value={bImageUrl}
                  onChange={(e) => setBImageUrl(e.target.value)}
                  placeholder="অথবা ছবির URL"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold">মোবাইল ব্যানার ছবি (ঐচ্ছিক)</label>
                <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>মোবাইল ছবি</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleBannerImageUpload(e, 'mobile')}
                    className="hidden"
                  />
                </label>
                <input
                  type="text"
                  value={bMobileImageUrl}
                  onChange={(e) => setBMobileImageUrl(e.target.value)}
                  placeholder="মোবাইল ছবির URL (ঐচ্ছিক)"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">লিংক URL (ঐচ্ছিক)</label>
                <input
                  type="text"
                  value={bLinkUrl}
                  onChange={(e) => setBLinkUrl(e.target.value)}
                  placeholder="/jobs অথবা https://..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">বাটন টেক্সট</label>
                <input
                  type="text"
                  value={bButtonText}
                  onChange={(e) => setBButtonText(e.target.value)}
                  placeholder="বিস্তারিত দেখুন"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">ক্রম (Order)</label>
                <input
                  type="number"
                  value={bSortOrder}
                  onChange={(e) => setBSortOrder(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">শুরু তারিখ</label>
                <input
                  type="date"
                  value={bStartDate}
                  onChange={(e) => setBStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">শেষ তারিখ</label>
                <input
                  type="date"
                  value={bEndDate}
                  onChange={(e) => setBEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={bIsActive}
                onChange={(e) => setBIsActive(e.target.checked)}
              />
              <span>ব্যানারটি সক্রিয় (Active) রাখুন</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBannerModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-xs font-bold rounded-xl cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={busyId === 'banner-save'}
                className="px-5 py-2.5 bg-brand text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                ব্যানার সংরক্ষণ করুন
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
