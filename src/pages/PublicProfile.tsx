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
} from 'lucide-react';
import {
  fetchPublicProfileById,
  fetchPostsForProfile,
  fetchSiteSettings,
  normalizeBn,
  toEnglishDigits,
} from '../lib/supabase';
import type { PublicProfile as PublicProfileType, Post, SiteSettings } from '../types/database';
import { Avatar } from '../components/Avatar';
import { useToast } from '../components/Toast';

export const PublicProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();

  const [profile, setProfile] = useState<PublicProfileType | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [p, postList, setts] = await Promise.all([
          fetchPublicProfileById(id),
          fetchPostsForProfile(id),
          fetchSiteSettings(),
        ]);

        setProfile(p);
        setPosts(Array.isArray(postList) ? postList : []);
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
      <div className="max-w-6xl mx-auto px-4 py-12 space-y-6">
        <div className="bg-slate-100 dark:bg-slate-800 h-80 rounded-3xl animate-pulse"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-100 dark:bg-slate-800 h-64 rounded-3xl animate-pulse"></div>
          <div className="lg:col-span-2 bg-slate-100 dark:bg-slate-800 h-64 rounded-3xl animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          প্রোফাইলটি পাওয়া যায়নি
        </h2>
        <p className="text-sm text-slate-500">
          প্রোফাইলটি অনুমোদনের অপেক্ষায় থাকতে পারে, মুছে ফেলা হয়েছে অথবা লিংকটি সঠিক নয়।
        </p>
        <Link
          to="/professionals"
          className="inline-block px-6 py-2.5 bg-teal-800 text-white font-bold text-xs rounded-xl shadow-md"
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

  const isSurveyor = normProfName === normalizeBn('সার্ভেয়ার') || profile.profession_id === 'prof-1';
  const isDeedWriter = normProfName === normalizeBn('দলিল লেখক') || profile.profession_id === 'prof-2';
  const isAdvocateOrBarrister =
    normProfName === normalizeBn('এডভোকেট') ||
    normProfName === normalizeBn('ব্যারিস্টার') ||
    profile.profession_id === 'prof-3' ||
    profile.profession_id === 'prof-5';

  const areaParts = [profile.upazila_name, profile.district_name, profile.division_name].filter(Boolean);
  const areaDisplay = areaParts.length > 0 ? areaParts.join(', ') : profile.address_detail || 'বাংলাদেশ';
  const fullAddressDisplay = [profile.address_detail, ...areaParts].filter(Boolean).join(', ') || 'বাংলাদেশ';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Cover + Header Hero Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        <div className="h-48 sm:h-64 bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 relative">
          {profile.cover_photo_url && (
            <img
              src={profile.cover_photo_url}
              alt="Cover"
              className="w-full h-full object-cover opacity-50"
            />
          )}

          <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="px-4 py-2 bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-bold rounded-xl border border-white/20 backdrop-blur-md flex items-center gap-2 transition-colors shadow-lg cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-teal-400" />
              <span>শেয়ার করুন</span>
            </button>
          </div>
        </div>

        <div className="px-6 sm:px-10 pb-8 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-16 sm:-mt-20 mb-6">
            <div className="relative inline-block">
              <Avatar
                src={profile.profile_photo_url}
                name={profile.full_name}
                size="xl"
                className="w-28 h-28 sm:w-36 sm:h-36 ring-4 ring-white dark:ring-slate-900 shadow-2xl"
              />
              {profile.is_verified && (
                <div className="absolute bottom-1 right-1 bg-emerald-500 text-white p-1.5 rounded-full border-2 border-white dark:border-slate-900 shadow-md">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <span className="bg-teal-800 text-white text-xs font-bold px-4 py-1.5 rounded-xl shadow-sm">
                {profile.profession_name || 'পেশাজীবী'}
              </span>
              <span className="bg-slate-900 text-teal-300 font-mono text-xs font-bold px-3 py-1.5 rounded-xl border border-teal-500/30">
                আইডি: #{formattedSerial}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-siliguri">
                {profile.full_name}
              </h1>
              {profile.is_verified && (
                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <ShieldCheck className="w-4 h-4" />
                  যাচাইকৃত
                </span>
              )}
            </div>

            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{fullAddressDisplay}</span>
            </p>

            {profile.bio && (
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed pt-2 max-w-3xl">
                {profile.bio}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main Content 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Intro & Profession Extra Info */}
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
            <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <User className="w-5 h-5 text-teal-600" />
              <span>ইনফোগ্রাফি (Intro)</span>
            </h3>

            <div className="space-y-3 text-xs sm:text-sm font-medium">
              <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800">
                <span className="text-slate-500">ইউজার আইডি:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">#{formattedSerial}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800">
                <span className="text-slate-500">পেশা:</span>
                <span className="font-bold text-teal-700 dark:text-teal-400">{profile.profession_name}</span>
              </div>

              <div className="flex justify-between gap-4 py-1 border-b border-slate-50 dark:border-slate-800">
                <span className="text-slate-500 shrink-0">এলাকা:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-200 text-right">
                  {areaDisplay}
                </span>
              </div>

              {profile.phone && (
                <div className="pt-2 space-y-2">
                  <a
                    href={`tel:${cleanPhoneDigits || profile.phone}`}
                    className="w-full py-3 px-4 bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <Phone className="w-4 h-4" />
                    <span>কল করুন ({profile.phone})</span>
                  </a>

                  {cleanPhoneDigits && (
                    <a
                      href={`https://wa.me/${cleanPhoneDigits.startsWith('88') ? cleanPhoneDigits : `88${cleanPhoneDigits}`}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md"
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
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
            <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-teal-600" />
              <span>পেশাগত বিস্তারিত তথ্য</span>
            </h3>

            {/* SURVEYOR EXTRA INFO */}
            {isSurveyor && (
              <div className="space-y-4 text-xs">
                {extra.cert_year && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">সনদ প্রাপ্তির সাল:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{extra.cert_year}</span>
                  </div>
                )}

                {extra.cert_issuer && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">সনদ প্রদানকারী প্রতিষ্ঠান:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{extra.cert_issuer}</span>
                  </div>
                )}

                {extra.surveyor_type && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">সার্ভেয়ারের ধরন:</span>
                    <span className="inline-block bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-bold px-3 py-1 rounded-lg">
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
                      <Layers className="w-3.5 h-3.5 text-teal-600" />
                      ব্যবহৃত প্রযুক্তি:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {extra.technologies.map((tech: string) => (
                        <span
                          key={tech}
                          className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold px-2.5 py-1 rounded-lg"
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
                      <Wrench className="w-3.5 h-3.5 text-teal-600" />
                      ব্যবহৃত যন্ত্রপাতি:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {extra.equipment.map((eq: string) => (
                        <span
                          key={eq}
                          className="bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-semibold px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800"
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
                    <span className="font-bold text-slate-900 dark:text-slate-100">{extra.experience_years}</span>
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
                    <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">{extra.bar_council_no}</span>
                  </div>
                )}
                {extra.court && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">আদালত:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{extra.court}</span>
                  </div>
                )}
                {extra.specialization && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">বিশেষজ্ঞতা:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{extra.specialization}</span>
                  </div>
                )}
                {extra.experience_years && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">অভিজ্ঞতা:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{extra.experience_years}</span>
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
                    <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">{extra.license_no}</span>
                  </div>
                )}
                {extra.sub_registry_office && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">সাব-রেজিস্ট্রি অফিস:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{extra.sub_registry_office}</span>
                  </div>
                )}
                {extra.experience_years && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">অভিজ্ঞতা:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{extra.experience_years}</span>
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
                    <span className="font-bold text-slate-900 dark:text-slate-100">{extra.appointment_year}</span>
                  </div>
                )}
                {extra.court && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">আদালত:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{extra.court}</span>
                  </div>
                )}
                {extra.specialization && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">বিশেষজ্ঞতা:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{extra.specialization}</span>
                  </div>
                )}
                {extra.qualification && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">যোগ্যতা:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{extra.qualification}</span>
                  </div>
                )}
                {extra.experience_years && (
                  <div>
                    <span className="text-slate-500 block mb-0.5">অভিজ্ঞতা:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{extra.experience_years}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Posts Feed */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md">
            <h3 className="font-bold text-xl text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600" />
                <span>পোস্টসমূহ</span>
              </span>
              <span className="text-xs text-slate-500 font-normal">
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
                        <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
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
                      <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-light whitespace-pre-line">
                        {post.content}
                      </p>
                    )}

                    {post.image_url && (
                      <div className="rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 max-h-96 bg-slate-950">
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
        </div>
      </div>
    </div>
  );
};
