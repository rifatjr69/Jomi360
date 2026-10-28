import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, RotateCcw, MapPin, UserPlus } from 'lucide-react';
import {
  fetchProfessions,
  fetchDivisions,
  fetchDistricts,
  fetchUpazilas,
  fetchPublicProfiles,
  getSupabaseConfigError,
  resolveLocationNames,
  normalizeBn,
} from '../lib/supabase';
import type { Profession, Division, District, Upazila, PublicProfile } from '../types/database';
import { ListingSection } from '../components/ListingSection';
import { useAuth } from '../context/AuthContext';

export const ProfessionalsListing: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile: authProfile } = useAuth();

  const [professions, setProfessions] = useState<Profession[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [upazilas, setUpazilas] = useState<Upazila[]>([]);

  const [profiles, setProfiles] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(getSupabaseConfigError());

  // Cascading Location + Profession + Search + Sort Controls
  const [divisionId, setDivisionId] = useState<string>(searchParams.get('division_id') || '');
  const [districtId, setDistrictId] = useState<string>(searchParams.get('district_id') || '');
  const [upazilaId, setUpazilaId] = useState<string>(searchParams.get('upazila_id') || '');
  const [selectedProfessionId, setSelectedProfessionId] = useState<string>(
    searchParams.get('profession_id') || 'all'
  );
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState<string>(searchParams.get('search') || '');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');

  // 400ms Debounce for Search Input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load Professions & Divisions on mount
  useEffect(() => {
    Promise.all([fetchProfessions(), fetchDivisions()])
      .then(([p, d]) => {
        setProfessions(Array.isArray(p) ? p : []);
        setDivisions(Array.isArray(d) ? d : []);
      })
      .catch((err) => console.error('[ProfessionalsListing] lookup load error:', err));
  }, []);

  // Load Districts when Division changes
  useEffect(() => {
    if (!divisionId) {
      setDistricts([]);
      return;
    }
    fetchDistricts(divisionId)
      .then((list) => setDistricts(Array.isArray(list) ? list : []))
      .catch((err) => console.error('[ProfessionalsListing] fetchDistricts error:', err));
  }, [divisionId]);

  // Load Upazilas when District changes
  useEffect(() => {
    if (!districtId) {
      setUpazilas([]);
      return;
    }
    fetchUpazilas(districtId)
      .then((list) => setUpazilas(Array.isArray(list) ? list : []))
      .catch((err) => console.error('[ProfessionalsListing] fetchUpazilas error:', err));
  }, [districtId]);

  // Sync URL query params when navigated from external link
  useEffect(() => {
    const divP = searchParams.get('division_id') || '';
    const disP = searchParams.get('district_id') || '';
    const upaP = searchParams.get('upazila_id') || '';
    const profP = searchParams.get('profession_id') || 'all';
    const qP = searchParams.get('search') || '';

    setDivisionId(divP);
    setDistrictId(disP);
    setUpazilaId(upaP);
    setSelectedProfessionId(profP);
    setSearchQuery((prev) => (prev !== qP ? qP : prev));
  }, [searchParams]);

  const updateQueryParams = (newParams: Record<string, string | null>) => {
    const updated = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([key, val]) => {
      if (val && val !== 'all') updated.set(key, val);
      else updated.delete(key);
    });
    setSearchParams(updated, { replace: true });
  };

  // Combined Supabase Query
  const loadFilteredProfiles = useCallback(async () => {
    setLoading(true);
    const configErr = getSupabaseConfigError();
    if (configErr) {
      setErrorMessage(configErr);
    } else {
      setErrorMessage(null);
    }

    const selectedProf = professions.find((p) => String(p.id) === String(selectedProfessionId));
    const selectedDiv = divisions.find((d) => String(d.id) === String(divisionId));
    const selectedDis = districts.find((d) => String(d.id) === String(districtId));
    const selectedUpa = upazilas.find((u) => String(u.id) === String(upazilaId));

    try {
      const list = await fetchPublicProfiles({
        search: debouncedSearch,
        profession_id: selectedProfessionId,
        profession_name: selectedProf?.name_bn,
        division_id: divisionId || undefined,
        division_name: selectedDiv?.name_bn,
        district_id: districtId || undefined,
        district_name: selectedDis?.name_bn,
        upazila_id: upazilaId || undefined,
        upazila_name: selectedUpa?.name_bn,
        sortBy,
        limit: 500,
        throwOnError: !configErr,
      });
      setProfiles(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error('[ProfessionalsListing] loadFilteredProfiles error:', err);
      setErrorMessage(err.message || 'পেশাজীবীদের তালিকা লোড করতে সমস্যা হয়েছে।');
    } finally {
      setLoading(false);
    }
  }, [
    debouncedSearch,
    selectedProfessionId,
    divisionId,
    districtId,
    upazilaId,
    sortBy,
    professions,
    divisions,
    districts,
    upazilas,
  ]);

  useEffect(() => {
    loadFilteredProfiles();
  }, [loadFilteredProfiles]);

  const handleResetFilters = () => {
    setDivisionId('');
    setDistrictId('');
    setUpazilaId('');
    setSelectedProfessionId('all');
    setSearchQuery('');
    setDebouncedSearch('');
    setSortBy('newest');
    setSearchParams(new URLSearchParams(), { replace: true });
  };

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
    updateQueryParams({
      division_id: targetDivId || null,
      district_id: authProfile.district_id || null,
      upazila_id: null,
    });
  };

  const handleProfileDeleted = (deletedId: string) => {
    setProfiles((prev) => prev.filter((p) => p.id !== deletedId));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-16">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-[0_2px_12px_rgba(15,41,66,0.05)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-[#E2E8F0] dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black font-siliguri text-[#0F2942] dark:text-white">
            সকল পেশাজীবী তালিকা
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            যাচাইকৃত সার্ভেয়ার, দলিল লেখক, এডভোকেট ও আইনি বিশেষজ্ঞদের সম্পূর্ণ ডিরেক্টরি
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {authProfile?.division_id && (
            <button
              type="button"
              onClick={handleFilterMyLocation}
              className="bg-[#EFF6FF] hover:bg-[#DBEAFE] dark:bg-blue-950/60 border border-[#BFDBFE] dark:border-blue-800 px-3.5 py-2 rounded-xl text-xs font-bold text-[#0B63E5] dark:text-blue-300 flex items-center gap-1.5 transition cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5 text-[#0B63E5]" />
              <span>আমার এলাকার তালিকা</span>
            </button>
          )}
          <Link
            to={user || authProfile ? '/account' : '/login'}
            className="bg-[#0B63E5] hover:bg-[#084FC7] px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition shadow-xs"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>
              {user || authProfile
                ? authProfile?.phone
                  ? 'আমার প্রোফাইল এডিট'
                  : 'নিজের প্রোফাইল যুক্ত করুন'
                : 'প্রোফাইল যুক্ত করতে লগইন'}
            </span>
          </Link>
          <div className="bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold text-[#0F2942] dark:text-slate-200 tabular-nums">
            মোট অনুমোদিত: {profiles.length} জন
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-[0_2px_10px_rgba(15,41,66,0.04)] space-y-4">
        {/* Row 1: Cascading Location Dropdowns + Search + Sort */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Division */}
          <div>
            <label className="block text-xs font-bold text-[#0F2942] dark:text-slate-400 mb-1 uppercase tracking-wider">
              বিভাগ
            </label>
            <select
              value={divisionId}
              onChange={(e) => {
                const val = e.target.value;
                setDivisionId(val);
                setDistrictId('');
                setUpazilaId('');
                updateQueryParams({
                  division_id: val || null,
                  district_id: null,
                  upazila_id: null,
                });
              }}
              className="w-full py-2.5 px-3 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-xs font-semibold text-[#0F2942] dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B63E5] cursor-pointer"
            >
              <option value="">সকল বাংলাদেশ</option>
              {divisions.map((div) => (
                <option key={div.id} value={div.id}>
                  {div.name_bn} বিভাগ
                </option>
              ))}
            </select>
          </div>

          {/* District */}
          <div>
            <label className="block text-xs font-bold text-[#0F2942] dark:text-slate-400 mb-1 uppercase tracking-wider">
              জেলা
            </label>
            <select
              value={districtId}
              disabled={!divisionId}
              onChange={(e) => {
                const val = e.target.value;
                setDistrictId(val);
                setUpazilaId('');
                updateQueryParams({
                  district_id: val || null,
                  upazila_id: null,
                });
              }}
              className="w-full py-2.5 px-3 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-xs font-semibold text-[#0F2942] dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B63E5] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <option value="">সকল জেলা</option>
              {districts.map((dis) => (
                <option key={dis.id} value={dis.id}>
                  {dis.name_bn}
                </option>
              ))}
            </select>
          </div>

          {/* Upazila */}
          <div>
            <label className="block text-xs font-bold text-[#0F2942] dark:text-slate-400 mb-1 uppercase tracking-wider">
              উপজেলা
            </label>
            <select
              value={upazilaId}
              disabled={!districtId}
              onChange={(e) => {
                const val = e.target.value;
                setUpazilaId(val);
                updateQueryParams({ upazila_id: val || null });
              }}
              className="w-full py-2.5 px-3 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-xs font-semibold text-[#0F2942] dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B63E5] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <option value="">সকল উপজেলা</option>
              {upazilas.map((upa) => (
                <option key={upa.id} value={upa.id}>
                  {upa.name_bn}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div>
            <label className="block text-xs font-bold text-[#0F2942] dark:text-slate-400 mb-1 uppercase tracking-wider">
              নাম, ফোন বা আইডি
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  updateQueryParams({ search: val.trim() || null });
                }}
                placeholder="খুঁজুন..."
                className="w-full pl-9 pr-3 py-2.5 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-xs font-semibold text-[#0F2942] dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B63E5]"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Sorting Dropdown */}
          <div>
            <label className="block text-xs font-bold text-[#0F2942] dark:text-slate-400 mb-1 uppercase tracking-wider">
              ক্রমানুসার
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
              className="w-full py-2.5 px-3 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-xs font-semibold text-[#0F2942] dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B63E5] cursor-pointer"
            >
              <option value="newest">নতুন নিবন্ধিত আগে</option>
              <option value="oldest">পুরাতন আগে</option>
            </select>
          </div>
        </div>

        {/* Row 2: Profession Filter Chips */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setSelectedProfessionId('all');
                updateQueryParams({ profession_id: null });
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
                    updateQueryParams({ profession_id: String(prof.id) });
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

        {/* Reset Filter Action */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <span className="text-slate-500 dark:text-slate-400 tabular-nums">
            ফিল্টারকৃত পেশাজীবী সংখ্যা: {profiles.length} জন
          </span>

          <button
            type="button"
            onClick={handleResetFilters}
            className="flex items-center gap-1 text-red-600 dark:text-red-400 font-bold hover:underline cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>ফিল্টার মুছে ফেলুন</span>
          </button>
        </div>
      </div>

      {/* Profile Listing Section */}
      <ListingSection
        profiles={profiles}
        loading={loading}
        error={errorMessage}
        onRetry={loadFilteredProfiles}
        onDeleted={handleProfileDeleted}
        title="পেশাজীবী ডিরেক্টরি"
        subtitle="আপনার কাঙ্ক্ষিত এলাকার সকল ভেরিফাইড পেশাজীবী"
        onResetFilters={handleResetFilters}
      />
    </div>
  );
};
