import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, CheckCircle2, User, Mail, Phone, MapPin, MessageCircle } from 'lucide-react';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { toEnglishDigits } from '../lib/supabase';

export const Footer: React.FC = () => {
  const { settings } = useSiteSettings();

  const currentYearBn = new Date()
    .getFullYear()
    .toString()
    .replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[parseInt(d, 10)]);

  const siteTitle = settings.site_name || 'জমি৩৬০';
  const tagline = settings.tagline || settings.site_name_en || 'পেশাজীবী ডিরেক্টরি ও মার্কেটপ্লেস';
  const whatsappNumber = toEnglishDigits(settings.support_whatsapp || settings.contact_phone || '').replace(/\D/g, '');

  return (
    <footer className="mt-16 border-t border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-12 pb-10 border-b border-[#E5EAF2] dark:border-slate-800">
          {/* Column 1: Brand & Description */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {settings.logo_url ? (
                <img
                  src={settings.logo_url}
                  alt={siteTitle}
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-xl object-contain bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1"
                />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-brand flex items-center justify-center text-white shadow-sm">
                  <Compass className="w-6 h-6" />
                </div>
              )}
              <div>
                <h3 className="text-2xl font-black tracking-tight font-siliguri text-[#0F2942] dark:text-white">
                  {siteTitle}
                </h3>
                <p className="text-xs text-[var(--brand-primary)] dark:text-blue-400 font-semibold">
                  {tagline}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {settings.footer_about ||
                'বাংলাদেশের বিশ্বস্ত পেশাজীবী ডিরেক্টরি ও জব মার্কেটপ্লেস। জমিজমা সংক্রান্ত যেকোনো কাজে আপনার এলাকার সঠিক ও ভেরিফাইড সার্ভেয়ার, আইনি পরামর্শক ও দলিল লেখক সহজেই খুঁজুন।'}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <Link to="/professionals" className="hover:text-[var(--brand-primary)] transition-colors">
                পেশাজীবী তালিকা
              </Link>
              <span aria-hidden="true">·</span>
              <Link to="/jobs" className="hover:text-[var(--brand-primary)] transition-colors">
                জব মার্কেটপ্লেস
              </Link>
              <span aria-hidden="true">·</span>
              <Link to="/verify" className="hover:text-[var(--brand-primary)] transition-colors">
                প্রোফাইল ভেরিফিকেশন
              </Link>
            </div>
          </div>

          {/* Column 2: Our Features Checklist */}
          <div className="space-y-4">
            <h4 className="text-base font-bold text-[#0F2942] dark:text-white border-b-2 border-[var(--brand-primary)] pb-1.5 inline-block">
              আমাদের বৈশিষ্ট্য
            </h4>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[var(--brand-primary)] dark:text-blue-400 shrink-0 mt-0.5" />
                <span>অ্যাডমিন যাচাইকৃত সার্ভেয়ার, দলিল লেখক ও আইনজীবী</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[var(--brand-primary)] dark:text-blue-400 shrink-0 mt-0.5" />
                <span>জব পোস্ট ও পেশাজীবী হায়ার করার নিরাপদ মার্কেটপ্লেস</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[var(--brand-primary)] dark:text-blue-400 shrink-0 mt-0.5" />
                <span>বিভাগ, জেলা ও উপজেলাভিত্তিক সার্চ ও ফিল্টার</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[var(--brand-primary)] dark:text-blue-400 shrink-0 mt-0.5" />
                <span>কাজ শেষে যাচাইকৃত স্টার রেটিং ও রিভিউ সুবিধা</span>
              </li>
            </ul>
          </div>

          {/* Column 3: Contact & Support Info */}
          <div className="space-y-4">
            <h4 className="text-base font-bold text-[#0F2942] dark:text-white border-b-2 border-[var(--brand-primary)] pb-1.5 inline-block">
              সাপোর্ট ও যোগাযোগ
            </h4>

            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              {settings.owner_name && (
                <div className="flex items-start gap-3 bg-[#F8FAFC] dark:bg-slate-800/60 p-3 rounded-xl border border-[#E2E8F0] dark:border-slate-700/60">
                  <User className="w-5 h-5 text-[var(--brand-primary)] dark:text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-[#0F2942] dark:text-white text-sm">
                      {settings.owner_name}
                    </h5>
                    {settings.owner_designation && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {settings.owner_designation}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {settings.contact_email && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] dark:bg-blue-950/60 text-[var(--brand-primary)] dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <a
                    href={`mailto:${settings.contact_email}`}
                    className="hover:text-[var(--brand-primary)] transition-colors text-xs font-mono text-[#1E293B] dark:text-slate-300"
                  >
                    {settings.contact_email}
                  </a>
                </div>
              )}

              {(settings.contact_phone || settings.support_whatsapp) && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] dark:bg-blue-950/60 text-[var(--brand-primary)] dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {settings.contact_phone && (
                      <a
                        href={`tel:${settings.contact_phone}`}
                        className="hover:text-[var(--brand-primary)] transition-colors text-xs font-mono tabular-nums font-bold text-[#0F2942] dark:text-slate-200"
                      >
                        {settings.contact_phone}
                      </a>
                    )}
                    {whatsappNumber && (
                      <a
                        href={`https://wa.me/${whatsappNumber.startsWith('88') ? whatsappNumber : `88${whatsappNumber}`}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-accent text-white rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>হোয়াটসঅ্যাপ সাপোর্ট</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {settings.contact_address && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] dark:bg-blue-950/60 text-[var(--brand-primary)] dark:text-blue-400 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <span className="text-xs text-slate-600 dark:text-slate-300">
                    {settings.contact_address}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="pt-6 text-center text-xs text-slate-500">
          <p>
            © {currentYearBn} {siteTitle}। সর্বস্বত্ব সংরক্ষিত।
          </p>
        </div>
      </div>
    </footer>
  );
};
