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

      {/* Cover + Header Hero Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-[0_2px_12px_rgba(15,41,66,0.05)] overflow-hidden">
        <div className="h-40 sm:h-56 bg-gradient-to-r from-[#0B63E5] via-[#1D6AE5] to-[#2563EB] relative">
          {profile.cover_photo_url ? (
            <img
              src={profile.cover_photo_url}
              alt="Cover"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.22),transparent_65%)]" />
          )}

          <div className="absolute top-4 right-4 z-10 flex flex-wrap items-center gap-2">
            {isAdmin && (
              <Link
                to={`/dashboard/profiles/${profile.id}/edit`}
                className="px-3.5 py-2 bg-white/95 hover:bg-white text-[#0B63E5] text-xs font-bold rounded-xl border border-blue-200 flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Edit className="w-4 h-4" />
                <span>অ্যাডমিন কন্ট্রোল ও এডিট</span>
              </Link>
            )}
            {isOwner && !isAdmin && (
              <Link
                to="/account"
                className="px-3.5 py-2 bg-white/95 hover:bg-white text-[#0B63E5] text-xs font-bold rounded-xl border border-blue-200 flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Edit className="w-4 h-4" />
                <span>প্রোফাইল এডিট করুন</span>
              </Link>
            )}
            <button
              type="button"
              onClick={handleShare}
              className="px-3.5 py-2 bg-white/95 hover:bg-white text-[#0F2942] text-xs font-bold rounded-xl border border-[#E2E8F0] flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-[#0B63E5]" />
              <span>শেয়ার করুন</span>
            </button>
          </div>
        </div>

        <div className="px-6 sm:px-8 pb-7 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-14 sm:-mt-16 mb-5">
            <div className="relative inline-block">
              <Avatar
                src={profile.profile_photo_url}
                name={profile.full_name}
                size="xl"
                className="w-28 h-28 sm:w-32 sm:h-32 ring-4 ring-white dark:ring-slate-900 shadow-lg"
              />
              {profile.is_verified && (
                <div className="absolute bottom-1 right-1 bg-[#16A34A] text-white p-1.5 rounded-full border-2 border-white dark:border-slate-900 shadow-sm">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <span className="bg-[#EFF6FF] dark:bg-blue-950/60 text-[#0B63E5] dark:text-blue-300 text-xs font-bold px-3.5 py-1.5 rounded-lg border border-[#BFDBFE] dark:border-blue-800">
                {profile.profession_name || 'পেশাজীবী'}
              </span>
              <span className="bg-[#F8FAFC] dark:bg-slate-800 text-[#0F2942] dark:text-slate-200 font-mono tabular-nums text-xs font-bold px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-slate-700">
                আইডি: #{formattedSerial}
              </span>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="space-y-2.5 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-[#0F2942] dark:text-white font-siliguri flex items-center gap-2">
                  <span>{profile.full_name}</span>
                  {(profile.verification_status === 'verified' || profile.is_verified) && (
                    <VerifiedBadge size="lg" />
                  )}
                </h1>
                {(profile.verification_status === 'verified' || profile.is_verified) && (
                  <span className="inline-flex items-center gap-1.5 bg-[#EFF6FF] text-[var(--brand-primary)] dark:bg-blue-950/60 dark:text-blue-300 text-xs font-bold px-3 py-1 rounded-full border border-[#BFDBFE] dark:border-blue-800">
                    <ShieldCheck className="w-4 h-4" />
                    <span>ভেরিফাইড</span>
                  </span>
                )}
              </div>

              {(profile.review_count > 0 || profile.completed_jobs_count > 0) && (
                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {profile.review_count > 0 && (
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold tabular-nums">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <span>
                        {toBanglaDigits(Number(profile.avg_rating || 0).toFixed(1))} ({toBanglaDigits(profile.review_count)}টি রিভিউ)
                      </span>
                    </span>
                  )}
                  {profile.review_count > 0 && profile.completed_jobs_count > 0 && (
                    <span aria-hidden="true">·</span>
                  )}
                  {profile.completed_jobs_count > 0 && (
                    <span className="tabular-nums">
                      সম্পন্ন কাজ: {toBanglaDigits(profile.completed_jobs_count)}টি
                    </span>
                  )}
                </div>
              )}

              <p className="text-sm font-medium text-[#334155] dark:text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[var(--brand-primary)] dark:text-blue-400 shrink-0" />
                <span>{fullAddressDisplay}</span>
              </p>

              {profile.bio && (
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed pt-1 max-w-3xl">
                  {profile.bio}
                </p>
              )}
            </div>

            {/* Quick Header Action Buttons (Matches Reference Layout: Royal Blue Primary + Solid Green WhatsApp) */}
            {profile.phone && (
              <div className="flex flex-wrap items-center gap-3 shrink-0 pt-1">
                <a
                  href={`tel:${cleanPhoneDigits || profile.phone}`}
                  className="px-5 py-2.5 bg-[#0B63E5] hover:bg-[#084FC7] text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm shadow-blue-600/15"
                >
                  <Phone className="w-4 h-4" />
                  <span>কল করুন</span>
                </a>

                {cleanPhoneDigits && (
                  <a
                    href={`https://wa.me/${
                      cleanPhoneDigits.startsWith('88') ? cleanPhoneDigits : `88${cleanPhoneDigits}`
                    }`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm shadow-green-600/15"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>
            )}
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

              {profile.phone && (
                <div className="pt-2 space-y-2.5">
                  <a
                    href={`tel:${cleanPhoneDigits || profile.phone}`}
                    className="w-full py-2.5 px-4 bg-[#0B63E5] hover:bg-[#084FC7] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-xs"
                  >
                    <Phone className="w-4 h-4" />
                    <span>কল করুন ({profile.phone})</span>
                  </a>

                  {cleanPhoneDigits && (
                    <a
                      href={`https://wa.me/${
                        cleanPhoneDigits.startsWith('88') ? cleanPhoneDigits : `88${cleanPhoneDigits}`
                      }`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-xs"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>হোয়াটসঅ্যাপে মেসেজ পাঠান</span>
                    </a>
                  )}
                </div>
              )}
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
