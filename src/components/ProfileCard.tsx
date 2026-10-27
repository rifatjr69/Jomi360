import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, CheckCircle2, ShieldCheck, ArrowRight, Edit, Trash2 } from 'lucide-react';
import { Avatar } from './Avatar';
import { ConfirmModal } from './ConfirmModal';
import type { PublicProfile } from '../types/database';
import { useAuth } from '../context/AuthContext';
import { adminDeleteProfile } from '../lib/supabase';
import { useToast } from './Toast';

interface ProfileCardProps {
  profile: PublicProfile;
  onDeleted?: (id: string) => void;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({ profile, onDeleted }) => {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const formattedSerial = String(profile?.user_serial || 1).padStart(5, '0');
  const locationParts = [profile?.upazila_name, profile?.district_name, profile?.division_name].filter(Boolean);
  const locationDisplay = locationParts.length > 0 ? locationParts.join(', ') : profile?.address_detail || 'বাংলাদেশ';

  return (
    <>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden flex flex-col group">
        {/* Top Banner Gradient */}
        <div className="h-20 bg-gradient-to-r from-teal-800 via-teal-700 to-teal-600 relative p-3">
          {profile?.cover_photo_url && (
            <img
              src={profile.cover_photo_url}
              alt="Cover"
              className="w-full h-full object-cover absolute inset-0 opacity-40 mix-blend-overlay"
            />
          )}
          <div className="relative z-10 flex justify-between items-start">
            {isAdmin && (
              <div className="flex items-center gap-1.5">
                <Link
                  to={`/dashboard/profiles/${profile.id}/edit`}
                  className="bg-white/90 text-teal-800 p-1.5 rounded-lg shadow-sm hover:bg-white transition-colors"
                  title="প্রোফাইল এডিট করুন"
                >
                  <Edit className="w-4 h-4" />
                </Link>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsConfirmOpen(true);
                  }}
                  className="bg-white/90 text-rose-600 p-1.5 rounded-lg shadow-sm hover:bg-white transition-colors cursor-pointer"
                  title="প্রোফাইল ডিলিট করুন"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
            <span className="bg-slate-900/80 text-teal-300 text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full border border-teal-500/30 backdrop-blur-sm ml-auto">
              আইডি: #{formattedSerial}
            </span>
          </div>
        </div>

        {/* Avatar & Header Info */}
        <div className="px-5 pt-0 pb-4 flex-1 flex flex-col -mt-10 relative">
          <div className="flex items-end justify-between mb-3">
            <div className="relative">
              <Avatar
                src={profile?.profile_photo_url}
                name={profile?.full_name || 'পেশাজীবী'}
                size="lg"
                className="ring-4 ring-white dark:ring-slate-900 shadow-md"
              />
              {profile?.is_verified && (
                <div
                  className="absolute bottom-0 right-0 bg-emerald-500 text-white rounded-full p-1 border-2 border-white dark:border-slate-900 shadow-sm"
                  title="যাচাইকৃত পেশাজীবী"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
            </div>

            <span className="bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 text-xs font-semibold px-3 py-1 rounded-lg border border-teal-200 dark:border-teal-800/60">
              {profile?.profession_name || 'পেশাজীবী'}
            </span>
          </div>

          {/* Name and Title */}
          <div className="mb-2">
            <Link to={`/profile/${profile.id}`}>
              <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors flex items-center gap-1.5 line-clamp-1">
                {profile?.full_name || 'নাম নেই'}
              </h3>
            </Link>
            {profile?.is_verified && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                অ্যাডমিন যাচাইকৃত প্রোফাইল
              </span>
            )}
          </div>

          {/* Location */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 mb-3 mt-auto">
            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span className="line-clamp-1">এলাকা: {locationDisplay}</span>
          </div>

          {/* Bio excerpt */}
          {profile?.bio && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-4">
              {profile.bio}
            </p>
          )}

          {/* Action Button */}
          <Link
            to={`/profile/${profile.id}`}
            className="w-full mt-2 py-2.5 px-4 bg-teal-800 hover:bg-teal-900 dark:bg-teal-700 dark:hover:bg-teal-600 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm group-hover:shadow-md"
          >
            <span>প্রোফাইল দেখুন</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>

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
    </>
  );
};
