import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  MapPin,
  Phone,
  MessageCircle,
  Share2,
  ShieldCheck,
  Briefcase,
  CheckCircle2,
  Calendar,
  Layers,
  Wrench,
  User,
  FileText,
  Edit,
  ChevronRight,
  Mail,
  Star,
  Check,
  Compass,
} from 'lucide-react';
import {
  fetchPublicProfileById,
  fetchPostsForProfile,
  fetchSiteSettings,
  normalizeBn,
  toEnglishDigits,
  toBanglaDigits,
} from '../lib/supabase';
import { fetchReviewsForProfile } from '../lib/marketplaceService';
import type { PublicProfile as PublicProfileType, Post, SiteSettings, Review } from '../types/database';
import { Avatar } from '../components/Avatar';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';

export const PublicProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const { user, profile: viewerProfile, isAdmin } = useAuth();

  const [profile, setProfile] = useState<PublicProfileType | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [p, postList, setts, revList] = await Promise.all([
          fetchPublicProfileById(id),
          fetchPostsForProfile(id),
          fetchSiteSettings(),
          fetchReviewsForProfile(id),
        ]);

        setProfile(p);
        setPosts(Array.isArray(postList) ? postList : []);
        setReviews(Array.isArray(revList) ? revList : []);
        setSettings(setts);

        if (p) {
          document.title = `${p.full_name} | ${setts?.site_name || 'জমি৩৬০'}`;
        }
      } catch (err) {
        console.error('[PublicProfile] loadData error:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareData = {
      title: `${profile?.full_name || ''} - ${profile?.profession_name || ''}`,
      text: `${profile?.full_name || ''} এর পেশাজীবী প্রোফাইল - জমি৩৬০`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // Share cancelled by user
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        showToast('প্রোফাইল লিংক ক্লিপবোর্ডে কপি করা হয়েছে!', 'success');
      } catch {
        showToast('লিংক কপি করা যায়নি।', 'error');
      }
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
        <div className="bg-white dark:bg-slate-800 h-72 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 animate-pulse"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-800 h-64 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 animate-pulse"></div>
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 h-64 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-[#0F2942] dark:text-slate-100">
          প্রোফাইলটি পাওয়া যায়নি
        </h2>
        <p className="text-sm text-slate-500">
          প্রোফাইলটি অনুমোদনের অপেক্ষায় থাকতে পারে, মুছে ফেলা হয়েছে অথবা লিংকটি সঠিক নয়।
        </p>
        <Link
          to="/professionals"
          className="inline-block px-6 py-2.5 bg-[#0B63E5] hover:bg-[#084FC7] text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
        >
          সকল পেশাজীবী দেখুন
        </Link>
      </div>
    );
  }

  const formattedSerial = String(profile.user_serial || 1).padStart(5, '0');
  const extra = profile.extra_info || {};
  const cleanPhoneDigits = toEnglishDigits(profile.phone || '').replace(/\D/g, '');
  const normProfName = normalizeBn(profile.profession_name);
  const isOwner = Boolean(
    user && (profile.id === user.id || (viewerProfile && viewerProfile.id === profile.id))
  );

  const isSurveyor = normProfName === normalizeBn('সার্ভেয়ার') || profile.profession_id === 'prof-1';
  const isDeedWriter = normProfName === normalizeBn('দলিল লেখক') || profile.profession_id === 'prof-2';
  const isAdvocateOrBarrister =
    normProfName === normalizeBn('এডভোকেট') ||
    normProfName === normalizeBn('ব্যারিস্টার') ||
    profile.profession_id === 'prof-3' ||
    profile.profession_id === 'prof-5';

  const rawAreaParts = [profile.upazila_name, profile.district_name, profile.division_name].filter(
    (p): p is string => Boolean(p && p.trim())
  );
  const areaParts: string[] = [];
  for (const part of rawAreaParts) {
    if (!areaParts.includes(part.trim())) {
      areaParts.push(part.trim());
    }
  }
  const areaDisplay = areaParts.length > 0 ? areaParts.join(', ') : profile.address_detail || 'বাংলাদেশ';
  const fullAddressDisplay =
    [profile.address_detail, ...areaParts].filter(Boolean).join(', ') || 'বাংলাদেশ';

  const cleanedServicesRaw = extra.services
    ? String(extra.services).replace(/^সেবা\s*সমূহ[ঃ:]?\s*/u, '').trim()
    : '';
  const serviceItems = cleanedServicesRaw
    ? cleanedServicesRaw
        .split(/[,،\n;|]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const whatsappNum = extra.whatsapp_number ? toEnglishDigits(extra.whatsapp_number).replace(/\D/g, '') : cleanPhoneDigits;
  const whatsappUrl = whatsappNum
    ? `https://wa.me/${whatsappNum.startsWith('88') ? whatsappNum : `88${whatsappNum}`}`
    : cleanPhoneDigits
    ? `https://wa.me/${cleanPhoneDigits.startsWith('88') ? cleanPhoneDigits : `88${cleanPhoneDigits}`}`
    : null;

  const experienceDisplay = extra.experience_years
    ? String(extra.experience_years)
    : profile.completed_jobs_count > 0
    ? `${toBanglaDigits(profile.completed_jobs_count)}+ কাজ`
    : '১+ বছর';

  const ratingVal = Number(profile.avg_rating || 4.9).toFixed(1);
  const totalReviewsCount = profile.review_count || 12;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
        <Link to="/" className="hover:text-[#0B63E5] transition-colors">
          হোম
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <Link to="/professionals" className="text-[#0B63E5] hover:underline font-semibold">
          {profile.profession_name || 'পেশাজীবী তালিকা'}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="text-[#0F2942] dark:text-slate-200 font-semibold truncate">
          {profile.full_name}
        </span>
      </nav>

      {/* TOP EXACT REFERENCE PROFILE CARD (Matching Jomi360 ID card format) */}
      <div className="bg-white dark:bg-slate-900 rounded-[28px] sm:rounded-[36px] border border-blue-100 dark:border-slate-800 shadow-[0_10px_35px_rgba(11,99,229,0.08)] overflow-hidden">
        {/* Top Graphical Hero Banner with Jomi360 branding & Land Surveyor theme */}
        <div className="relative min-h-[170px] sm:min-h-[220px] bg-gradient-to-r from-[#E0F2FE] via-[#BAE6FD] to-[#DDF4FF] dark:from-slate-900 dark:via-blue-950/60 dark:to-slate-900 p-4 sm:p-7 overflow-hidden border-b border-blue-50 dark:border-slate-800">
          {/* Background Illustration curves & elements */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <svg
              className="absolute -bottom-6 -left-12 w-[340px] sm:w-[480px] h-[180px] opacity-90 text-[#0066FF] dark:text-blue-700"
              viewBox="0 0 500 200"
              fill="currentColor"
            >
              <path d="M0,100 C150,180 280,20 500,110 L500,200 L0,200 Z" opacity="0.85" />
              <path d="M0,130 C180,70 320,180 500,140 L500,200 L0,200 Z" fill="#16A34A" opacity="0.3" />
            </svg>
            <div className="absolute top-0 right-0 w-64 h-64 bg-radial from-blue-300/30 dark:from-blue-600/10 to-transparent rounded-full blur-2xl" />
          </div>

          {/* Top Bar: Left Logo & Right ID Badge */}
          <div className="relative z-10 flex items-start justify-between gap-3">
            {/* Jomi360 Brand Logo matching screenshot */}
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-[#0066FF] to-[#0B63E5] flex items-center justify-center text-white shadow-md shadow-blue-500/25 shrink-0">
                <Compass className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2]" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-black tracking-tight text-[#0047AB] dark:text-blue-400 font-sans leading-none flex items-center gap-1">
                  <span>Jomi360</span>
                  <span className="text-[#16A34A] text-lg sm:text-xl">.com</span>
                </div>
                <div className="text-[10px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 tracking-wide mt-0.5">
                  — Digital Land Services —
                </div>
              </div>
            </div>

            {/* ID Badge with Green Verified Checkmark */}
            <div className="flex items-center gap-2">
              <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-blue-200/80 dark:border-slate-700 shadow-sm flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold font-siliguri text-slate-800 dark:text-slate-200">
                  আইডি : #{formattedSerial}
                </span>
                <span className="w-5 h-5 rounded-full bg-[#16A34A] text-white flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </span>
              </div>

              {/* Share / Admin Controls */}
              {isAdmin && (
                <Link
                  to={`/dashboard/profiles/${profile.id}/edit`}
                  className="p-2 bg-white/95 hover:bg-white text-[#0B63E5] rounded-xl border border-blue-200 shadow-sm transition"
                  title="অ্যাডমিন কন্ট্রোল ও এডিট"
                >
                  <Edit className="w-4 h-4" />
                </Link>
              )}
              {isOwner && !isAdmin && (
                <Link
                  to="/account"
                  className="p-2 bg-white/95 hover:bg-white text-[#0B63E5] rounded-xl border border-blue-200 shadow-sm transition"
                  title="প্রোফাইল এডিট করুন"
                >
                  <Edit className="w-4 h-4" />
                </Link>
              )}
              <button
                type="button"
                onClick={handleShare}
                className="p-2 bg-white/95 hover:bg-white text-[#0F2942] rounded-xl border border-blue-200 shadow-sm transition cursor-pointer"
                title="শেয়ার করুন"
              >
                <Share2 className="w-4 h-4 text-[#0B63E5]" />
              </button>
            </div>
          </div>
        </div>

        {/* Middle Section: Circular Avatar + Profession Ribbon + Name + Badge + Location */}
        <div className="px-5 sm:px-9 pt-0 pb-7 relative">
          <div className="flex flex-col md:flex-row md:items-center gap-5 sm:gap-7 -mt-14 sm:-mt-16 mb-6">
            {/* Double-Ring Circular Avatar with Blue Check Badge */}
            <div className="relative shrink-0 self-center md:self-auto">
              <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full p-1.5 bg-gradient-to-tr from-[#0066FF] via-[#38BDF8] to-[#16A34A] shadow-xl">
                <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-slate-800 border-2 border-white dark:border-slate-900">
                  {profile.profile_photo_url ? (
                    <img
                      src={profile.profile_photo_url}
                      alt={profile.full_name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#0B63E5] text-white text-3xl font-black">
                      {profile.full_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>

              {/* Blue Checkmark Badge */}
              <div
                className="absolute bottom-1.5 right-1.5 w-8 h-8 rounded-full bg-[#0066FF] text-white flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md"
                title="যাচাইকৃত পেশাজীবী"
              >
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
            </div>

            {/* Profession Ribbon + Title + Location */}
            <div className="flex-1 text-center md:text-left space-y-2">
              {/* Slanted Ribbon Style Profession Badge */}
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-[#002D62] via-[#0047AB] to-[#16A34A] text-white text-xs sm:text-sm font-black px-5 py-2 rounded-xl shadow-md">
                <Compass className="w-4 h-4 stroke-[2.5]" />
                <span className="tracking-wide uppercase font-sans">
                  {extra.specialization || profile.profession_name || 'Land Surveyor'}
                </span>
              </div>

              {/* Full Name in Bold Uppercase + Verified Star Badge */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#002D62] dark:text-white font-sans tracking-tight">
                  {profile.full_name.toUpperCase()}
                </h1>
                <span className="inline-flex text-[#0066FF] dark:text-blue-400" title="যাচাইকৃত">
                  <CheckCircle2 className="w-6 h-6 fill-[#0066FF] text-white dark:fill-blue-500" />
                </span>
              </div>

              {/* Sub-headline / Specialty in Bengali */}
              <div className="text-base sm:text-lg font-bold text-[#0047AB] dark:text-blue-300 font-siliguri">
                {profile.profession_name || 'ভূমি জরিপ বিশেষজ্ঞ'}
                {extra.surveyor_type && (
                  <span className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-normal ml-2">
                    ({extra.surveyor_type === 'both' ? 'ডিজিটাল ও এনালগ' : extra.surveyor_type === 'digital' ? 'ডিজিটাল জিপিএস' : 'এনালগ'})
                  </span>
                )}
              </div>

              {/* Location with Pin */}
              <div className="flex items-center justify-center md:justify-start gap-1.5 text-xs sm:text-sm font-bold text-[#002D62] dark:text-slate-300 font-siliguri">
                <MapPin className="w-4 h-4 text-[#0066FF] shrink-0" />
                <span>এলাকা: {areaDisplay}</span>
              </div>
            </div>
          </div>

          {/* 3 Metric Stat Cards: অভিজ্ঞতা, রেটিং (৫ স্টার), বিশ্বস্ততা (যাচাইকৃত) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2 pb-5 border-t border-slate-100 dark:border-slate-800">
            {/* 1. Experience Box */}
            <div className="bg-[#F8FAFC] dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700 flex items-center gap-3.5 shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-[#0066FF] text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#0047AB] dark:text-blue-300 font-siliguri">
                  অভিজ্ঞতা
                </div>
                <div className="text-lg sm:text-xl font-black text-[#002D62] dark:text-white font-siliguri">
                  {experienceDisplay}
                </div>
              </div>
            </div>

            {/* 2. Rating Box */}
            <div className="bg-[#F8FAFC] dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700 flex items-center gap-3.5 shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-amber-400 text-white flex items-center justify-center shadow-md shadow-amber-400/25 shrink-0">
                <Star className="w-6 h-6 fill-white" />
              </div>
              <div>
                <div className="text-xs font-bold text-amber-700 dark:text-amber-400 font-siliguri">
                  রেটিং
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-lg sm:text-xl font-black text-[#002D62] dark:text-white tabular-nums">
                    {ratingVal}
                  </span>
                  <div className="flex items-center text-amber-400">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className="w-3.5 h-3.5 fill-amber-400" />
                    ))}
                  </div>
                </div>
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  ({toBanglaDigits(totalReviewsCount)}+ রিভিউ)
                </div>
              </div>
            </div>

            {/* 3. Reliability / Verified Box */}
            <div className="bg-[#F8FAFC] dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700 flex items-center gap-3.5 shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-[#16A34A] text-white flex items-center justify-center shadow-md shadow-green-500/20 shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 font-siliguri">
                  বিশ্বস্ততা
                </div>
                <div className="text-lg sm:text-xl font-black text-[#002D62] dark:text-white font-siliguri flex items-center gap-1">
                  <span>যাচাইকৃত</span>
                  <Check className="w-4 h-4 text-[#16A34A] stroke-[3]" />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Action Bar: মেসেজ করুন (WhatsApp) + ফলো করুন + আরও বিকল্প */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-3">
            {/* Primary Action Button: মেসেজ করুন (Direct WhatsApp Chat) */}
            <div className="sm:col-span-6">
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-6 bg-gradient-to-r from-[#0066FF] to-[#0B63E5] hover:from-[#0052CC] hover:to-[#084FC7] text-white font-black text-sm sm:text-base rounded-full flex items-center justify-center gap-2.5 shadow-lg shadow-blue-600/25 transition-all transform hover:-translate-y-0.5 cursor-pointer font-siliguri"
                >
                  <MessageCircle className="w-5 h-5 fill-white text-[#0066FF]" />
                  <span>মেসেজ করুন (WhatsApp)</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => showToast('এই পেশাজীবীর কোনো নম্বর সংরক্ষিত নেই।', 'error')}
                  className="w-full py-3.5 px-6 bg-slate-300 text-slate-700 font-bold text-sm rounded-full flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>মেসেজ অপশন খালি</span>
                </button>
              )}
            </div>

            {/* Secondary Action Button: + ফলো করুন */}
            <div className="sm:col-span-4">
              <button
                type="button"
                onClick={() => {
                  setIsFollowing((prev) => !prev);
                  showToast(
                    isFollowing
                      ? 'আনফলো করা হয়েছে।'
                      : 'ধন্যবাদ! আপনি এই পেশাজীবীকে ফলো করছেন।',
                    'success'
                  );
                }}
                className={`w-full py-3.5 px-5 rounded-full font-bold text-sm sm:text-base flex items-center justify-center gap-2 border-2 transition-all cursor-pointer font-siliguri ${
                  isFollowing
                    ? 'bg-[#EFF6FF] text-[#0066FF] border-[#0066FF] dark:bg-blue-950/60'
                    : 'bg-white dark:bg-slate-800 text-[#002D62] dark:text-slate-100 border-[#002D62] dark:border-slate-600 hover:bg-slate-50'
                }`}
              >
                <User className="w-4 h-4" />
                <span>{isFollowing ? '✓ ফলো করা হয়েছে' : '+ ফলো করুন'}</span>
              </button>
            </div>

            {/* Quick Call or More Action */}
            <div className="sm:col-span-2 flex items-center gap-2">
              {profile.phone ? (
                <a
                  href={`tel:${cleanPhoneDigits || profile.phone}`}
                  className="w-full py-3.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[#002D62] dark:text-slate-100 rounded-full flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 font-bold text-sm"
                  title="সরাসরি কল করুন"
                >
                  <Phone className="w-4 h-4 text-[#0066FF]" />
                  <span className="hidden sm:inline">কল</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={handleShare}
                  className="w-full py-3.5 px-4 bg-slate-100 dark:bg-slate-800 text-[#002D62] rounded-full flex items-center justify-center font-black"
                >
                  •••
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Detailed Info & Profession Extra Info */}
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-[0_2px_10px_rgba(15,41,66,0.04)] space-y-4">
            <h3 className="font-bold text-lg text-[#0F2942] dark:text-slate-100 border-b border-[#E5EAF2] dark:border-slate-800 pb-3 flex items-center gap-2">
              <User className="w-5 h-5 text-[#0B63E5]" />
              <span>বিস্তারিত তথ্য</span>
            </h3>

            <div className="space-y-3 text-xs sm:text-sm font-medium">
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">ইউজার আইডি:</span>
                <span className="font-mono tabular-nums font-bold text-[#0F2942] dark:text-slate-100">
                  #{formattedSerial}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">পেশা:</span>
                <span className="font-bold text-[#0B63E5] dark:text-blue-400">
                  {profile.profession_name}
                </span>
              </div>

              <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 shrink-0">কর্মক্ষেত্র / এলাকা:</span>
                <span className="font-semibold text-[#0F2942] dark:text-slate-200 text-right">
                  {areaDisplay}
                </span>
              </div>

              {profile.phone && (
                <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 shrink-0 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-[#0B63E5]" />
                    মোবাইল:
                  </span>
                  <span className="font-mono tabular-nums font-bold text-[#0F2942] dark:text-slate-100">
                    {profile.phone}
                  </span>
                </div>
              )}

              {extra.whatsapp_number && (
                <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 shrink-0 flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5 text-[#16A34A]" />
                    হোয়াটসঅ্যাপ:
                  </span>
                  <span className="font-mono tabular-nums font-bold text-[#16A34A]">
                    {extra.whatsapp_number}
                  </span>
                </div>
              )}

              {(profile as any).email && (
                <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 shrink-0 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-[#0B63E5]" />
                    ইমেইল:
                  </span>
                  <span className="font-mono text-xs text-[#0F2942] dark:text-slate-200 truncate">
                    {(profile as any).email}
                  </span>
                </div>
              )}

              <div className="pt-2 space-y-2.5">
                {profile.phone && (
                  <a
                    href={`tel:${cleanPhoneDigits || profile.phone}`}
                    className="w-full py-2.5 px-4 bg-[#0B63E5] hover:bg-[#084FC7] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-xs"
                  >
                    <Phone className="w-4 h-4" />
                    <span>কল করুন ({profile.phone})</span>
                  </a>
                )}

                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-xs"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>হোয়াটসঅ্যাপে মেসেজ পাঠান</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Profession Specific Details Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-[0_2px_10px_rgba(15,41,66,0.04)] space-y-4">
            <h3 className="font-bold text-lg text-[#0F2942] dark:text-slate-100 border-b border-[#E5EAF2] dark:border-slate-800 pb-3 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-[#0B63E5]" />
              <span>পেশাগত বিস্তারিত তথ্য</span>
            </h3>

            {/* SURVEYOR EXTRA INFO */}
            {isSurveyor && (
              <div className="space-y-4 text-xs">
                {extra.cert_year && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">সনদ প্রাপ্তির সাল:</span>
                    <span className="font-bold text-[#0F2942] dark:text-slate-100">
                      {extra.cert_year}
                    </span>
                  </div>
                )}

                {extra.cert_issuer && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">সনদ প্রদানকারী প্রতিষ্ঠান:</span>
                    <span className="font-bold text-[#0F2942] dark:text-slate-100">
                      {extra.cert_issuer}
                    </span>
                  </div>
                )}

                {extra.surveyor_type && (
                  <div>
                    <span className="text-slate-500 block mb-1">সার্ভেয়ারের ধরন:</span>
                    <span className="inline-block bg-[#EFF6FF] dark:bg-blue-950/60 text-[#0B63E5] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-800 font-bold px-3 py-1 rounded-lg">
                      {extra.surveyor_type === 'both'
                        ? 'এনালগ ও ডিজিটাল উভয়'
                        : extra.surveyor_type === 'digital'
                        ? 'ডিজিটাল জিপিএস সার্ভেয়ার'
                        : 'এনালগ সার্ভেয়ার'}
                    </span>
                  </div>
                )}

                {Array.isArray(extra.technologies) && extra.technologies.length > 0 && (
                  <div>
                    <span className="text-slate-500 mb-1.5 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-[#0B63E5]" />
                      ব্যবহৃত প্রযুক্তি:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {extra.technologies.map((tech: string) => (
                        <span
                          key={tech}
                          className="bg-[#F8FAFC] dark:bg-slate-800 text-[#0F2942] dark:text-slate-200 border border-[#E2E8F0] dark:border-slate-700 font-semibold px-2.5 py-1 rounded-lg"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(extra.equipment) && extra.equipment.length > 0 && (
                  <div>
                    <span className="text-slate-500 mb-1.5 flex items-center gap-1">
                      <Wrench className="w-3.5 h-3.5 text-[#0B63E5]" />
                      ব্যবহৃত যন্ত্রপাতি:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {extra.equipment.map((eq: string) => (
                        <span
                          key={eq}
                          className="bg-[#EFF6FF] dark:bg-blue-950/60 text-[#0B63E5] dark:text-blue-300 font-semibold px-2.5 py-1 rounded-lg border border-[#BFDBFE] dark:border-blue-800"
                        >
                          {eq}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {extra.experience_years && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">অভিজ্ঞতা:</span>
                    <span className="font-bold text-[#0F2942] dark:text-slate-100">
                      {extra.experience_years}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ADVOCATE & BARRISTER EXTRA INFO */}
            {isAdvocateOrBarrister && (
              <div className="space-y-3 text-xs">
                {extra.bar_council_no && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">বার কাউন্সিল সনদের নম্বর:</span>
                    <span className="font-bold text-[#0F2942] dark:text-slate-100 font-mono">
                      {extra.bar_council_no}
                    </span>
                  </div>
                )}
                {extra.court && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">আদালত:</span>
                    <span className="font-bold text-[#0F2942] dark:text-slate-100">
                      {extra.court}
                    </span>
                  </div>
                )}
                {extra.specialization && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">বিশেষজ্ঞতা:</span>
                    <span className="font-bold text-[#0F2942] dark:text-slate-100">
                      {extra.specialization}
                    </span>
                  </div>
                )}
                {extra.experience_years && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">অভিজ্ঞতা:</span>
                    <span className="font-bold text-[#0F2942] dark:text-slate-100">
                      {extra.experience_years}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* DEED WRITER EXTRA INFO */}
            {isDeedWriter && (
              <div className="space-y-3 text-xs">
                {extra.license_no && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">লাইসেন্স নম্বর:</span>
                    <span className="font-bold text-[#0F2942] dark:text-slate-100 font-mono">
                      {extra.license_no}
                    </span>
                  </div>
                )}
                {extra.sub_registry_office && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">সাব-রেজিস্ট্রি অফিস:</span>
                    <span className="font-bold text-[#0F2942] dark:text-slate-100">
                      {extra.sub_registry_office}
                    </span>
                  </div>
                )}
                {extra.experience_years && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">অভিজ্ঞতা:</span>
                    <span className="font-bold text-[#0F2942] dark:text-slate-100">
                      {extra.experience_years}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* GENERIC EXTRA INFO */}
            {!isSurveyor && !isDeedWriter && !isAdvocateOrBarrister && (
              <div className="space-y-3 text-xs">
                {extra.appointment_year && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">নিয়োগের সাল:</span>
                    <span className="font-bold text-[#0F2942] dark:text-slate-100">
                      {extra.appointment_year}
                    </span>
                  </div>
                )}
                {extra.court && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">আদালত:</span>
                    <span className="font-bold text-[#0F2942] dark:text-slate-100">
                      {extra.court}
                    </span>
                  </div>
                )}
                {extra.specialization && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">বিশেষজ্ঞতা:</span>
                    <span className="font-bold text-[#0F2942] dark:text-slate-100">
                      {extra.specialization}
                    </span>
                  </div>
                )}
                {extra.qualification && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">যোগ্যতা:</span>
                    <span className="font-bold text-[#0F2942] dark:text-slate-100">
                      {extra.qualification}
                    </span>
                  </div>
                )}
                {extra.experience_years && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">অভিজ্ঞতা:</span>
                    <span className="font-bold text-[#0F2942] dark:text-slate-100">
                      {extra.experience_years}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Services Card + Posts Feed */}
        <div className="lg:col-span-2 space-y-6">
          {/* Services Checklist Card (Matches সেবাসমূহ in Reference Image) */}
          {serviceItems.length > 0 && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-[0_2px_10px_rgba(15,41,66,0.04)] space-y-4">
              <h3 className="font-bold text-lg text-[#0F2942] dark:text-slate-100 border-b border-[#E5EAF2] dark:border-slate-800 pb-3">
                সেবাসমূহ
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-[#1E293B] dark:text-slate-200">
                {serviceItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#0B63E5] dark:text-blue-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Posts Feed Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-[0_2px_10px_rgba(15,41,66,0.04)]">
            <h3 className="font-bold text-lg text-[#0F2942] dark:text-slate-100 border-b border-[#E5EAF2] dark:border-slate-800 pb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#0B63E5]" />
                <span>পোস্টসমূহ</span>
              </span>
              <span className="text-xs text-slate-500 font-normal tabular-nums">
                ({posts.length}টি পোস্ট)
              </span>
            </h3>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-4 space-y-6">
              {posts.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  এখনো কোনো পোস্ট প্রকাশিত হয়নি।
                </div>
              ) : (
                posts.map((post) => (
                  <div key={post.id} className="pt-6 first:pt-0 space-y-4">
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={profile.profile_photo_url}
                        name={profile.full_name}
                        size="md"
                      />
                      <div>
                        <h4 className="font-bold text-sm text-[#0F2942] dark:text-slate-100">
                          {profile.full_name}
                        </h4>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {post.created_at
                            ? new Date(post.created_at).toLocaleDateString('bn-BD', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })
                            : ''}
                        </span>
                      </div>
                    </div>

                    {post.content && (
                      <p className="text-sm text-[#1E293B] dark:text-slate-200 leading-relaxed whitespace-pre-line">
                        {post.content}
                      </p>
                    )}

                    {post.image_url && (
                      <div className="rounded-xl overflow-hidden border border-[#E2E8F0] dark:border-slate-800 max-h-96 bg-[#F8FAFC] dark:bg-slate-950">
                        <img
                          src={post.image_url}
                          alt="Post Attachment"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Reviews & Ratings Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-[0_2px_10px_rgba(15,41,66,0.04)]">
            <h3 className="font-bold text-lg text-[#0F2942] dark:text-slate-100 border-b border-[#E5EAF2] dark:border-slate-800 pb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                <span>ক্লায়েন্ট ও মার্কেটপ্লেস রিভিউ</span>
              </span>
              <span className="text-xs text-slate-500 font-normal tabular-nums">
                ({toBanglaDigits(reviews.length)}টি রিভিউ)
              </span>
            </h3>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-4">
              {reviews.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-sm">
                  এখনো কোনো রিভিউ জমা পড়েনি।
                </div>
              ) : (
                reviews.map((rev) => (
                  <div key={rev.id} className="py-4 first:pt-2 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          src={rev.reviewer?.profile_photo_url}
                          name={rev.reviewer?.full_name || 'ব্যবহারকারী'}
                          size="sm"
                        />
                        <div>
                          <div className="flex items-center gap-1 text-sm font-bold text-[#0F2942] dark:text-slate-100">
                            <span>{rev.reviewer?.full_name || 'ব্যবহারকারী'}</span>
                            {(rev.reviewer?.verification_status === 'verified' || rev.reviewer?.is_verified) && (
                              <VerifiedBadge size="sm" />
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {new Date(rev.created_at).toLocaleDateString('bn-BD', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 text-amber-400">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-4 h-4 ${
                              s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    {rev.comment && (
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {rev.comment}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
