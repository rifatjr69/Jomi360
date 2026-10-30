import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Check, ArrowRight, Edit, Trash2, Compass, Star } from 'lucide-react';
import { Avatar } from './Avatar';
import { ConfirmModal } from './ConfirmModal';
import { VerifiedBadge } from './VerifiedBadge';
import type { PublicProfile } from '../types/database';
import { useAuth } from '../context/AuthContext';
import { adminDeleteProfile, normalizeBn, toBanglaDigits } from '../lib/supabase';
import { useToast } from './Toast';

interface ProfileCardProps {
  profile: PublicProfile;
  onDeleted?: (id: string) => void;
  isPreview?: boolean;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  onDeleted,
  isPreview = false,
}) => {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [coverError, setCoverError] = useState(false);

  useEffect(() => {
    setCoverError(false);
  }, [profile?.cover_photo_url]);

  const formattedSerial = String(profile?.user_serial || 1).padStart(5, '0');
  const isVerified = profile?.verification_status === 'verified' || Boolean(profile?.is_verified);

  const rawLocationParts = [
    profile?.upazila_name,
    profile?.district_name,
    profile?.division_name,
  ].filter(Boolean) as string[];

  const uniqueLocationParts: string[] = [];
  rawLocationParts.forEach((part) => {
    const clean = part.trim();
    if (
      clean &&
      !uniqueLocationParts.some((existing) => normalizeBn(existing) === normalizeBn(clean))
    ) {
      uniqueLocationParts.push(clean);
    }
  });

  const locationDisplay =
    uniqueLocationParts.length > 0
      ? uniqueLocationParts.join(', ')
      : profile?.address_detail || 'বাংলাদেশ';

  const rawServices = (profile?.extra_info?.services || '').trim();
  const rawBio = (profile?.bio || '').trim();
  const summaryText = rawServices
    ? rawServices.startsWith('সেবা')
      ? rawServices
      : `সেবা সমূহঃ ${rawServices}`
    : rawBio;

  return (
    <>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-[0_2px_10px_rgba(15,41,66,0.05)] hover:shadow-[0_8px_24px_rgba(11,99,229,0.12)] hover:border-[#BFDBFE] dark:hover:border-blue-800 transition-all duration-200 hover:-translate-y-0.5 overflow-hidden flex flex-col group">
        {/* Top Cover Banner */}
        <div
          className="h-28 relative p-3.5 overflow-hidden"
          style={{
            background: 'linear-gradient(90deg, var(--brand-primary), var(--brand-primary-hover))',
          }}
        >
          {profile?.cover_photo_url && !coverError ? (
            <>
              <img
                src={profile.cover_photo_url}
                alt="Cover"
                referrerPolicy="no-referrer"
                onError={() => setCoverError(true)}
                className="w-full h-full object-cover absolute inset-0"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-slate-950/20" />
            </>
          ) : (
            <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
              <div className="absolute -right-6 -bottom-8 opacity-15 text-white">
                <Compass className="w-32 h-32" />
              </div>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.22),transparent_60%)]" />
            </div>
          )}

          <div className="relative z-10 flex justify-between items-start gap-2">
            {isAdmin && !isPreview && (
              <div className="flex items-center gap-1.5">
                <Link
                  to={`/admin/profiles/${profile.id}/edit`}
                  className="bg-white/95 text-[var(--brand-primary)] p-1.5 rounded-lg border border-blue-200 shadow-xs hover:bg-blue-50 transition-colors"
                  title="প্রোফাইল কন্ট্রোল ও এডিট করুন"
                >
                  <Edit className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsConfirmOpen(true);
                  }}
                  className="bg-white/95 text-red-600 p-1.5 rounded-lg border border-red-200 shadow-xs hover:bg-red-50 transition-colors cursor-pointer"
                  title="প্রোফাইল ডিলিট করুন"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <span className="bg-white/95 dark:bg-slate-900/90 text-[#0F2942] dark:text-blue-300 text-xs font-mono tabular-nums font-bold px-3 py-1 rounded-full border border-blue-100 dark:border-blue-800/60 shadow-xs ml-auto">
              আইডি: #{formattedSerial}
            </span>
          </div>
        </div>

        {/* Avatar, Profession Label & Card Body */}
        <div className="px-5 pt-0 pb-5 flex-1 flex flex-col relative">
          <div className="flex items-end justify-between -mt-11 mb-3.5">
            <div className="relative">
              <div className="rounded-full p-0.5 bg-white dark:bg-slate-900 shadow-md">
                <Avatar
                  src={profile?.profile_photo_url}
                  name={profile?.full_name || 'পেশাজীবী'}
                  size="card"
                  className="ring-2 ring-white dark:ring-slate-800"
                />
              </div>
              {isVerified && (
                <div
                  className="absolute bottom-0.5 right-0.5 bg-brand text-white rounded-full w-6 h-6 flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm"
                  title="ভেরিফাইড প্রোফাইল"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </div>

            <span className="bg-[#EFF6FF] dark:bg-blue-950/60 text-[var(--brand-primary)] dark:text-blue-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-[#BFDBFE] dark:border-blue-800/60">
              {profile?.profession_name || 'পেশাজীবী'}
            </span>
          </div>

          {/* Full Name + Blue Verified Badge + Star Rating */}
          <div className="mb-2">
            {isPreview ? (
              <h3 className="font-extrabold text-lg sm:text-[19px] tracking-tight text-[#0F2942] dark:text-white leading-snug flex items-center gap-1.5">
                <span className="line-clamp-1">{profile?.full_name || 'আপনার নাম'}</span>
                {isVerified && <VerifiedBadge size="md" />}
              </h3>
            ) : (
              <Link to={`/profile/${profile.id}`} className="inline-flex items-center gap-1.5 max-w-full">
                <h3 className="font-extrabold text-lg sm:text-[19px] tracking-tight text-[#0F2942] dark:text-white group-hover:text-[var(--brand-primary)] dark:group-hover:text-blue-400 transition-colors leading-snug line-clamp-1">
                  {profile?.full_name || 'নাম নেই'}
                </h3>
                {isVerified && <VerifiedBadge size="md" />}
              </Link>
            )}

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
              {isVerified && (
                <span className="font-semibold text-[var(--brand-primary)] dark:text-blue-400">
                  ভেরিফাইড পেশাজীবী
                </span>
              )}
              {(profile?.review_count > 0 || profile?.completed_jobs_count > 0) && (
                <>
                  {isVerified && <span aria-hidden="true">·</span>}
                  {profile.review_count > 0 && (
                    <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {toBanglaDigits(Number(profile.avg_rating || 0).toFixed(1))} ({toBanglaDigits(profile.review_count)})
                    </span>
                  )}
                  {profile.completed_jobs_count > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        সম্পন্ন জব: {toBanglaDigits(profile.completed_jobs_count)}টি
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Location Row */}
          <div className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-[#334155] dark:text-slate-300 mb-2.5">
            <MapPin className="w-4 h-4 text-[var(--brand-primary)] dark:text-blue-400 shrink-0" />
            <span className="line-clamp-1">এলাকা: {locationDisplay}</span>
          </div>

          {/* Services / Bio Excerpt */}
          {summaryText && (
            <p className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-4">
              {summaryText}
            </p>
          )}

          {/* Action CTA Button */}
          <div className="mt-auto pt-1">
            {isPreview ? (
              <div className="w-full py-2.5 px-4 bg-brand text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs select-none">
                <span>প্রোফাইল দেখুন</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            ) : (
              <Link
                to={`/profile/${profile.id}`}
                className="w-full py-2.5 px-4 bg-brand text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <span>প্রোফাইল দেখুন</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {!isPreview && (
        <ConfirmModal
          isOpen={isConfirmOpen}
          onClose={() => setIsConfirmOpen(false)}
          title="প্রোফাইল ডিলিট করুন"
          message={`আপনি কি নিশ্চিত যে ${profile?.full_name || ''} এর প্রোফাইল ডিলিট করতে চান?`}
          confirmText="হ্যাঁ, ডিলিট করুন"
          cancelText="বাতিল"
          isDanger={true}
          onConfirm={async () => {
            try {
              await adminDeleteProfile(profile.id);
              showToast('প্রোফাইল সফলভাবে মুছে ফেলা হয়েছে।', 'success');
              if (onDeleted) {
                onDeleted(profile.id);
              } else {
                window.location.reload();
              }
            } catch (err: any) {
              showToast(err.message || 'প্রোফাইল মুছে ফেলতে সমস্যা হয়েছে।', 'error');
            }
          }}
        />
      )}
    </>
  );
};
