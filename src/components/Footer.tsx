import React, { useState, useEffect } from 'react';
import { Compass, CheckCircle2, User, Mail, Phone, MapPin, MessageCircle } from 'lucide-react';
import { fetchSiteSettings } from '../lib/supabase';
import type { SiteSettings } from '../types/database';

export const Footer: React.FC = () => {
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    fetchSiteSettings().then(setSettings);
  }, []);

  // Convert Gregorian year to Bengali numerals (e.g. 2026 -> ২০২৬)
  const currentYearBn = new Date()
    .getFullYear()
    .toString()
    .replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[parseInt(d, 10)]);

  const siteTitle = settings?.site_name || 'জমি৩৬০';
  const siteTitleEn = settings?.site_name_en || 'Jomi360';

  return (
    <footer className="mt-20 pb-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Large Rounded Glass Card Footer Container */}
      <div className="bg-slate-900 text-slate-100 rounded-[2.5rem] p-8 sm:p-12 border border-slate-800 shadow-2xl relative overflow-hidden">
        {/* Background Subtle Gradient Blobs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-12 pb-10 border-b border-slate-800">
          
          {/* Column 1: Brand & Description */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-slate-950 shadow-lg shadow-teal-500/20">
                <Compass className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-2xl font-black tracking-tight font-siliguri text-white">{siteTitle}</h3>
                <p className="text-xs text-teal-400 font-semibold tracking-wider uppercase">{siteTitleEn}</p>
              </div>
            </div>

            <p className="text-sm text-slate-400 leading-relaxed font-light">
              {settings?.footer_about ||
                'বাংলাদেশের সর্ববৃহৎ পেশাজীবী ডিরেক্টরি। জমিজমা সংক্রান্ত যেকোনো কাজে আপনার এলাকার সঠিক ও অভিজ্ঞ সার্ভেয়ার, আইনি পরামর্শক ও দলিল লেখক সহজেই খুঁজুন।'}
            </p>
          </div>

          {/* Column 2: Our Features Checklist */}
          <div className="space-y-4">
            <h4 className="text-lg font-bold text-white border-b border-teal-500/30 pb-2 inline-block">
              আমাদের বৈশিষ্ট্য
            </h4>
            <ul className="space-y-3 text-sm text-slate-300">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                <span>যাচাইকৃত সার্ভেয়ার, দলিল লেখক ও আইনজীবী</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                <span>নিজের এলাকার পেশাজীবী সহজে খোঁজার সুবিধা</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                <span>বিভাগ, জেলা ও উপজেলাভিত্তিক সার্চ</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                <span>অ্যাডমিন দ্বারা যাচাইকৃত নিরাপদ প্রোফাইল</span>
              </li>
            </ul>
          </div>

          {/* Column 3: Contact & Owner Info */}
          <div className="space-y-4">
            <h4 className="text-lg font-bold text-white border-b border-teal-500/30 pb-2 inline-block">
              যোগাযোগ
            </h4>

            <div className="space-y-3 text-sm text-slate-300">
              {/* Owner Name & Designation */}
              {settings?.owner_name && (
                <div className="flex items-start gap-3 bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                  <User className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-white text-sm">{settings.owner_name}</h5>
                    {settings.owner_designation && (
                      <p className="text-xs text-slate-400">{settings.owner_designation}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Email */}
              {settings?.contact_email && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <a
                    href={`mailto:${settings.contact_email}`}
                    className="hover:text-teal-300 transition-colors text-xs font-mono"
                  >
                    {settings.contact_email}
                  </a>
                </div>
              )}

              {/* Phone & WhatsApp */}
              {settings?.contact_phone && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${settings.contact_phone}`}
                      className="hover:text-teal-300 transition-colors text-xs font-mono font-bold"
                    >
                      {settings.contact_phone}
                    </a>
                    <a
                      href={`https://wa.me/88${settings.contact_phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors"
                      title="হোয়াটসঅ্যাপে মেসেজ পাঠান"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              )}

              {/* Address */}
              {settings?.contact_address && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <span className="text-xs text-slate-300">{settings.contact_address}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Copyright */}
        <div className="pt-8 text-center text-xs text-slate-500">
          <p>© {currentYearBn} {siteTitle}। সর্বস্বত্ব সংরক্ষিত।</p>
        </div>
      </div>
    </footer>
  );
};
