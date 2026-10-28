import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  User,
  MapPin,
  FileCheck,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  Compass,
} from 'lucide-react';
import {
  fetchProfessions,
  registerProfessionalUser,
  toEnglishDigits,
  normalizeBn,
  getSupabaseConfigError,
} from '../lib/supabase';
import type { Profession } from '../types/database';
import { AddressPickerModal, SelectedLocation } from '../components/AddressPickerModal';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';

export const Register: React.FC = () => {
  const { showToast } = useToast();
  const { refreshProfile } = useAuth();

  const [professions, setProfessions] = useState<Profession[]>([]);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState(getSupabaseConfigError() || '');

  // Form Field States
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [professionId, setProfessionId] = useState('');
  const [bio, setBio] = useState('');

  // Location
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [addressPickerOpen, setAddressPickerOpen] = useState(false);
  const [addressDetail, setAddressDetail] = useState('');

  // NID & Security
  const [nidNumber, setNidNumber] = useState('');
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [nidPhotoFile, setNidPhotoFile] = useState<File | null>(null);
  const [nidPhotoPreview, setNidPhotoPreview] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Dynamic Profession Extra Info
  const [certYear, setCertYear] = useState('');
  const [certIssuer, setCertIssuer] = useState('');
  const [surveyorType, setSurveyorType] = useState<'analog' | 'digital' | 'both'>('both');
  const [selectedTechs, setSelectedTechs] = useState<string[]>(['AutoCAD', 'ল্যাপটপ/ডেস্কটপ']);
  const [selectedEquip, setSelectedEquip] = useState<string[]>(['টোটাল স্টেশন']);

  const [barCouncilNo, setBarCouncilNo] = useState('');
  const [court, setCourt] = useState('');
  const [advocateExperience, setAdvocateExperience] = useState('');

  const [licenseNo, setLicenseNo] = useState('');
  const [subRegistryOffice, setSubRegistryOffice] = useState('');
  const [deedExperience, setDeedExperience] = useState('');

  const [specialization, setSpecialization] = useState('');
  const [qualification, setQualification] = useState('');
  const [genericExperience, setGenericExperience] = useState('');

  useEffect(() => {
    fetchProfessions()
      .then((profs) => {
        const list = Array.isArray(profs) ? profs : [];
        setProfessions(list);
        if (list.length > 0) setProfessionId(String(list[0].id));
      })
      .catch((err) => console.error('[Register] fetchProfessions error:', err));
  }, []);

  const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast('প্রোফাইল ছবির সাইজ সর্বোচ্চ ২ মেগাবাইট (2MB) হতে পারবে।', 'error');
        return;
      }
      setProfilePhotoFile(file);
      setProfilePhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleNidPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast('এনআইডি ছবির সাইজ সর্বোচ্চ ২ মেগাবাইট (2MB) হতে পারবে।', 'error');
        return;
      }
      setNidPhotoFile(file);
      setNidPhotoPreview(URL.createObjectURL(file));
    }
  };

  const toggleTech = (item: string) => {
    setSelectedTechs((prev) =>
      prev.includes(item) ? prev.filter((t) => t !== item) : [...prev, item]
    );
  };

  const toggleEquip = (item: string) => {
    setSelectedEquip((prev) =>
      prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item]
    );
  };

  const selectedProfObj = professions.find((p) => String(p.id) === String(professionId));
  const normProfName = normalizeBn(selectedProfObj?.name_bn);
  const isSurveyor = selectedProfObj?.slug === 'surveyor' || normProfName === normalizeBn('সার্ভেয়ার');
  const isDeedWriter = selectedProfObj?.slug === 'deed-writer' || normProfName === normalizeBn('দলিল লেখক');
  const isAdvocate =
    selectedProfObj?.slug === 'advocate' ||
    selectedProfObj?.slug === 'barrister' ||
    normProfName === normalizeBn('এডভোকেট') ||
    normProfName === normalizeBn('ব্যারিস্টার');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanPhone = toEnglishDigits(phone.trim());
    const cleanNid = toEnglishDigits(nidNumber.trim());

    if (!fullName.trim()) {
      setErrorMsg('আপনার পূর্ণ নাম লিখুন।');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('সঠিক ই-মেইল ঠিকানা প্রদান করুন।');
      return;
    }
    if (!/^01\d{9}$/.test(cleanPhone)) {
      setErrorMsg('সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 01712345678)।');
      return;
    }
    if (!selectedLocation?.division_id || !selectedLocation?.district_id) {
      setErrorMsg('দয়া করে ঠিকানা নির্বাচন বাটনে ক্লিক করে বিভাগ ও জেলা বাছাই করুন।');
      return;
    }
    if (!cleanNid || ![10, 13, 17].includes(cleanNid.length)) {
      setErrorMsg('এনআইডি (NID) নম্বর ১০, ১৩ অথবা ১৭ ডিজিটের হতে হবে।');
      return;
    }
    if (!password || password.length < 8) {
      setErrorMsg('পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।');
      return;
    }

    setLoading(true);

    let extra_info: Record<string, any> = {};
    if (isSurveyor) {
      extra_info = {
        cert_year: certYear,
        cert_issuer: certIssuer,
        surveyor_type: surveyorType,
        technologies: selectedTechs,
        equipment: selectedEquip,
      };
    } else if (isAdvocate) {
      extra_info = {
        bar_council_no: barCouncilNo,
        court,
        experience_years: advocateExperience,
      };
    } else if (isDeedWriter) {
      extra_info = {
        license_no: licenseNo,
        sub_registry_office: subRegistryOffice,
        experience_years: deedExperience,
      };
    } else {
      extra_info = {
        specialization,
        qualification,
        experience_years: genericExperience,
      };
    }

    // Preserve human-readable location & profession names inside extra_info as well
    if (selectedLocation.division_name) extra_info._division_name = selectedLocation.division_name;
    if (selectedLocation.district_name) extra_info._district_name = selectedLocation.district_name;
    if (selectedLocation.upazila_name) extra_info._upazila_name = selectedLocation.upazila_name;
    if (selectedProfObj?.name_bn) extra_info._profession_name = selectedProfObj.name_bn;

    try {
      const result = await registerProfessionalUser({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        phone: cleanPhone,
        profession_id: professionId,
        division_id: selectedLocation.division_id,
        district_id: selectedLocation.district_id,
        upazila_id: selectedLocation.upazila_id,
        address_detail: addressDetail.trim() || undefined,
        nid_number: cleanNid,
        bio: bio.trim() || undefined,
        profile_photo_file: profilePhotoFile,
        nid_photo_file: nidPhotoFile,
        extra_info,
      });

      setNeedsEmailConfirm(result.requiresEmailConfirmation);
      if (!result.requiresEmailConfirmation) {
        await refreshProfile();
      }

      setSuccessMsg(true);
      showToast('রেজিস্ট্রেশন সফল হয়েছে!', 'success');
    } catch (err: any) {
      console.error('[Register] Error:', err);
      setErrorMsg(err.message || 'রেজিস্ট্রেশন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  if (successMsg) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl">
          <CheckCircle2 className="w-12 h-12 animate-bounce" />
        </div>

        <h2 className="text-3xl font-black text-slate-900 dark:text-white font-siliguri">
          রেজিস্ট্রেশন সফল হয়েছে!
        </h2>

        <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-lg mx-auto bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md space-y-3">
          <p>
            আপনার প্রদত্ত তথ্যসমূহ জমা নেওয়া হয়েছে। অ্যাডমিন যাচাই করার পর আপনার প্রোফাইলটি পাবলিকলি প্রকাশিত হবে।
          </p>
          {needsEmailConfirm && (
            <p className="text-[#0B63E5] dark:text-blue-400 font-bold">
              আপনার ই-মেইলে ({email}) একটি কনফার্মেশন লিংক পাঠানো হয়েছে। লগইন করার পূর্বে ইনবক্স বা স্প্যাম ফোল্ডার চেক করে লিংকটিতে ক্লিক করুন।
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link
            to={needsEmailConfirm ? '/login' : '/account'}
            className="px-6 py-3 bg-[#0B63E5] text-white font-bold text-xs rounded-xl shadow-lg"
          >
            {needsEmailConfirm ? 'লগইন পেজে যান' : 'আমার একাউন্টে যান'}
          </Link>
          <Link
            to="/"
            className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl"
          >
            হোম পেজে ফিরে যান
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 bg-[#0B63E5] text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-600/15">
          <Compass className="w-7 h-7" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white font-siliguri">
          প্রফেশনাল রেজিস্ট্রেশন
        </h1>
        <p className="text-xs text-slate-500">
          জমি৩৬০ ডিরেক্টরিতে আপনার পেশাদার প্রোফাইল খুলুন
        </p>
      </div>

      <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-500 text-amber-900 dark:text-amber-200 rounded-r-2xl text-xs sm:text-sm font-semibold leading-relaxed flex items-start gap-3 shadow-sm">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <span>
          সঠিক তথ্য দিয়ে ফরমটি পূরণ করুন। ভুয়া ই-মেইল, মোবাইল নম্বর বা ভুল তথ্য প্রদান করলে রেজিস্ট্রেশন গ্রহণ করা হবে না।
        </span>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs font-bold">
          {errorMsg}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-900 p-6 sm:p-10 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-8"
      >
        {/* SECTION 1: PERSONAL & PROFESSIONAL INFO */}
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
            <User className="w-5 h-5 text-[#0B63E5]" />
            <span>১) ব্যক্তিগত ও পেশাগত তথ্য</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                পূর্ণ নাম *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="যেমন: মোঃ ইমদাদুল হোসেন"
                required
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0B63E5]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                সঠিক ই-মেইল ঠিকানা *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@domain.com"
                required
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0B63E5]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                সঠিক মোবাইল নম্বর (বাংলাদেশি) *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01712345678"
                required
                maxLength={11}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0B63E5] font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                পেশা সিলেক্ট করুন *
              </label>
              <select
                value={professionId}
                onChange={(e) => setProfessionId(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-[#0B63E5] dark:text-blue-300 focus:outline-none focus:ring-2 focus:ring-[#0B63E5]"
              >
                {professions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name_bn}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              সংক্ষিপ্ত পরিচিতি / বায়ো (ঐচ্ছিক, সর্বোচ্চ ৫০০ অক্ষর)
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              placeholder="আপনার পেশাগত অভিজ্ঞতা ও সেবাসমূহ সম্পর্কে সংক্ষেপে লিখুন..."
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0B63E5]"
            />
          </div>

          {/* DYNAMIC EXTRA FIELDS BASED ON PROFESSION */}
          <div className="bg-[#EFF6FF]/70 dark:bg-blue-950/30 p-5 rounded-2xl border border-[#DBEAFE] dark:border-blue-900/50 space-y-4">
            <h4 className="text-xs font-bold text-[#0F2942] dark:text-blue-300 uppercase tracking-wider">
              {selectedProfObj?.name_bn || 'পেশা'} সংক্রান্ত অতিরিক্ত তথ্য
            </h4>

            {isSurveyor && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">
                      সার্ভে সনদ প্রাপ্তির সাল
                    </label>
                    <input
                      type="text"
                      value={certYear}
                      onChange={(e) => setCertYear(e.target.value)}
                      placeholder="যেমন: ২০১০"
                      className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">
                      সনদ প্রদানকারী প্রতিষ্ঠান
                    </label>
                    <input
                      type="text"
                      value={certIssuer}
                      onChange={(e) => setCertIssuer(e.target.value)}
                      placeholder="যেমন: বাংলাদেশ সার্ভে ইন্সটিটিউট"
                      className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1.5 font-semibold">
                    সার্ভেয়ারের ধরন
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="surveyorType"
                        value="analog"
                        checked={surveyorType === 'analog'}
                        onChange={() => setSurveyorType('analog')}
                      />
                      <span>এনালগ সার্ভেয়ার</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="surveyorType"
                        value="digital"
                        checked={surveyorType === 'digital'}
                        onChange={() => setSurveyorType('digital')}
                      />
                      <span>ডিজিটাল সার্ভেয়ার</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="surveyorType"
                        value="both"
                        checked={surveyorType === 'both'}
                        onChange={() => setSurveyorType('both')}
                      />
                      <span>এনালগ ও ডিজিটাল উভয়</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1.5 font-semibold">
                    ব্যবহৃত প্রযুক্তি (টিক দিন):
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['AutoCAD', 'ল্যাপটপ/ডেস্কটপ', 'CAD/PDF ম্যাপ প্রসেসিং', 'প্যাটোগ্রাফ'].map((tech) => (
                      <button
                        key={tech}
                        type="button"
                        onClick={() => toggleTech(tech)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                          selectedTechs.includes(tech)
                            ? 'bg-[#0B63E5] text-white border-[#0B63E5]'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200'
                        }`}
                      >
                        {selectedTechs.includes(tech) ? '✓ ' : '+ '}
                        {tech}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1.5 font-semibold">
                    ব্যবহৃত যন্ত্রপাতি (টিক দিন):
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['টোটাল স্টেশন', 'GPS RTK', 'অপটিক্যাল লেভেল', 'ফিতা/চেইন'].map((eq) => (
                      <button
                        key={eq}
                        type="button"
                        onClick={() => toggleEquip(eq)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                          selectedEquip.includes(eq)
                            ? 'bg-[#0B63E5] text-white border-[#0B63E5]'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200'
                        }`}
                      >
                        {selectedEquip.includes(eq) ? '✓ ' : '+ '}
                        {eq}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {isAdvocate && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">
                    বার কাউন্সিল নম্বর
                  </label>
                  <input
                    type="text"
                    value={barCouncilNo}
                    onChange={(e) => setBarCouncilNo(e.target.value)}
                    placeholder="BC-XXXXX"
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">
                    কোর্ট
                  </label>
                  <input
                    type="text"
                    value={court}
                    onChange={(e) => setCourt(e.target.value)}
                    placeholder="যেমন: জজ কোর্ট, যশোর"
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">
                    অভিজ্ঞতা (বছর)
                  </label>
                  <input
                    type="text"
                    value={advocateExperience}
                    onChange={(e) => setAdvocateExperience(e.target.value)}
                    placeholder="যেমন: ১২ বছর"
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>
            )}

            {isDeedWriter && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">
                    লাইসেন্স নম্বর
                  </label>
                  <input
                    type="text"
                    value={licenseNo}
                    onChange={(e) => setLicenseNo(e.target.value)}
                    placeholder="BSR-XXXX"
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">
                    সাব-রেজিস্ট্রি অফিস
                  </label>
                  <input
                    type="text"
                    value={subRegistryOffice}
                    onChange={(e) => setSubRegistryOffice(e.target.value)}
                    placeholder="যেমন: বরিশাল সদর সাব-রেজিস্ট্রি অফিস"
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">
                    অভিজ্ঞতা (বছর)
                  </label>
                  <input
                    type="text"
                    value={deedExperience}
                    onChange={(e) => setDeedExperience(e.target.value)}
                    placeholder="যেমন: ১৫ বছর"
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>
            )}

            {!isSurveyor && !isAdvocate && !isDeedWriter && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">
                    বিশেষজ্ঞতা
                  </label>
                  <input
                    type="text"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    placeholder="যেমন: সিভিল মামলা"
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">
                    শিক্ষাগত যোগ্যতা
                  </label>
                  <input
                    type="text"
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    placeholder="যেমন: এলএলবি (অনার্স)"
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">
                    অভিজ্ঞতা (বছর)
                  </label>
                  <input
                    type="text"
                    value={genericExperience}
                    onChange={(e) => setGenericExperience(e.target.value)}
                    placeholder="যেমন: ১০ বছর"
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: LOCATION */}
        <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#0B63E5]" />
            <span>২) লোকেশন (সারা বাংলাদেশ) *</span>
          </h3>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setAddressPickerOpen(true)}
              className="w-full py-4 px-5 border-2 border-dashed border-[#0B63E5] dark:border-[#0B63E5] bg-[#EFF6FF]/60 dark:bg-blue-950/20 hover:bg-[#EFF6FF]/50 rounded-2xl flex items-center justify-between text-[#0F2942] dark:text-blue-200 font-bold text-sm transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#0B63E5]" />
                {selectedLocation?.displayText || 'ঠিকানা / এলাকা নির্বাচন করুন (ক্লিক করুন)'}
              </span>
              <span className="text-xs bg-[#0B63E5] text-white px-3 py-1 rounded-lg">
                নির্বাচন করুন
              </span>
            </button>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                গ্রাম/রাস্তা/বিস্তারিত ঠিকানা (ঐচ্ছিক)
              </label>
              <input
                type="text"
                value={addressDetail}
                onChange={(e) => setAddressDetail(e.target.value)}
                placeholder="যেমন: বাড়ি নং ৪৫, মেইন রোড"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: NID & SECURITY */}
        <div className="space-y-6 pt-4 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-[#0B63E5]" />
            <span>৩) এনআইডি (NID) তথ্য ও সিকিউরিটি</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                এনআইডি (NID) কার্ড নম্বর * (১০ / ১৩ / ১৭ ডিজিট)
              </label>
              <input
                type="text"
                value={nidNumber}
                onChange={(e) => setNidNumber(e.target.value)}
                placeholder="যেমন: 19901234567890123"
                required
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#0B63E5]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-800/50 space-y-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  প্রোফাইল ছবি আপলোড (সর্বোচ্চ ২MB)
                </label>

                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleProfilePhotoChange}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#0B63E5] file:text-white hover:file:bg-[#084FC7] cursor-pointer"
                />

                {profilePhotoPreview && (
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#0B63E5] shadow-md">
                    <img src={profilePhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-800/50 space-y-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  এনআইডি (NID) কার্ডের ছবি আপলোড (গোপনীয়)
                </label>

                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleNidPhotoChange}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#0B63E5] file:text-white hover:file:bg-[#084FC7] cursor-pointer"
                />

                {nidPhotoPreview && (
                  <div className="h-20 rounded-xl overflow-hidden border border-slate-300 shadow-md">
                    <img src={nidPhotoPreview} alt="NID Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                পাসওয়ার্ড সেট করুন * (কমপক্ষে ৮ অক্ষর)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0B63E5]"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {password && (
                <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                  <div
                    className={`h-1.5 flex-1 rounded-full ${
                      password.length >= 8 ? 'bg-emerald-500' : 'bg-amber-400'
                    }`}
                  ></div>
                  <span
                    className={
                      password.length >= 8 ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'
                    }
                  >
                    {password.length >= 8 ? 'শক্তিশালী পাসওয়ার্ড' : 'কমপক্ষে ৮ অক্ষর দরকার'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <AddressPickerModal
          isOpen={addressPickerOpen}
          onClose={() => setAddressPickerOpen(false)}
          onSelect={(loc) => setSelectedLocation(loc.division_id ? loc : null)}
        />

        <div className="pt-4 space-y-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#0B63E5] hover:bg-[#084FC7] dark:bg-[#0B63E5] dark:hover:bg-[#084FC7] text-white font-bold text-base rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-60"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span>রেজিস্ট্রেশন সম্পন্ন করুন</span>
            )}
          </button>

          <div className="text-center text-xs text-slate-600 dark:text-slate-400 space-y-2">
            <p>
              ইতিমধ্যে অ্যাকাউন্ট আছে?{' '}
              <Link to="/login" className="font-bold text-[#0B63E5] dark:text-blue-400 hover:underline">
                লগইন করুন
              </Link>
            </p>

            <Link
              to="/"
              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>হোম পেজে ফিরে যান</span>
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
};
