import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  MapPin,
  ArrowRight,
  UserPlus,
  Compass,
  CheckCircle2,
  Sparkles,
  RotateCcw,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  fetchSiteSettings,
  fetchProfessions,
  fetchDivisions,
  fetchDistricts,
  fetchUpazilas,
  fetchPublicProfiles,
  getSupabaseConfigError,
  normalizeBn,
} from '../lib/supabase';
import type {
  SiteSettings,
  Profession,
  Division,
  District,
  Upazila,
  PublicProfile,
} from '../types/database';
import { ProfileCard } from '../components/ProfileCard';
import { ListingSection } from '../components/ListingSection';
import { useAuth } from '../context/AuthContext';
import { resolveLocationNames } from '../lib/supabase';

const DIVISION_CANONICAL_ORDER = [
  'ঢাকা',
  'চট্টগ্রাম',
  'রাজশাহী',
  'খুলনা',
  'বরিশাল',
  'সিলেট',
  'রংপুর',
  'ময়মনসিংহ',
];

export const Home: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile: authProfile } = useAuth();

  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [upazilas, setUpazilas] = useState<Upazila[]>([]);

  const [allProfiles, setAllProfiles] = useState<PublicProfile[]>([]);
  const [filteredProfiles, setFilteredProfiles] = useState<PublicProfile[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingFiltered, setLoadingFiltered] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(getSupabaseConfigError());

  // Cascading Location + Profession + Search Filter States
  const [divisionId, setDivisionId] = useState<string>(searchParams.get('division_id') || '');
  const [districtId, setDistrictId] = useState<string>(searchParams.get('district_id') || '');
  const [upazilaId, setUpazilaId] = useState<string>(searchParams.get('upazila_id') || '');
  const [selectedProfessionId, setSelectedProfessionId] = useState<string>(
    searchParams.get('profession_id') || 'all'
  );
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState<string>(searchParams.get('search') || '');

  // 400ms Debounce for Search Input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Initial Load: Settings, Professions, Divisions, and Approved Profiles
  const loadInitialData = useCallback(async () => {
    setLoadingInitial(true);
    const configErr = getSupabaseConfigError();
    if (configErr) {
      setErrorMessage(configErr);
    } else {
      setErrorMessage(null);
    }

    try {
      const [s, p, d, profs] = await Promise.all([
        fetchSiteSettings(),
        fetchProfessions(),
        fetchDivisions(),
        fetchPublicProfiles({ limit: 500, throwOnError: !configErr }),
      ]);

      setSettings(s);
      setProfessions(Array.isArray(p) ? p : []);
      setDivisions(Array.isArray(d) ? d : []);
      setAllProfiles(Array.isArray(profs) ? profs : []);
    } catch (err: any) {
      console.error('[Home] loadInitialData error:', err);
      setErrorMessage(err.message || 'ডাটাবেস থেকে তথ্য লোড করতে সমস্যা হয়েছে।');
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load Districts when Division changes
  useEffect(() => {
    if (!divisionId) {
      setDistricts([]);
      return;
    }
    fetchDistricts(divisionId)
      .then((list) => setDistricts(Array.isArray(list) ? list : []))
      .catch((err) => console.error('[Home] fetchDistricts error:', err));
  }, [divisionId]);

  // Load Upazilas when District changes
  useEffect(() => {
    if (!districtId) {
      setUpazilas([]);
      return;
    }
    fetchUpazilas(districtId)
      .then((list) => setUpazilas(Array.isArray(list) ? list : []))
      .catch((err) => console.error('[Home] fetchUpazilas error:', err));
  }, [districtId]);

  // Sync URL params helper
  const syncUrlParams = (updates: Record<string, string | null | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (v && v !== 'all') {
        next.set(k, v);
      } else {
        next.delete(k);
      }
    });
    setSearchParams(next, { replace: true });
  };

  const hasActiveFilters = Boolean(
    divisionId || districtId || upazilaId || selectedProfessionId !== 'all' || debouncedSearch.trim()
  );

  // Combined Supabase Query whenever any filter is active
  const runCombinedFilterQuery = useCallback(async () => {
    if (!hasActiveFilters) {
      setFilteredProfiles([]);
      return;
    }

    setLoadingFiltered(true);
    const configErr = getSupabaseConfigError();
    if (!configErr) setErrorMessage(null);

    const selectedProf = professions.find((p) => String(p.id) === String(selectedProfessionId));
    const selectedDiv = divisions.find((d) => String(d.id) === String(divisionId));
    const selectedDis = districts.find((d) => String(d.id) === String(districtId));
    const selectedUpa = upazilas.find((u) => String(u.id) === String(upazilaId));

    try {
      const result = await fetchPublicProfiles({
        search: debouncedSearch,
        profession_id: selectedProfessionId,
        profession_name: selectedProf?.name_bn,
        division_id: divisionId || undefined,
        division_name: selectedDiv?.name_bn,
        district_id: districtId || undefined,
        district_name: selectedDis?.name_bn,
        upazila_id: upazilaId || undefined,
        upazila_name: selectedUpa?.name_bn,
        limit: 500,
        throwOnError: !configErr,
      });
      setFilteredProfiles(Array.isArray(result) ? result : []);
    } catch (err: any) {
      console.error('[Home] runCombinedFilterQuery error:', err);
      setErrorMessage(err.message || 'ফিল্টারকৃত পেশাজীবী লোড করতে সমস্যা হয়েছে।');
    } finally {
      setLoadingFiltered(false);
    }
  }, [
    hasActiveFilters,
    debouncedSearch,
    selectedProfessionId,
    divisionId,
    districtId,
    upazilaId,
    professions,
    divisions,
    districts,
    upazilas,
  ]);

  useEffect(() => {
    runCombinedFilterQuery();
  }, [runCombinedFilterQuery]);

  // Group approved profiles by Division in canonical order (when no filter is active)
  const profilesByDivision = useMemo(() => {
    const map: Record<string, { divisionId: string; divisionName: string; items: PublicProfile[] }> = {};

    (allProfiles || []).forEach((profile) => {
      const divName = profile?.division_name || 'অন্যান্য';
      const key = normalizeBn(divName) || profile?.division_id || 'other';
      const matchedCanonDiv = divisions.find(
        (d) => normalizeBn(d.name_bn) === normalizeBn(divName)
      );
      if (!map[key]) {
        map[key] = {
          divisionId: matchedCanonDiv?.id || profile?.division_id || '',
          divisionName: divName,
          items: [],
        };
      }
      map[key].items.push(profile);
    });

    const list = Object.values(map);

    list.sort((a, b) => {
      const idxA = DIVISION_CANONICAL_ORDER.findIndex((d) => normalizeBn(d) === normalizeBn(a.divisionName));
      const idxB = DIVISION_CANONICAL_ORDER.findIndex((d) => normalizeBn(d) === normalizeBn(b.divisionName));
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.divisionName.localeCompare(b.divisionName);
    });

    return list.filter((group) => group.items.length > 0);
  }, [allProfiles, divisions]);

  const handleFilterMyLocation = () => {
    if (!authProfile?.division_id) return;
    const myLoc = resolveLocationNames(
      authProfile.division_id,
      authProfile.district_id,
      authProfile.upazila_id,
      authProfile.extra_info
    );
    const matchedDiv =
      divisions.find((d) => String(d.id) === String(authProfile.division_id)) ||
      divisions.find((d) => normalizeBn(d.name_bn) === normalizeBn(myLoc.division_name));

    const targetDivId = matchedDiv?.id || authProfile.division_id;
    setDivisionId(targetDivId);
    setDistrictId(authProfile.district_id || '');
    setUpazilaId('');
    syncUrlParams({
      division_id: targetDivId || null,
      district_id: authProfile.district_id || null,
      upazila_id: null,
    });
  };

  const handleResetFilters = () => {
    setDivisionId('');
    setDistrictId('');
    setUpazilaId('');
    setSelectedProfessionId('all');
    setSearchQuery('');
    setDebouncedSearch('');
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const handleProfileDeleted = (deletedId: string) => {
    setAllProfiles((prev) => prev.filter((p) => p.id !== deletedId));
    setFilteredProfiles((prev) => prev.filter((p) => p.id !== deletedId));
  };

  const heroTitle =
    settings?.hero_title ||
    'জমি ও আইনসেবা-সংশ্লিষ্ট পেশাজীবীদের খুঁজুন এক জায়গায় সার্ভেয়ার, দলিল লেখক ও আইনজীবীদের পেশাগত তথ্য দেখুন। আপনার এলাকা অনুযায়ী খুঁজে নিন এবং প্রয়োজনীয় যোগাযোগের তথ্য জানুন';

  return (
    <div className="space-y-14 pb-16">
      {/* 1) HERO SECTION (Clean Light Ice-Blue + Pure White Card Aesthetic) */}
      <section className="relative pt-10 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#E8F1FF] via-[#F0F6FF] to-[#F4F7FB] dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 border-b border-[#DCE7F9] dark:border-slate-800 overflow-hidden">
        <div className="relative z-10 max-w-5xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white dark:bg-blue-950/60 border border-[#BFDBFE] dark:border-blue-800 text-[#0B63E5] dark:text-blue-300 text-xs font-bold shadow-xs">
            <Sparkles className="w-4 h-4 text-[#0B63E5] dark:text-blue-400" />
            <span>বাংলাদেশের সর্ববৃহৎ পেশাজীবী নেটওয়ার্ক</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight font-siliguri text-[#0F2942] dark:text-white text-balance">
            {heroTitle}
          </h1>

          <p className="text-[#475569] dark:text-slate-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            বিভাগ, জেলা ও উপজেলা বাছাই করে এক ক্লিকেই অভিজ্ঞ ও নিবন্ধিত পেশাজীবীদের প্রোফাইল দেখুন এবং সরাসরি যোগাযোগ করুন।
          </p>

          {/* 2) LIVE SEARCH & CASCADING FILTER CARD */}
          <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl shadow-[0_8px_30px_rgba(15,41,66,0.06)] border border-[#E2E8F0] dark:border-slate-800 text-[#1E293B] dark:text-slate-100 text-left space-y-4">
            {/* Field 1: Cascading Location Dropdowns (বিভাগ → জেলা → উপজেলা) */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-[#0F2942] dark:text-slate-300 uppercase tracking-wider">
                  <MapPin className="w-4 h-4 text-[#0B63E5]" />
                  <span>ঠিকানা / এলাকা নির্বাচন করুন (বিভাগ → জেলা → উপজেলা)</span>
                </label>

                <div className="flex items-center gap-2">
                  {authProfile?.division_id && (
                    <button
                      type="button"
                      onClick={handleFilterMyLocation}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[#EFF6FF] dark:bg-blue-950/60 text-[#0B63E5] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-800 hover:bg-[#DBEAFE] transition cursor-pointer flex items-center gap-1"
                    >
                      <MapPin className="w-3 h-3 text-[#0B63E5]" />
                      <span>আমার এলাকার পেশাজীবী</span>
                    </button>
                  )}
                  {(user || authProfile) && (
                    <Link
                      to="/account"
                      className="text-[11px] font-bold px-3 py-1 rounded-lg bg-[#0B63E5] hover:bg-[#084FC7] text-white transition flex items-center gap-1 shadow-xs"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>{authProfile?.phone ? 'প্রোফাইল এডিট' : 'প্রোফাইল তৈরি করুন'}</span>
                    </Link>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Division */}
                <select
                  value={divisionId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDivisionId(val);
                    setDistrictId('');
                    setUpazilaId('');
                    syncUrlParams({
                      division_id: val || null,
                      district_id: null,
                      upazila_id: null,
                    });
                  }}
                  aria-label="বিভাগ নির্বাচন করুন"
                  className="w-full py-3 px-3.5 bg-[#F8FAFC] dark:bg-slate-800/90 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-[#0F2942] dark:text-slate-100 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-[#0B63E5] cursor-pointer"
                >
                  <option value="">সকল বাংলাদেশ</option>
                  {divisions.map((div) => (
                    <option key={div.id} value={div.id}>
                      {div.name_bn} বিভাগ
                    </option>
                  ))}
                </select>

                {/* District */}
                <select
                  value={districtId}
                  disabled={!divisionId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDistrictId(val);
                    setUpazilaId('');
                    syncUrlParams({
                      district_id: val || null,
                      upazila_id: null,
                    });
                  }}
                  aria-label="জেলা নির্বাচন করুন"
                  className="w-full py-3 px-3.5 bg-[#F8FAFC] dark:bg-slate-800/90 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-[#0F2942] dark:text-slate-100 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-[#0B63E5] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <option value="">সকল জেলা</option>
                  {districts.map((dis) => (
                    <option key={dis.id} value={dis.id}>
                      {dis.name_bn}
                    </option>
                  ))}
                </select>

                {/* Upazila */}
                <select
                  value={upazilaId}
                  disabled={!districtId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setUpazilaId(val);
                    syncUrlParams({ upazila_id: val || null });
                  }}
                  aria-label="উপজেলা নির্বাচন করুন"
                  className="w-full py-3 px-3.5 bg-[#F8FAFC] dark:bg-slate-800/90 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-[#0F2942] dark:text-slate-100 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-[#0B63E5] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <option value="">সকল উপজেলা</option>
                  {upazilas.map((upa) => (
                    <option key={upa.id} value={upa.id}>
                      {upa.name_bn}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Field 2: Live Search Input (400ms Debounced) */}
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  syncUrlParams({ search: val.trim() || null });
                }}
                placeholder="নাম, মোবাইল নম্বর বা আইডি/লাইসেন্স নম্বর দিয়ে খুঁজুন..."
                className="w-full pl-11 pr-4 py-3 bg-[#F8FAFC] dark:bg-slate-800/80 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0B63E5] text-[#0F2942] dark:text-slate-100"
              />
            </div>

            {/* Field 3: Profession Filter Chips */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  পেশা ফিল্টার করুন:
                </span>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-xs text-red-600 dark:text-red-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>ফিল্টার মুছে ফেলুন</span>
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProfessionId('all');
                    syncUrlParams({ profession_id: null });
                  }}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    selectedProfessionId === 'all'
                      ? 'bg-[#0B63E5] text-white shadow-xs'
                      : 'bg-[#F1F5F9] dark:bg-slate-800 text-[#334155] dark:text-slate-300 hover:bg-[#EFF6FF] hover:text-[#0B63E5] dark:hover:bg-slate-700'
                  }`}
                >
                  সব পেশা
                </button>

                {professions.map((prof) => {
                  const isActive = String(selectedProfessionId) === String(prof.id);
                  return (
                    <button
                      key={prof.id}
                      type="button"
                      onClick={() => {
                        setSelectedProfessionId(String(prof.id));
                        syncUrlParams({ profession_id: String(prof.id) });
                      }}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'bg-[#0B63E5] text-white shadow-xs'
                          : 'bg-[#F1F5F9] dark:bg-slate-800 text-[#334155] dark:text-slate-300 hover:bg-[#EFF6FF] hover:text-[#0B63E5] dark:hover:bg-slate-700'
                      }`}
                    >
                      {prof.name_bn}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3) INTRO / BANNER SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 sm:p-10 shadow-[0_2px_12px_rgba(15,41,66,0.05)] grid grid-cols-1 lg:grid-cols-2 gap-8 items-center border border-[#E2E8F0] dark:border-slate-800">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EFF6FF] dark:bg-blue-950/60 text-[#0B63E5] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-800 text-xs font-bold">
              <Compass className="w-4 h-4" />
              <span>আমাদের সেবা</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold font-siliguri leading-snug text-[#0F2942] dark:text-white">
              সহজে নিজের এলাকার দক্ষ সার্ভেয়ার ও আইনি পরামর্শক বেছে নিন
            </h2>

            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              জমি পরিমাপ, ডিজিটাল নকশা তৈরি, সীমানা নির্ধারণ, দলিল লিখন এবং কোর্টের মামলার সঠিক সমাধানের জন্য আমাদের প্ল্যাটফর্মের ভেরিফাইড পেশাজীবীদের সাহায্য নিন।
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                to="/professionals"
                className="px-6 py-3 bg-[#0B63E5] hover:bg-[#084FC7] text-white font-bold text-sm rounded-xl flex items-center gap-2 transition-colors shadow-sm shadow-blue-600/15"
              >
                <span>সব পেশাজীবী দেখুন</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                to={user || authProfile ? '/account' : '/register'}
                className="px-6 py-3 bg-[#EFF6FF] hover:bg-[#DBEAFE] dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-[#0B63E5] dark:text-blue-300 font-bold text-sm rounded-xl flex items-center gap-2 border border-[#BFDBFE] dark:border-blue-800 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                <span>
                  {user || authProfile
                    ? authProfile?.phone
                      ? 'আমার প্রোফাইল এডিট করুন'
                      : 'পেশাজীবী প্রোফাইল তৈরি করুন'
                    : 'পেশাজীবী রেজিস্ট্রেশন'}
                </span>
              </Link>
            </div>
          </div>

          {settings?.video_url ? (
            <div className="relative aspect-video rounded-xl overflow-hidden shadow-md border border-[#E2E8F0] dark:border-slate-700 bg-slate-950">
              {settings.video_url.includes('youtube.com') || settings.video_url.includes('youtu.be') ? (
                <iframe
                  src={settings.video_url.replace('watch?v=', 'embed/')}
                  title="Jomi360 Video"
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video src={settings.video_url} controls className="w-full h-full object-cover" />
              )}
            </div>
          ) : (
            <div className="bg-[#F8FAFC] dark:bg-slate-800/70 p-7 rounded-2xl border border-[#E2E8F0] dark:border-slate-700 flex flex-col justify-center space-y-4">
              <h3 className="font-bold text-lg text-[#0F2942] dark:text-white">কেন জমি৩৬০ বেছে নেবেন?</h3>
              <ul className="space-y-3 text-xs sm:text-sm text-[#334155] dark:text-slate-300">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#0B63E5] shrink-0" />
                  <span>অ্যাডমিন দ্বারা জাতীয় পরিচয়পত্র (NID) যাচাইকৃত প্রোফাইল</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#0B63E5] shrink-0" />
                  <span>ডিজিটাল টোটাল স্টেশন ও জিপিএস সার্ভেয়ারদের স্পেশাল তালিকা</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#0B63E5] shrink-0" />
                  <span>সরাসরি পেশাজীবীর মোবাইল ও হোয়াটসঅ্যাপে যোগাযোগের সুবিধা</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* 4) CONDITIONAL RENDERING: FILTERED LISTING OR DIVISION-WISE SECTIONS */}
      {hasActiveFilters ? (
        <ListingSection
          profiles={filteredProfiles}
          loading={loadingFiltered || loadingInitial}
          error={errorMessage}
          onRetry={runCombinedFilterQuery}
          onDeleted={handleProfileDeleted}
          title="ফিল্টারকৃত ফলাফল"
          subtitle="আপনার নির্দিষ্ট অনুসন্ধানের সাথে মিলে যাওয়া পেশাজীবীবৃন্দ"
          onResetFilters={handleResetFilters}
        />
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {errorMessage && (
            <div className="p-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-red-800 dark:text-red-200 text-sm font-semibold">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button
                onClick={loadInitialData}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>আবার চেষ্টা করুন</span>
              </button>
            </div>
          )}

          {loadingInitial ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <div
                  key={n}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 overflow-hidden shadow-xs animate-pulse"
                >
                  <div className="h-24 bg-slate-200 dark:bg-slate-800" />
                  <div className="p-5 space-y-3">
                    <div className="w-16 h-16 -mt-12 rounded-full bg-slate-300 dark:bg-slate-700 border-4 border-white dark:border-slate-900" />
                    <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                    <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                    <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl w-full mt-4" />
                  </div>
                </div>
              ))}
            </div>
          ) : profilesByDivision.length === 0 ? (
            <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs space-y-3">
              <p className="text-[#0F2942] dark:text-slate-100 font-bold text-lg font-siliguri">
                কোনো পেশাজীবী পাওয়া যায়নি
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-xs">
                এখনো কোনো অনুমোদিত পেশাজীবী ডিরেক্টরিতে যুক্ত হয়নি।
              </p>
            </div>
          ) : (
            profilesByDivision.map(({ divisionId: grpDivId, divisionName, items }) => (
              <div key={`${grpDivId}-${divisionName}`} className="space-y-6">
                {/* Division Section Header */}
                <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-2xl font-black text-[#0F2942] dark:text-white font-siliguri">
                      {divisionName} বিভাগ
                    </h3>
                    <span className="text-xs font-bold text-[#0B63E5] dark:text-blue-300 bg-[#EFF6FF] dark:bg-blue-950/60 border border-[#BFDBFE] dark:border-blue-800 px-3 py-1 rounded-full tabular-nums">
                      {items.length} জন
                    </span>
                  </div>

                  <Link
                    to={`/professionals?division_id=${encodeURIComponent(grpDivId)}`}
                    className="text-xs font-bold text-[#0B63E5] dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <span>সবগুলো দেখুন</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>

                {/* 4-Column Grid (Max 12 cards per division preview) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {items.slice(0, 12).map((profile) => (
                    <ProfileCard key={profile.id} profile={profile} onDeleted={handleProfileDeleted} />
                  ))}
                </div>

                {items.length > 12 && (
                  <div className="flex justify-center pt-2">
                    <Link
                      to={`/professionals?division_id=${encodeURIComponent(grpDivId)}`}
                      className="px-6 py-2.5 bg-[#EFF6FF] dark:bg-blue-950/50 hover:bg-[#DBEAFE] dark:hover:bg-blue-900 text-[#0B63E5] dark:text-blue-300 text-xs font-bold rounded-xl border border-[#BFDBFE] dark:border-blue-800 transition-colors flex items-center gap-2"
                    >
                      <span>সবগুলো দেখুন (মোট {items.length} জন)</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
