import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, ChevronRight, Check, MapPin, ArrowLeft } from 'lucide-react';
import {
  fetchDivisions,
  fetchDistricts,
  fetchUpazilas,
  normalizeBn,
} from '../lib/supabase';
import type { Division, District, Upazila } from '../types/database';

export interface SelectedLocation {
  division_id?: string;
  division_name?: string;
  district_id?: string;
  district_name?: string;
  upazila_id?: string;
  upazila_name?: string;
  displayText: string;
}

interface AddressPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (location: SelectedLocation) => void;
  initialLocation?: {
    division_id?: string;
    district_id?: string;
    upazila_id?: string;
  };
}

export const AddressPickerModal: React.FC<AddressPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialLocation,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [searchTerm, setSearchTerm] = useState('');

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [upazilas, setUpazilas] = useState<Upazila[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedDiv, setSelectedDiv] = useState<Division | null>(null);
  const [selectedDis, setSelectedDis] = useState<District | null>(null);
  const [selectedUpa, setSelectedUpa] = useState<Upazila | null>(null);

  // Load Divisions when modal opens and reset step cleanly
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setStep(1);
    setSearchTerm('');
    setSelectedDiv(null);
    setSelectedDis(null);
    setSelectedUpa(null);
    setLoading(true);

    fetchDivisions()
      .then((divs) => {
        if (cancelled) return;
        setDivisions(divs);
        if (initialLocation?.division_id) {
          const matchedDiv = divs.find((d) => String(d.id) === String(initialLocation.division_id));
          if (matchedDiv) {
            setSelectedDiv(matchedDiv);
          }
        }
      })
      .catch((err) => {
        console.error('[AddressPickerModal] fetchDivisions error:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, initialLocation?.division_id]);

  // Load Districts when Selected Division changes
  useEffect(() => {
    if (!selectedDiv) {
      setDistricts([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchDistricts(selectedDiv.id)
      .then((dis) => {
        if (!cancelled) setDistricts(dis);
      })
      .catch((err) => {
        console.error('[AddressPickerModal] fetchDistricts error:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDiv]);

  // Load Upazilas when Selected District changes
  useEffect(() => {
    if (!selectedDis) {
      setUpazilas([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchUpazilas(selectedDis.id)
      .then((upas) => {
        if (!cancelled) setUpazilas(upas);
      })
      .catch((err) => {
        console.error('[AddressPickerModal] fetchUpazilas error:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDis]);

  // Step 1: Select Division
  const handleSelectDivision = (div: Division) => {
    setSelectedDiv(div);
    setSelectedDis(null);
    setSelectedUpa(null);
    setSearchTerm('');
    setStep(2);
  };

  // Step 2: Select District
  const handleSelectDistrict = (dis: District) => {
    setSelectedDis(dis);
    setSelectedUpa(null);
    setSearchTerm('');
    setStep(3);
  };

  // Step 3: Select Upazila
  const handleSelectUpazila = (upa: Upazila) => {
    setSelectedUpa(upa);
    if (selectedDiv && selectedDis) {
      const location: SelectedLocation = {
        division_id: selectedDiv.id,
        division_name: selectedDiv.name_bn,
        district_id: selectedDis.id,
        district_name: selectedDis.name_bn,
        upazila_id: upa.id,
        upazila_name: upa.name_bn,
        displayText: `${upa.name_bn}, ${selectedDis.name_bn}, ${selectedDiv.name_bn}`,
      };
      onSelect(location);
      onClose();
    }
  };

  // Direct selection of whole Division
  const handleSelectEntireDivision = () => {
    if (selectedDiv) {
      const location: SelectedLocation = {
        division_id: selectedDiv.id,
        division_name: selectedDiv.name_bn,
        district_id: undefined,
        district_name: undefined,
        upazila_id: undefined,
        upazila_name: undefined,
        displayText: `সব এলাকা, ${selectedDiv.name_bn} বিভাগ`,
      };
      onSelect(location);
      onClose();
    }
  };

  // Direct selection of whole District
  const handleSelectEntireDistrict = () => {
    if (selectedDiv && selectedDis) {
      const location: SelectedLocation = {
        division_id: selectedDiv.id,
        division_name: selectedDiv.name_bn,
        district_id: selectedDis.id,
        district_name: selectedDis.name_bn,
        upazila_id: undefined,
        upazila_name: undefined,
        displayText: `সব উপজেলা, ${selectedDis.name_bn}, ${selectedDiv.name_bn}`,
      };
      onSelect(location);
      onClose();
    }
  };

  // Reset / Clear filter ("সকল বাংলাদেশ")
  const handleClearAll = () => {
    onSelect({ displayText: 'সকল বাংলাদেশ' });
    onClose();
  };

  const normalizedQuery = normalizeBn(searchTerm).toLowerCase();

  // Filtered Lists by Search Term
  const filteredDivisions = useMemo(() => {
    if (!normalizedQuery) return divisions;
    return divisions.filter(
      (d) =>
        normalizeBn(d.name_bn).toLowerCase().includes(normalizedQuery) ||
        (d.name_en || '').toLowerCase().includes(normalizedQuery)
    );
  }, [divisions, normalizedQuery]);

  const filteredDistricts = useMemo(() => {
    if (!normalizedQuery) return districts;
    return districts.filter((d) => {
      const nameEn = String((d as { name_en?: string }).name_en || '').toLowerCase();
      return (
        normalizeBn(d.name_bn).toLowerCase().includes(normalizedQuery) ||
        nameEn.includes(normalizedQuery)
      );
    });
  }, [districts, normalizedQuery]);

  const filteredUpazilas = useMemo(() => {
    if (!normalizedQuery) return upazilas;
    return upazilas.filter((u) => {
      const nameEn = String((u as { name_en?: string }).name_en || '').toLowerCase();
      return (
        normalizeBn(u.name_bn).toLowerCase().includes(normalizedQuery) ||
        nameEn.includes(normalizedQuery)
      );
    });
  }, [upazilas, normalizedQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-[#E2E8F0] dark:border-slate-800 w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 bg-[#0B63E5] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-white" />
            <h3 className="font-bold text-lg">ঠিকানা নির্বাচন করুন</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Breadcrumb Navigation */}
        <div className="p-3 bg-[#F8FAFC] dark:bg-slate-800 border-b border-[#E2E8F0] dark:border-slate-700 flex items-center gap-1 text-sm font-medium overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => {
              setStep(1);
              setSelectedDiv(null);
              setSelectedDis(null);
              setSelectedUpa(null);
              setSearchTerm('');
            }}
            className={`hover:underline whitespace-nowrap transition-colors cursor-pointer ${
              step === 1 ? 'text-[#0B63E5] dark:text-blue-400 font-bold' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            বিভাগ
          </button>

          {selectedDiv && (
            <>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              <button
                type="button"
                onClick={() => {
                  setStep(2);
                  setSelectedDis(null);
                  setSelectedUpa(null);
                  setSearchTerm('');
                }}
                className={`hover:underline whitespace-nowrap transition-colors cursor-pointer ${
                  step === 2 ? 'text-[#0B63E5] dark:text-blue-400 font-bold' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {selectedDiv.name_bn}
              </button>
            </>
          )}

          {selectedDis && (
            <>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              <button
                type="button"
                onClick={() => {
                  setStep(3);
                  setSearchTerm('');
                }}
                className={`hover:underline whitespace-nowrap transition-colors cursor-pointer ${
                  step === 3 ? 'text-[#0B63E5] dark:text-blue-400 font-bold' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {selectedDis.name_bn}
              </button>
            </>
          )}

          {selectedUpa && (
            <>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-[#0B63E5] dark:text-blue-300 font-bold whitespace-nowrap">{selectedUpa.name_bn}</span>
            </>
          )}
        </div>

        {/* Search Input inside modal */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                step === 1
                  ? 'বিভাগের নাম খুঁজুন...'
                  : step === 2
                  ? 'জেলার নাম খুঁজুন...'
                  : 'উপজেলার নাম খুঁজুন...'
              }
              className="w-full pl-9 pr-4 py-2 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0B63E5]"
            />
          </div>
        </div>

        {/* Content Body List */}
        <div className="p-2 overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              <div className="animate-spin w-6 h-6 border-2 border-[#0B63E5] border-t-transparent rounded-full mx-auto mb-2"></div>
              লোড হচ্ছে...
            </div>
          ) : (
            <>
              {/* STEP 1: DIVISIONS */}
              {step === 1 && (
                <div>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="w-full p-3 text-left hover:bg-[#EFF6FF] dark:hover:bg-blue-950/40 rounded-xl transition-colors flex items-center justify-between text-[#0B63E5] dark:text-blue-300 font-semibold text-sm mb-1 cursor-pointer"
                  >
                    <span>সকল বাংলাদেশ (সব এলাকার পেশাজীবী)</span>
                    <Check className="w-4 h-4 text-[#0B63E5]" />
                  </button>

                  {filteredDivisions.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-sm">কোনো বিভাগ পাওয়া যায়নি</div>
                  ) : (
                    filteredDivisions.map((div) => (
                      <button
                        type="button"
                        key={div.id}
                        onClick={() => handleSelectDivision(div)}
                        className="w-full p-3 text-left hover:bg-[#F8FAFC] dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center justify-between text-[#0F2942] dark:text-slate-200 text-sm font-medium cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#0B63E5]"></span>
                          {div.name_bn} বিভাগ
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* STEP 2: DISTRICTS */}
              {step === 2 && (
                <div>
                  <button
                    type="button"
                    onClick={handleSelectEntireDivision}
                    className="w-full p-3 text-left bg-[#EFF6FF] dark:bg-blue-950/50 hover:bg-[#DBEAFE] dark:hover:bg-blue-900/60 rounded-xl transition-colors flex items-center justify-between text-[#0B63E5] dark:text-blue-300 font-semibold text-sm mb-2 cursor-pointer"
                  >
                    <span>শুধু {selectedDiv?.name_bn} বিভাগের সব এলাকা</span>
                    <Check className="w-4 h-4 text-[#0B63E5]" />
                  </button>

                  {filteredDistricts.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-sm">কোনো জেলা পাওয়া যায়নি</div>
                  ) : (
                    filteredDistricts.map((dis) => (
                      <button
                        type="button"
                        key={dis.id}
                        onClick={() => handleSelectDistrict(dis)}
                        className="w-full p-3 text-left hover:bg-[#F8FAFC] dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center justify-between text-[#0F2942] dark:text-slate-200 text-sm font-medium cursor-pointer"
                      >
                        <span>{dis.name_bn} জেলা</span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* STEP 3: UPAZILAS */}
              {step === 3 && (
                <div>
                  <button
                    type="button"
                    onClick={handleSelectEntireDistrict}
                    className="w-full p-3 text-left bg-[#EFF6FF] dark:bg-blue-950/50 hover:bg-[#DBEAFE] dark:hover:bg-blue-900/60 rounded-xl transition-colors flex items-center justify-between text-[#0B63E5] dark:text-blue-300 font-semibold text-sm mb-2 cursor-pointer"
                  >
                    <span>শুধু {selectedDis?.name_bn} জেলার সব উপজেলা</span>
                    <Check className="w-4 h-4 text-[#0B63E5]" />
                  </button>

                  {filteredUpazilas.length === 0 ? (
                    <div className="p-6 text-center space-y-3">
                      <p className="text-slate-400 text-sm">কোনো সুনির্দিষ্ট উপজেলা পাওয়া যায়নি</p>
                      <button
                        type="button"
                        onClick={handleSelectEntireDistrict}
                        className="px-5 py-2.5 bg-[#0B63E5] hover:bg-[#084FC7] text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer transition-colors"
                      >
                        {selectedDis?.name_bn} জেলা সদর নির্বাচন করুন
                      </button>
                    </div>
                  ) : (
                    filteredUpazilas.map((upa) => (
                      <button
                        type="button"
                        key={upa.id}
                        onClick={() => handleSelectUpazila(upa)}
                        className="w-full p-3 text-left hover:bg-[#F8FAFC] dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center justify-between text-[#0F2942] dark:text-slate-200 text-sm font-medium cursor-pointer"
                      >
                        <span>{upa.name_bn}</span>
                        <Check className="w-4 h-4 text-[#0B63E5] opacity-80" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-[#F8FAFC] dark:bg-slate-800/80 border-t border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          {step > 1 && (
            <button
              type="button"
              onClick={() => {
                if (step === 3) setStep(2);
                else if (step === 2) setStep(1);
              }}
              className="flex items-center gap-1 text-[#0B63E5] dark:text-blue-400 hover:underline font-semibold cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              পূর্ববর্তী ধাপ
            </button>
          )}
          <span className="ml-auto">ধাপ {step} / ৩</span>
        </div>
      </div>
    </div>
  );
};
