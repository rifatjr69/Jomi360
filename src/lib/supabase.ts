import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type {
  Division,
  District,
  Upazila,
  Profession,
  Profile,
  PublicProfile,
  ProfileStatus,
  Post,
  SiteSettings,
} from '../types/database';
import {
  DEFAULT_SITE_SETTINGS,
  CANONICAL_PROFESSIONS,
  FALLBACK_DIVISIONS,
  FALLBACK_DISTRICTS,
  FALLBACK_UPAZILAS,
  getFallbackUpazilasForDistrictName,
} from './bangladeshLocations';

// ============================================================================
// 1. SUPABASE CLIENT INITIALIZATION (Strictly from Environment Variables)
// ============================================================================
const rawSupabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawSupabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

function isValidSupabaseConfig(url: string, key: string): boolean {
  if (!url || !key) return false;
  if (!url.startsWith('https://') || url.includes('your-project-id') || url.includes('your-supabase-project')) {
    return false;
  }
  if (
    key === 'PASTE_YOUR_SUPABASE_ANON_KEY_HERE' ||
    key === 'your-supabase-anon-key' ||
    key.includes('P9Q8R0S7T6U5V4W3X2Y1Z0') ||
    key.length < 30
  ) {
    return false;
  }
  return true;
}

export const isSupabaseConfigured: boolean = isValidSupabaseConfig(rawSupabaseUrl, rawSupabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(rawSupabaseUrl, rawSupabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

if (!isSupabaseConfigured) {
  console.error(
    '[Supabase Config] VITE_SUPABASE_URL অথবা VITE_SUPABASE_ANON_KEY সঠিকভাবে সেট করা নেই। অনুগ্রহ করে Environment Variables যাচাই করুন।'
  );
}

export function getSupabaseConfigError(): string | null {
  if (isSupabaseConfigured) return null;
  return 'Supabase সংযোগ কনফিগার করা হয়নি। অনুগ্রহ করে Environment Variables-এ VITE_SUPABASE_URL এবং VITE_SUPABASE_ANON_KEY সেট করুন।';
}

function requireSupabase(): SupabaseClient {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      'ডাটাবেস সংযোগ পাওয়া যায়নি। অনুগ্রহ করে VITE_SUPABASE_URL এবং VITE_SUPABASE_ANON_KEY সেট করুন।'
    );
  }
  return supabase;
}

// ============================================================================
// 2. BANGLA TEXT, DIGIT & ERROR HELPERS
// ============================================================================
const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

export function toEnglishDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  return String(input).replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

export function toBanglaDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  return String(input).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

export function normalizeBn(input: string | null | undefined): string {
  if (!input) return '';
  return String(input)
    .normalize('NFC')
    .replace(/\u09AF\u09BC/g, '\u09DF')
    .replace(/\u09A1\u09BC/g, '\u09DC')
    .replace(/\u09A2\u09BC/g, '\u09DD')
    .replace(/\s+/g, ' ')
    .trim();
}

export function translateSupabaseError(err: any, fallbackMessage = 'সার্ভারে অনুরোধ সম্পন্ন করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।'): string {
  const raw = String(err?.message || err?.error_description || err || '').trim();
  const lower = raw.toLowerCase();

  if (!raw) return fallbackMessage;
  if (/[\u0980-\u09FF]/.test(raw)) return raw;

  if (lower.includes('email not confirmed')) {
    return 'আপনার ই-মেইল ঠিকানাটি এখনো ভেরিফাই করা হয়নি। অনুগ্রহ করে ই-মেইলের ইনবক্স বা স্প্যাম ফোল্ডার চেক করে কনফার্মেশন লিংকে ক্লিক করুন।';
  }
  if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
    return 'ই-মেইল অথবা পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে সঠিক তথ্য দিয়ে চেষ্টা করুন।';
  }
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'এই ই-মেইল ঠিকানা দিয়ে ইতিমধ্যে অ্যাকাউন্ট খোলা হয়েছে। অনুগ্রহ করে লগইন করুন।';
  }
  if (lower.includes('password should be at least')) {
    return 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('security purposes')) {
    return 'অতিরিক্ত চেষ্টার কারণে সাময়িকভাবে বিরতি দেওয়া হয়েছে। কিছুক্ষণ অপেক্ষা করে আবার চেষ্টা করুন।';
  }
  if (lower.includes('row-level security') || lower.includes('permission denied') || err?.code === '42501') {
    return 'ডাটাবেস পারমিশন (RLS Policy) সংক্রান্ত সমস্যা। অনুগ্রহ করে প্রদত্ত RLS SQL কোডটি Supabase SQL Editor-এ রান করুন।';
  }
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('fetch')) {
    return 'ডাটাবেস সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি। ইন্টারনেট সংযোগ অথবা Supabase URL/Anon Key যাচাই করুন।';
  }
  if (lower.includes('invalid api key') || lower.includes('jwt') || err?.status === 401) {
    return 'Supabase Anon Key সঠিক নয়। অনুগ্রহ করে সঠিক VITE_SUPABASE_ANON_KEY ব্যবহার করুন।';
  }
  return fallbackMessage;
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================================
// 3. LOOKUP CACHE (Divisions, Districts, Upazilas, Professions)
// ============================================================================
interface CachedLookup {
  divisions: Division[];
  districts: District[];
  upazilas: Upazila[];
  professions: Profession[];
  rawDivisionIds: Map<string, string | number>;
  rawDistrictIds: Map<string, string | number>;
  rawUpazilaIds: Map<string, string | number>;
  rawProfessionIds: Map<string, string | number>;
  loadedFromDb: {
    divisions: boolean;
    districts: boolean;
    upazilas: boolean;
    professions: boolean;
  };
}

const lookupCache: CachedLookup = {
  divisions: [...FALLBACK_DIVISIONS],
  districts: [...FALLBACK_DISTRICTS],
  upazilas: [...FALLBACK_UPAZILAS],
  professions: [...CANONICAL_PROFESSIONS],
  rawDivisionIds: new Map(),
  rawDistrictIds: new Map(),
  rawUpazilaIds: new Map(),
  rawProfessionIds: new Map(),
  loadedFromDb: {
    divisions: false,
    districts: false,
    upazilas: false,
    professions: false,
  },
};

let lookupInitPromise: Promise<void> | null = null;

async function ensureLookupsLoaded(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  if (
    lookupCache.loadedFromDb.divisions &&
    lookupCache.loadedFromDb.districts &&
    lookupCache.loadedFromDb.professions
  ) {
    return;
  }
  if (lookupInitPromise) return lookupInitPromise;

  lookupInitPromise = (async () => {
    try {
      await Promise.all([
        fetchDivisions(),
        fetchDistricts(),
        fetchUpazilas(),
        fetchProfessions(),
      ]);
    } catch (err) {
      console.error('[Supabase] ensureLookupsLoaded error:', err);
    } finally {
      lookupInitPromise = null;
    }
  })();

  return lookupInitPromise;
}

export async function fetchDivisions(): Promise<Division[]> {
  if (!isSupabaseConfigured || !supabase) {
    return FALLBACK_DIVISIONS;
  }
  try {
    const { data, error } = await supabase.from('divisions').select('*').order('id', { ascending: true });
    if (error) {
      console.error('[Supabase] fetchDivisions error:', error);
      return lookupCache.divisions;
    }
    if (data && data.length > 0) {
      const normalized: Division[] = data
        .filter((r: any) => r.is_active !== false)
        .map((r: any) => {
          const strId = String(r.id);
          lookupCache.rawDivisionIds.set(strId, r.id);
          return {
            id: strId,
            name_bn: normalizeBn(r.name_bn || r.name || ''),
            name_en: String(r.name_en || ''),
            is_active: r.is_active !== false,
          };
        });
      lookupCache.divisions = normalized;
      lookupCache.loadedFromDb.divisions = true;
      return normalized;
    }
    return FALLBACK_DIVISIONS;
  } catch (err) {
    console.error('[Supabase] fetchDivisions exception:', err);
    return lookupCache.divisions;
  }
}

export async function fetchDistricts(divisionId?: string): Promise<District[]> {
  if (isSupabaseConfigured && supabase && !lookupCache.loadedFromDb.districts) {
    try {
      const { data, error } = await supabase.from('districts').select('*').order('id', { ascending: true });
      if (error) {
        console.error('[Supabase] fetchDistricts error:', error);
      } else if (data && data.length > 0) {
        const normalized: District[] = data
          .filter((r: any) => r.is_active !== false)
          .map((r: any) => {
            const strId = String(r.id);
            lookupCache.rawDistrictIds.set(strId, r.id);
            return {
              id: strId,
              division_id: String(r.division_id),
              name_bn: normalizeBn(r.name_bn || r.name || ''),
              is_active: r.is_active !== false,
            };
          });
        lookupCache.districts = normalized;
        lookupCache.loadedFromDb.districts = true;
      }
    } catch (err) {
      console.error('[Supabase] fetchDistricts exception:', err);
    }
  }

  if (!divisionId) {
    return lookupCache.districts;
  }

  const targetDivId = String(divisionId);
  const directMatches = lookupCache.districts.filter((d) => String(d.division_id) === targetDivId);
  if (directMatches.length > 0) {
    return directMatches;
  }

  // Fallback match by division name if DB districts table was empty
  const divObj =
    lookupCache.divisions.find((d) => String(d.id) === targetDivId) ||
    FALLBACK_DIVISIONS.find((d) => d.id === targetDivId);
  if (divObj) {
    const fbDiv = FALLBACK_DIVISIONS.find((d) => normalizeBn(d.name_bn) === normalizeBn(divObj.name_bn));
    if (fbDiv) {
      return FALLBACK_DISTRICTS.filter((d) => d.division_id === fbDiv.id).map((d) => ({
        ...d,
        division_id: targetDivId,
      }));
    }
  }
  return [];
}

export async function fetchUpazilas(districtId?: string): Promise<Upazila[]> {
  if (isSupabaseConfigured && supabase && !lookupCache.loadedFromDb.upazilas) {
    try {
      const { data, error } = await supabase
        .from('upazilas')
        .select('*')
        .limit(1000)
        .order('id', { ascending: true });
      if (error) {
        console.error('[Supabase] fetchUpazilas error:', error);
      } else if (data && data.length > 0) {
        const normalized: Upazila[] = data
          .filter((r: any) => r.is_active !== false)
          .map((r: any) => {
            const strId = String(r.id);
            lookupCache.rawUpazilaIds.set(strId, r.id);
            return {
              id: strId,
              district_id: String(r.district_id),
              name_bn: normalizeBn(r.name_bn || r.name || ''),
              is_active: r.is_active !== false,
            };
          });
        lookupCache.upazilas = normalized;
        lookupCache.loadedFromDb.upazilas = true;
      }
    } catch (err) {
      console.error('[Supabase] fetchUpazilas exception:', err);
    }
  }

  if (!districtId) {
    return lookupCache.upazilas;
  }

  const targetDisId = String(districtId);
  if (targetDisId.startsWith('dis-all-')) return [];

  const directMatches = lookupCache.upazilas.filter((u) => String(u.district_id) === targetDisId);
  if (directMatches.length > 0) {
    return directMatches;
  }

  // Fallback match by district Bangla name if upazilas for this district aren't seeded yet
  const disObj =
    lookupCache.districts.find((d) => String(d.id) === targetDisId) ||
    FALLBACK_DISTRICTS.find((d) => d.id === targetDisId);
  if (disObj) {
    return getFallbackUpazilasForDistrictName(normalizeBn(disObj.name_bn), targetDisId);
  }

  return [];
}

export async function fetchProfessions(): Promise<Profession[]> {
  if (!isSupabaseConfigured || !supabase) {
    return CANONICAL_PROFESSIONS;
  }
  try {
    const { data, error } = await supabase
      .from('professions')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[Supabase] fetchProfessions error:', error);
      return lookupCache.professions;
    }

    if (data && data.length > 0) {
      const dbList: Profession[] = data
        .filter((r: any) => r.is_active !== false)
        .map((r: any, idx: number) => {
          const strId = String(r.id);
          lookupCache.rawProfessionIds.set(strId, r.id);
          const cleanName = normalizeBn(r.name_bn || r.name || '');
          const canonical = CANONICAL_PROFESSIONS.find(
            (cp) => normalizeBn(cp.name_bn) === cleanName || cp.slug === r.slug
          );
          return {
            id: strId,
            name_bn: canonical ? canonical.name_bn : cleanName,
            slug: String(r.slug || canonical?.slug || `prof-${idx + 1}`),
            sort_order: Number(r.sort_order ?? canonical?.sort_order ?? idx + 1),
            is_active: r.is_active !== false,
          };
        });

      // Ensure all 6 required filter chips exist (e.g. 'অন্যান্য')
      CANONICAL_PROFESSIONS.forEach((canon) => {
        const exists = dbList.some(
          (p) => normalizeBn(p.name_bn) === normalizeBn(canon.name_bn) || p.slug === canon.slug
        );
        if (!exists) {
          dbList.push(canon);
        }
      });

      dbList.sort((a, b) => a.sort_order - b.sort_order);
      lookupCache.professions = dbList;
      lookupCache.loadedFromDb.professions = true;
      return dbList;
    }

    return CANONICAL_PROFESSIONS;
  } catch (err) {
    console.error('[Supabase] fetchProfessions exception:', err);
    return lookupCache.professions;
  }
}

// ============================================================================
// 4. LOCATION & PROFESSION NAME RESOLUTION + FOREIGN KEY CONVERSION
// ============================================================================
export function resolveLocationNames(
  dId: any,
  disId: any,
  uId: any,
  extraInfo?: Record<string, any> | null
): { division_name: string; district_name: string; upazila_name: string } {
  const divStr = dId !== null && dId !== undefined ? String(dId) : '';
  const disStr = disId !== null && disId !== undefined ? String(disId) : '';
  const upaStr = uId !== null && uId !== undefined ? String(uId) : '';

  const divObj =
    lookupCache.divisions.find((d) => String(d.id) === divStr) ||
    FALLBACK_DIVISIONS.find((d) => d.id === divStr);

  const disObj =
    !disStr.startsWith('dis-all-')
      ? lookupCache.districts.find((d) => String(d.id) === disStr) ||
        FALLBACK_DISTRICTS.find((d) => d.id === disStr)
      : undefined;

  let upaObj =
    !upaStr.startsWith('upa-all-') && !upaStr.startsWith('upa-default-')
      ? lookupCache.upazilas.find((u) => String(u.id) === upaStr) ||
        FALLBACK_UPAZILAS.find((u) => u.id === upaStr)
      : undefined;

  if (!upaObj && upaStr.startsWith('fallback-upa-') && disObj) {
    const fbUpas = getFallbackUpazilasForDistrictName(normalizeBn(disObj.name_bn), disStr);
    upaObj = fbUpas.find((u) => u.id === upaStr);
  }

  const division_name = divObj?.name_bn || extraInfo?._division_name || extraInfo?.division_name || '';
  const district_name = disObj?.name_bn || extraInfo?._district_name || extraInfo?.district_name || '';
  const upazila_name = upaObj?.name_bn || extraInfo?._upazila_name || extraInfo?.upazila_name || '';

  return { division_name, district_name, upazila_name };
}

export function resolveProfessionName(
  profId: any,
  extraInfo?: Record<string, any> | null
): string {
  const pStr = profId !== null && profId !== undefined ? String(profId) : '';
  const profObj =
    lookupCache.professions.find((p) => String(p.id) === pStr) ||
    CANONICAL_PROFESSIONS.find(
      (p) => p.id === pStr || p.slug === pStr || normalizeBn(p.name_bn) === normalizeBn(pStr)
    );
  return profObj?.name_bn || extraInfo?._profession_name || extraInfo?.profession_name || 'অন্যান্য';
}

function toDbForeignKey(
  val: any,
  kind: 'division' | 'district' | 'upazila' | 'profession'
): string | number | null {
  if (val === null || val === undefined || val === '') return null;
  const s = String(val).trim();
  if (
    !s ||
    s === 'all' ||
    s.startsWith('dis-all-') ||
    s.startsWith('upa-all-') ||
    s.startsWith('upa-default-') ||
    s.startsWith('fallback-')
  ) {
    return null;
  }

  if (kind === 'division') {
    if (lookupCache.rawDivisionIds.has(s)) return lookupCache.rawDivisionIds.get(s)!;
    const fb = FALLBACK_DIVISIONS.find((d) => d.id === s || normalizeBn(d.name_bn) === normalizeBn(s));
    if (fb) {
      const dbMatch = lookupCache.divisions.find((d) => normalizeBn(d.name_bn) === normalizeBn(fb.name_bn));
      if (dbMatch && lookupCache.rawDivisionIds.has(dbMatch.id)) {
        return lookupCache.rawDivisionIds.get(dbMatch.id)!;
      }
    }
  } else if (kind === 'district') {
    if (lookupCache.rawDistrictIds.has(s)) return lookupCache.rawDistrictIds.get(s)!;
    const fb = FALLBACK_DISTRICTS.find((d) => d.id === s || normalizeBn(d.name_bn) === normalizeBn(s));
    if (fb) {
      const dbMatch = lookupCache.districts.find((d) => normalizeBn(d.name_bn) === normalizeBn(fb.name_bn));
      if (dbMatch && lookupCache.rawDistrictIds.has(dbMatch.id)) {
        return lookupCache.rawDistrictIds.get(dbMatch.id)!;
      }
    }
  } else if (kind === 'upazila') {
    if (lookupCache.rawUpazilaIds.has(s)) return lookupCache.rawUpazilaIds.get(s)!;
    const fb = FALLBACK_UPAZILAS.find((u) => u.id === s || normalizeBn(u.name_bn) === normalizeBn(s));
    if (fb) {
      const dbMatch = lookupCache.upazilas.find((u) => normalizeBn(u.name_bn) === normalizeBn(fb.name_bn));
      if (dbMatch && lookupCache.rawUpazilaIds.has(dbMatch.id)) {
        return lookupCache.rawUpazilaIds.get(dbMatch.id)!;
      }
    }
  } else if (kind === 'profession') {
    if (lookupCache.rawProfessionIds.has(s)) return lookupCache.rawProfessionIds.get(s)!;
    const canon = CANONICAL_PROFESSIONS.find(
      (p) => p.id === s || p.slug === s || normalizeBn(p.name_bn) === normalizeBn(s)
    );
    if (canon) {
      const dbMatch = lookupCache.professions.find(
        (p) => normalizeBn(p.name_bn) === normalizeBn(canon.name_bn) || p.slug === canon.slug
      );
      if (dbMatch && lookupCache.rawProfessionIds.has(dbMatch.id)) {
        return lookupCache.rawProfessionIds.get(dbMatch.id)!;
      }
    }
    // If 'prof-6' (অন্যান্য) is not in professions table yet, return null so FK doesn't fail
    if (s.startsWith('prof-')) return null;
  }

  if (/^\d+$/.test(s)) return Number(s);
  return s;
}

function normalizeProfileRow(raw: any): Profile {
  const extra = raw?.extra_info && typeof raw.extra_info === 'object' ? raw.extra_info : {};
  return {
    id: String(raw.id),
    auth_user_id: raw.auth_user_id ? String(raw.auth_user_id) : null,
    user_serial: Number(raw.user_serial || 1),
    full_name: String(raw.full_name || ''),
    email: raw.email ? String(raw.email) : null,
    phone: String(raw.phone || ''),
    profession_id: raw.profession_id !== null && raw.profession_id !== undefined ? String(raw.profession_id) : '',
    division_id: raw.division_id !== null && raw.division_id !== undefined ? String(raw.division_id) : '',
    district_id: raw.district_id !== null && raw.district_id !== undefined ? String(raw.district_id) : '',
    upazila_id: raw.upazila_id !== null && raw.upazila_id !== undefined ? String(raw.upazila_id) : '',
    address_detail: raw.address_detail ?? null,
    nid_number: raw.nid_number ?? null,
    nid_photo_url: raw.nid_photo_url ?? null,
    profile_photo_url: raw.profile_photo_url ?? null,
    cover_photo_url: raw.cover_photo_url ?? null,
    bio: raw.bio ?? null,
    extra_info: extra,
    role: raw.role === 'admin' ? 'admin' : 'user',
    status: (['pending', 'approved', 'rejected', 'suspended'].includes(raw.status)
      ? raw.status
      : 'approved') as ProfileStatus,
    is_verified: Boolean(raw.is_verified),
    created_at: raw.created_at || new Date().toISOString(),
  };
}

function enrichProfileToPublic(raw: any): PublicProfile {
  const base = normalizeProfileRow(raw);
  const loc = resolveLocationNames(base.division_id, base.district_id, base.upazila_id, base.extra_info);
  const profName =
    (raw.profession_name ? normalizeBn(raw.profession_name) : '') ||
    resolveProfessionName(base.profession_id, base.extra_info);

  return {
    id: base.id,
    auth_user_id: base.auth_user_id,
    user_serial: base.user_serial,
    full_name: base.full_name,
    email: base.email,
    phone: base.phone,
    profession_id: base.profession_id,
    profession_name: profName,
    division_id: base.division_id,
    division_name: (raw.division_name ? normalizeBn(raw.division_name) : '') || loc.division_name,
    district_id: base.district_id,
    district_name: (raw.district_name ? normalizeBn(raw.district_name) : '') || loc.district_name,
    upazila_id: base.upazila_id,
    upazila_name: (raw.upazila_name ? normalizeBn(raw.upazila_name) : '') || loc.upazila_name,
    address_detail: base.address_detail,
    profile_photo_url: base.profile_photo_url,
    cover_photo_url: base.cover_photo_url,
    bio: base.bio,
    extra_info: base.extra_info,
    role: base.role,
    status: base.status,
    is_verified: base.is_verified,
    created_at: base.created_at,
  };
}

// ============================================================================
// 5. SITE SETTINGS
// ============================================================================
export async function fetchSiteSettings(): Promise<SiteSettings> {
  if (!isSupabaseConfigured || !supabase) {
    return DEFAULT_SITE_SETTINGS;
  }
  try {
    const { data, error } = await supabase.from('site_settings').select('*');
    if (error) {
      console.error('[Supabase] fetchSiteSettings error:', error);
      return DEFAULT_SITE_SETTINGS;
    }
    if (!data || data.length === 0) {
      return DEFAULT_SITE_SETTINGS;
    }

    // Support both key-value rows (key, value) and single-row object
    if ('key' in data[0] && 'value' in data[0]) {
      const merged: Record<string, any> = { ...DEFAULT_SITE_SETTINGS };
      data.forEach((row: any) => {
        if (row.key && row.value !== undefined && row.value !== null) {
          merged[row.key] = String(row.value);
        }
      });
      return merged as SiteSettings;
    }

    return {
      ...DEFAULT_SITE_SETTINGS,
      ...data[0],
    };
  } catch (err) {
    console.error('[Supabase] fetchSiteSettings exception:', err);
    return DEFAULT_SITE_SETTINGS;
  }
}

export async function updateSiteSettingsInDb(settings: Partial<SiteSettings>): Promise<SiteSettings> {
  const client = requireSupabase();
  try {
    const rows = Object.entries(settings).map(([key, value]) => ({
      key,
      value: String(value ?? ''),
    }));

    const { error } = await client.from('site_settings').upsert(rows, { onConflict: 'key' });
    if (error) {
      console.error('[Supabase] updateSiteSettingsInDb error:', error);
      throw new Error(translateSupabaseError(error, 'সাইট সেটিংস সংরক্ষণ ব্যর্থ হয়েছে।'));
    }
    return fetchSiteSettings();
  } catch (err: any) {
    console.error('[Supabase] updateSiteSettingsInDb exception:', err);
    throw new Error(translateSupabaseError(err, 'সাইট সেটিংস সংরক্ষণ ব্যর্থ হয়েছে।'));
  }
}

// ============================================================================
// 6. IMAGE UPLOAD & COMPRESSION HELPER
// ============================================================================
async function compressImageToDataUrl(file: File, maxDim = 600, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ফাইল রিড করতে সমস্যা হয়েছে।'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(reader.result as string);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadProfileMedia(
  file: File,
  bucket: 'avatars' | 'post-images' | 'nid-docs',
  folder: string
): Promise<string> {
  if (isSupabaseConfigured && supabase) {
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });

      if (error) {
        console.error(`[Supabase Storage] upload to ${bucket} failed, falling back to compressed image:`, error);
      } else {
        if (bucket === 'nid-docs') {
          return path;
        }
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
        if (pub?.publicUrl) return pub.publicUrl;
      }
    } catch (err) {
      console.error(`[Supabase Storage] upload exception on ${bucket}:`, err);
    }
  }

  return compressImageToDataUrl(file, bucket === 'avatars' ? 480 : 900, 0.8);
}

export async function uploadPostImage(file: File, profileId: string): Promise<string | null> {
  return uploadProfileMedia(file, 'post-images', profileId);
}

export async function adminGetSignedNidUrl(nidPathOrUrl: string): Promise<string | null> {
  if (!nidPathOrUrl) return null;
  if (nidPathOrUrl.startsWith('http') || nidPathOrUrl.startsWith('data:')) {
    return nidPathOrUrl;
  }
  const client = requireSupabase();
  try {
    const { data, error } = await client.storage.from('nid-docs').createSignedUrl(nidPathOrUrl, 60);
    if (error) {
      console.error('[Supabase] adminGetSignedNidUrl error:', error);
      return null;
    }
    return data?.signedUrl || null;
  } catch (err) {
    console.error('[Supabase] adminGetSignedNidUrl exception:', err);
    return null;
  }
}

// ============================================================================
// 7. PUBLIC PROFILES DIRECTORY QUERY (Combined Search + Profession + Location)
// ============================================================================
export interface PublicProfileFilters {
  search?: string;
  profession_id?: string;
  profession_name?: string;
  division_id?: string;
  division_name?: string;
  district_id?: string;
  district_name?: string;
  upazila_id?: string;
  upazila_name?: string;
  sortBy?: 'newest' | 'oldest';
  limit?: number;
  throwOnError?: boolean;
}

export function matchesSearchClientSide(profile: PublicProfile, rawSearch: string): boolean {
  const trimmed = rawSearch.trim();
  if (!trimmed) return true;

  const qLower = trimmed.toLowerCase();
  const qNormBn = normalizeBn(trimmed).toLowerCase();
  const qEnDigits = toEnglishDigits(trimmed).replace(/^#/, '').toLowerCase();
  const qDigitsOnly = qEnDigits.replace(/\D/g, '');

  const nameMatch =
    profile.full_name.toLowerCase().includes(qLower) ||
    normalizeBn(profile.full_name).toLowerCase().includes(qNormBn);

  const phoneEn = toEnglishDigits(profile.phone);
  const phoneMatch =
    phoneEn.includes(qEnDigits) || (qDigitsOnly.length >= 2 && phoneEn.replace(/\D/g, '').includes(qDigitsOnly));

  const serialStr = String(profile.user_serial || '');
  const paddedSerial = serialStr.padStart(5, '0');
  const serialMatch =
    qDigitsOnly.length > 0 && (serialStr.includes(qDigitsOnly) || paddedSerial.includes(qDigitsOnly));

  const extra = profile.extra_info || {};
  const licenseNo = toEnglishDigits(extra.license_no || '').toLowerCase();
  const barNo = toEnglishDigits(extra.bar_council_no || '').toLowerCase();
  const nidNo = toEnglishDigits((profile as any).nid_number || '').toLowerCase();
  const idMatch =
    (Boolean(licenseNo) && licenseNo.includes(qEnDigits)) ||
    (Boolean(barNo) && barNo.includes(qEnDigits)) ||
    (Boolean(nidNo) && nidNo.includes(qEnDigits));

  return nameMatch || phoneMatch || serialMatch || idMatch;
}

export async function fetchPublicProfiles(filters: PublicProfileFilters = {}): Promise<PublicProfile[]> {
  if (!isSupabaseConfigured || !supabase) {
    if (filters.throwOnError) {
      throw new Error(getSupabaseConfigError() || 'Supabase কনফিগার করা হয়নি।');
    }
    return [];
  }

  await ensureLookupsLoaded();

  try {
    const ascending = filters.sortBy === 'oldest';
    const maxLimit = filters.limit || 500;

    let query = supabase
      .from('profiles')
      .select('*')
      .eq('status', 'approved');

    // Combined SQL filters where database foreign key IDs exist
    const dbProfId =
      filters.profession_id && filters.profession_id !== 'all'
        ? toDbForeignKey(filters.profession_id, 'profession')
        : null;
    if (dbProfId !== null) {
      query = query.eq('profession_id', dbProfId);
    }

    const dbDivId = filters.division_id ? toDbForeignKey(filters.division_id, 'division') : null;
    if (dbDivId !== null) {
      query = query.eq('division_id', dbDivId);
    }

    const dbDisId = filters.district_id ? toDbForeignKey(filters.district_id, 'district') : null;
    if (dbDisId !== null) {
      query = query.eq('district_id', dbDisId);
    }

    const dbUpaId = filters.upazila_id ? toDbForeignKey(filters.upazila_id, 'upazila') : null;
    if (dbUpaId !== null) {
      query = query.eq('upazila_id', dbUpaId);
    }

    // Combined SQL search with ilike + or() handling both Bangla and English digits
    const rawSearch = (filters.search || '').trim();
    const hasBanglaOrLicenseSearch = Boolean(rawSearch);
    if (rawSearch) {
      const safeRaw = rawSearch.replace(/[,%()]/g, ' ').trim();
      const safeEn = toEnglishDigits(safeRaw).replace(/^#/, '').trim();
      const safeBn = toBanglaDigits(safeEn).trim();

      if (safeRaw) {
        const orClauses = [
          `full_name.ilike.%${safeRaw}%`,
          `phone.ilike.%${safeEn}%`,
        ];
        if (safeBn && safeBn !== safeEn) {
          orClauses.push(`phone.ilike.%${safeBn}%`);
        }
        if (/^\d+$/.test(safeEn) && Number(safeEn) > 0 && Number(safeEn) < 2147483647) {
          orClauses.push(`user_serial.eq.${Number(safeEn)}`);
        }
        query = query.or(orClauses.join(','));
      }
    }

    const { data, error } = await query
      .order('created_at', { ascending })
      .limit(maxLimit);

    let rows: any[] = [];

    if (error) {
      console.error('[Supabase] fetchPublicProfiles (profiles table) error:', error);
      // Fallback to public_profiles view if direct select on profiles failed (e.g. before RLS update)
      const { data: viewData, error: viewError } = await supabase
        .from('public_profiles')
        .select('*')
        .order('created_at', { ascending })
        .limit(maxLimit);

      if (viewError) {
        console.error('[Supabase] fetchPublicProfiles (public_profiles view) error:', viewError);
        if (filters.throwOnError) {
          throw new Error(translateSupabaseError(error, 'পেশাজীবীদের তালিকা লোড করতে সমস্যা হয়েছে।'));
        }
        return [];
      }
      rows = viewData || [];
    } else {
      rows = data || [];
    }

    let list = rows.map(enrichProfileToPublic);

    // Ensure exact matching for fallback/custom professions, fallback upazilas, and license/Bangla digits
    if (filters.profession_id && filters.profession_id !== 'all') {
      const targetProf = lookupCache.professions.find((p) => String(p.id) === String(filters.profession_id));
      const targetProfName = normalizeBn(filters.profession_name || targetProf?.name_bn || '');
      list = list.filter(
        (p) =>
          String(p.profession_id) === String(filters.profession_id) ||
          (targetProfName && normalizeBn(p.profession_name) === targetProfName)
      );
    }

    if (filters.division_id) {
      const targetDiv = lookupCache.divisions.find((d) => String(d.id) === String(filters.division_id));
      const targetDivName = normalizeBn(filters.division_name || targetDiv?.name_bn || '');
      list = list.filter(
        (p) =>
          String(p.division_id) === String(filters.division_id) ||
          (targetDivName && normalizeBn(p.division_name) === targetDivName)
      );
    }

    if (filters.district_id && !String(filters.district_id).startsWith('dis-all-')) {
      const targetDis = lookupCache.districts.find((d) => String(d.id) === String(filters.district_id));
      const targetDisName = normalizeBn(filters.district_name || targetDis?.name_bn || '');
      list = list.filter(
        (p) =>
          String(p.district_id) === String(filters.district_id) ||
          (targetDisName && normalizeBn(p.district_name) === targetDisName)
      );
    }

    if (filters.upazila_id && !String(filters.upazila_id).startsWith('upa-all-')) {
      const targetUpa = lookupCache.upazilas.find((u) => String(u.id) === String(filters.upazila_id));
      const targetUpaName = normalizeBn(filters.upazila_name || targetUpa?.name_bn || '');
      list = list.filter(
        (p) =>
          String(p.upazila_id) === String(filters.upazila_id) ||
          (targetUpaName && normalizeBn(p.upazila_name) === targetUpaName)
      );
    }

    if (hasBanglaOrLicenseSearch) {
      list = list.filter((p) => matchesSearchClientSide(p, rawSearch));
    }

    return list;
  } catch (err: any) {
    console.error('[Supabase] fetchPublicProfiles exception:', err);
    if (filters.throwOnError) {
      throw new Error(translateSupabaseError(err, 'পেশাজীবীদের তালিকা লোড করতে সমস্যা হয়েছে।'));
    }
    return [];
  }
}

export async function fetchPublicProfileById(id: string): Promise<PublicProfile | null> {
  if (!isSupabaseConfigured || !supabase || !id) return null;
  await ensureLookupsLoaded();

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[Supabase] fetchPublicProfileById (profiles) error:', error);
      const { data: viewData, error: viewErr } = await supabase
        .from('public_profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (viewErr) {
        console.error('[Supabase] fetchPublicProfileById (public_profiles) error:', viewErr);
        return null;
      }
      return viewData ? enrichProfileToPublic(viewData) : null;
    }

    return data ? enrichProfileToPublic(data) : null;
  } catch (err) {
    console.error('[Supabase] fetchPublicProfileById exception:', err);
    return null;
  }
}

// ============================================================================
// 8. AUTHENTICATION, EMAIL BACKFILL & PROFILE UPSERT
// ============================================================================
export const getCurrentSessionProfile = (): Profile | null => null;

function buildProfileDbPayload(input: Record<string, any>): Record<string, any> {
  const locNames = resolveLocationNames(
    input.division_id,
    input.district_id,
    input.upazila_id,
    input.extra_info
  );
  const profName = resolveProfessionName(input.profession_id, input.extra_info);

  const mergedExtra = {
    ...(input.extra_info && typeof input.extra_info === 'object' ? input.extra_info : {}),
    ...(locNames.division_name ? { _division_name: locNames.division_name } : {}),
    ...(locNames.district_name ? { _district_name: locNames.district_name } : {}),
    ...(locNames.upazila_name ? { _upazila_name: locNames.upazila_name } : {}),
    ...(profName ? { _profession_name: profName } : {}),
  };

  const payload: Record<string, any> = {
    full_name: String(input.full_name || '').trim(),
    phone: toEnglishDigits(input.phone || '').trim(),
    extra_info: mergedExtra,
  };

  if (input.id) payload.id = input.id;
  if (input.auth_user_id !== undefined) payload.auth_user_id = input.auth_user_id;
  if (input.email !== undefined) {
    payload.email = input.email ? String(input.email).trim().toLowerCase() : null;
  }

  if (input.profession_id !== undefined) {
    payload.profession_id = toDbForeignKey(input.profession_id, 'profession');
  }
  if (input.division_id !== undefined) {
    payload.division_id = toDbForeignKey(input.division_id, 'division');
  }
  if (input.district_id !== undefined) {
    payload.district_id = toDbForeignKey(input.district_id, 'district');
  }
  if (input.upazila_id !== undefined) {
    payload.upazila_id = toDbForeignKey(input.upazila_id, 'upazila');
  }
  if (input.address_detail !== undefined) {
    payload.address_detail = input.address_detail ? String(input.address_detail).trim() : null;
  }
  if (input.nid_number !== undefined) {
    payload.nid_number = input.nid_number ? toEnglishDigits(input.nid_number).trim() : null;
  }
  if (input.nid_photo_url !== undefined) {
    payload.nid_photo_url = input.nid_photo_url || null;
  }
  if (input.profile_photo_url !== undefined) {
    payload.profile_photo_url = input.profile_photo_url || null;
  }
  if (input.cover_photo_url !== undefined) {
    payload.cover_photo_url = input.cover_photo_url || null;
  }
  if (input.bio !== undefined) {
    payload.bio = input.bio ? String(input.bio).trim() : null;
  }
  if (input.role !== undefined) {
    payload.role = input.role;
  }
  if (input.status !== undefined) {
    payload.status = input.status;
  }
  if (input.is_verified !== undefined) {
    payload.is_verified = Boolean(input.is_verified);
  }

  return payload;
}

/**
 * Loads the logged-in user's profile from `profiles`, automatically backfilling
 * `email` and `auth_user_id` if missing, or auto-creating a row if none exists.
 */
export async function syncAuthenticatedUserProfile(authUser: User): Promise<Profile | null> {
  const client = requireSupabase();
  await ensureLookupsLoaded();

  const authEmail = authUser.email ? authUser.email.trim().toLowerCase() : null;
  const pendingStorageKey = authEmail ? `jomi360_pending_profile_${authEmail}` : null;
  let pendingData: Record<string, any> | null = null;
  if (pendingStorageKey) {
    try {
      const rawPending = localStorage.getItem(pendingStorageKey);
      if (rawPending) pendingData = JSON.parse(rawPending);
    } catch {
      // ignore storage parse issues
    }
  }

  try {
    // 1. Find existing row by id = authUser.id OR auth_user_id = authUser.id
    let existingRow: any = null;
    const { data: byIdData, error: byIdError } = await client
      .from('profiles')
      .select('*')
      .or(`id.eq.${authUser.id},auth_user_id.eq.${authUser.id}`)
      .limit(1);

    if (byIdError) {
      console.error('[Supabase] syncAuthenticatedUserProfile lookup by id/auth_user_id error:', byIdError);
    } else if (byIdData && byIdData.length > 0) {
      existingRow = byIdData[0];
    }

    // 2. Fallback lookup by email if admin created a profile with this email earlier
    if (!existingRow && authEmail) {
      const { data: byEmailData, error: byEmailError } = await client
        .from('profiles')
        .select('*')
        .ilike('email', authEmail)
        .limit(1);

      if (byEmailError) {
        console.error('[Supabase] syncAuthenticatedUserProfile lookup by email error:', byEmailError);
      } else if (byEmailData && byEmailData.length > 0) {
        existingRow = byEmailData[0];
      }
    }

    // 3. If row exists: backfill missing email, auth_user_id, or pending registration fields
    if (existingRow) {
      const updates: Record<string, any> = {};
      if (authEmail && existingRow.email !== authEmail) {
        updates.email = authEmail;
      }
      if (existingRow.auth_user_id !== authUser.id) {
        updates.auth_user_id = authUser.id;
      }
      if (pendingData) {
        if (!existingRow.phone && pendingData.phone) updates.phone = pendingData.phone;
        if (!existingRow.full_name && pendingData.full_name) updates.full_name = pendingData.full_name;
        if (!existingRow.profession_id && pendingData.profession_id !== undefined) {
          updates.profession_id = pendingData.profession_id;
        }
        if (!existingRow.division_id && pendingData.division_id !== undefined) {
          updates.division_id = pendingData.division_id;
        }
        if (!existingRow.district_id && pendingData.district_id !== undefined) {
          updates.district_id = pendingData.district_id;
        }
        if (!existingRow.upazila_id && pendingData.upazila_id !== undefined) {
          updates.upazila_id = pendingData.upazila_id;
        }
        if (!existingRow.nid_number && pendingData.nid_number) updates.nid_number = pendingData.nid_number;
        if (!existingRow.profile_photo_url && pendingData.profile_photo_url) {
          updates.profile_photo_url = pendingData.profile_photo_url;
        }
        if (pendingData.extra_info) {
          updates.extra_info = { ...(existingRow.extra_info || {}), ...pendingData.extra_info };
        }
      }

      if (Object.keys(updates).length > 0) {
        const { data: updatedRow, error: updateErr } = await client
          .from('profiles')
          .update(updates)
          .eq('id', existingRow.id)
          .select('*')
          .maybeSingle();

        if (updateErr) {
          console.error('[Supabase] syncAuthenticatedUserProfile backfill update error:', updateErr);
        } else if (updatedRow) {
          existingRow = updatedRow;
          if (pendingStorageKey) localStorage.removeItem(pendingStorageKey);
        }
      } else if (pendingStorageKey) {
        localStorage.removeItem(pendingStorageKey);
      }

      return normalizeProfileRow(existingRow);
    }

    // 4. No profile row exists yet -> auto-insert/upsert with id = authUser.id & email = authUser.email
    const meta = authUser.user_metadata || {};
    const defaultProfId = lookupCache.professions[0]?.id;
    const defaultDivId = lookupCache.divisions[0]?.id;
    const defaultDisId = lookupCache.districts[0]?.id;
    const defaultUpaId = lookupCache.upazilas[0]?.id;

    const newProfilePayload = buildProfileDbPayload({
      id: authUser.id,
      auth_user_id: authUser.id,
      email: authEmail,
      full_name: pendingData?.full_name || meta.full_name || (authEmail ? authEmail.split('@')[0] : 'পেশাজীবী'),
      phone: pendingData?.phone || meta.phone || '',
      profession_id: pendingData?.profession_id ?? meta.profession_id ?? defaultProfId,
      division_id: pendingData?.division_id ?? meta.division_id ?? defaultDivId,
      district_id: pendingData?.district_id ?? meta.district_id ?? defaultDisId,
      upazila_id: pendingData?.upazila_id ?? meta.upazila_id ?? defaultUpaId,
      address_detail: pendingData?.address_detail ?? meta.address_detail ?? null,
      nid_number: pendingData?.nid_number ?? meta.nid_number ?? null,
      nid_photo_url: pendingData?.nid_photo_url ?? null,
      profile_photo_url: pendingData?.profile_photo_url ?? null,
      bio: pendingData?.bio ?? null,
      extra_info: pendingData?.extra_info ?? meta.extra_info ?? {},
      role: 'user',
      status: 'pending',
      is_verified: false,
    });

    const { data: insertedRow, error: insertError } = await client
      .from('profiles')
      .upsert(newProfilePayload, { onConflict: 'id' })
      .select('*')
      .single();

    if (insertError) {
      console.error('[Supabase] syncAuthenticatedUserProfile auto-insert error:', insertError);
      return null;
    }

    if (pendingStorageKey) localStorage.removeItem(pendingStorageKey);
    return normalizeProfileRow(insertedRow);
  } catch (err) {
    console.error('[Supabase] syncAuthenticatedUserProfile exception:', err);
    return null;
  }
}

export interface RegisterProfessionalParams {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  profession_id: string;
  division_id: string;
  district_id: string;
  upazila_id?: string;
  address_detail?: string;
  nid_number?: string;
  bio?: string;
  profile_photo_file?: File | null;
  nid_photo_file?: File | null;
  extra_info?: Record<string, any>;
}

export async function registerProfessionalUser(params: RegisterProfessionalParams): Promise<{
  profile: Profile | null;
  auth_user_id: string;
  requiresEmailConfirmation: boolean;
}> {
  const client = requireSupabase();
  await ensureLookupsLoaded();

  const cleanEmail = params.email.trim().toLowerCase();
  const cleanPhone = toEnglishDigits(params.phone.trim());
  const cleanNid = params.nid_number ? toEnglishDigits(params.nid_number.trim()) : null;

  try {
    // 1. Sign up in Supabase Auth with full metadata so trigger can also read it
    const { data: authData, error: authError } = await client.auth.signUp({
      email: cleanEmail,
      password: params.password,
      options: {
        data: {
          full_name: params.full_name.trim(),
          phone: cleanPhone,
          email: cleanEmail,
        },
      },
    });

    if (authError) {
      console.error('[Supabase] registerProfessionalUser signUp error:', authError);
      throw new Error(translateSupabaseError(authError, 'রেজিস্ট্রেশন সম্পন্ন করা যায়নি।'));
    }

    const authUser = authData.user;
    if (!authUser) {
      throw new Error('অ্যাকাউন্ট তৈরি করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    }

    // Supabase returns obfuscated user with empty identities if email already exists when confirmation is on
    if (Array.isArray(authUser.identities) && authUser.identities.length === 0) {
      throw new Error('এই ই-মেইল ঠিকানা দিয়ে ইতিমধ্যে অ্যাকাউন্ট খোলা হয়েছে। অনুগ্রহ করে লগইন করুন।');
    }

    // 2. Upload photos after signUp (uses session if auto-confirmed, or compressed fallback)
    let profilePhotoUrl: string | null = null;
    let nidPhotoUrl: string | null = null;

    if (params.profile_photo_file) {
      profilePhotoUrl = await uploadProfileMedia(params.profile_photo_file, 'avatars', authUser.id);
    }
    if (params.nid_photo_file) {
      nidPhotoUrl = await uploadProfileMedia(params.nid_photo_file, 'nid-docs', authUser.id);
    }

    // Check if an auth.users trigger already inserted a row for this user
    let targetProfileId = authUser.id;
    if (authData.session) {
      const { data: existingRows } = await client
        .from('profiles')
        .select('id')
        .or(`id.eq.${authUser.id},auth_user_id.eq.${authUser.id}`)
        .limit(1);
      if (existingRows && existingRows.length > 0) {
        targetProfileId = String(existingRows[0].id);
      }
    }

    const dbPayload = buildProfileDbPayload({
      id: targetProfileId,
      auth_user_id: authUser.id,
      email: cleanEmail,
      full_name: params.full_name.trim(),
      phone: cleanPhone,
      profession_id: params.profession_id,
      division_id: params.division_id,
      district_id: params.district_id,
      upazila_id: params.upazila_id,
      address_detail: params.address_detail,
      nid_number: cleanNid,
      nid_photo_url: nidPhotoUrl,
      profile_photo_url: profilePhotoUrl,
      bio: params.bio,
      extra_info: params.extra_info || {},
      role: 'user',
      status: 'pending',
      is_verified: false,
    });

    // 3. Upsert into profiles table
    const { data: savedRow, error: saveError } = await client
      .from('profiles')
      .upsert(dbPayload, { onConflict: 'id' })
      .select('*')
      .maybeSingle();

    if (saveError) {
      console.error('[Supabase] registerProfessionalUser profile upsert error:', saveError);

      // If email confirmation is ON (session === null), RLS with auth.uid() = id blocks client insert until login
      if (!authData.session) {
        try {
          localStorage.setItem(`jomi360_pending_profile_${cleanEmail}`, JSON.stringify(dbPayload));
        } catch {
          // ignore storage quota errors
        }
        return {
          profile: null,
          auth_user_id: authUser.id,
          requiresEmailConfirmation: true,
        };
      }

      throw new Error(translateSupabaseError(saveError, 'প্রোফাইল ডাটাবেসে সংরক্ষণ করতে সমস্যা হয়েছে।'));
    }

    return {
      profile: savedRow ? normalizeProfileRow(savedRow) : null,
      auth_user_id: authUser.id,
      requiresEmailConfirmation: !authData.session,
    };
  } catch (err: any) {
    console.error('[Supabase] registerProfessionalUser exception:', err);
    throw new Error(translateSupabaseError(err, 'রেজিস্ট্রেশন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।'));
  }
}

export async function loginUser(email: string, password: string): Promise<Profile | null> {
  const client = requireSupabase();
  const cleanEmail = email.trim().toLowerCase();

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      console.error('[Supabase] loginUser error:', error);
      throw new Error(translateSupabaseError(error, 'ই-মেইল অথবা পাসওয়ার্ড সঠিক নয়।'));
    }

    if (!data.user) {
      throw new Error('লগইন সেশন তৈরি করা যায়নি।');
    }

    return await syncAuthenticatedUserProfile(data.user);
  } catch (err: any) {
    console.error('[Supabase] loginUser exception:', err);
    throw new Error(translateSupabaseError(err, 'লগইন ব্যর্থ হয়েছে।'));
  }
}

export async function logoutUser(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[Supabase] logoutUser error:', error);
    }
  } catch (err) {
    console.error('[Supabase] logoutUser exception:', err);
  }
}

export async function resetUserPassword(email: string): Promise<void> {
  const client = requireSupabase();
  try {
    const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/account`,
    });
    if (error) {
      console.error('[Supabase] resetUserPassword error:', error);
      throw new Error(translateSupabaseError(error, 'পাসওয়ার্ড রিসেট ই-মেইল পাঠাতে সমস্যা হয়েছে।'));
    }
  } catch (err: any) {
    console.error('[Supabase] resetUserPassword exception:', err);
    throw new Error(translateSupabaseError(err, 'পাসওয়ার্ড রিসেট ই-মেইল পাঠাতে সমস্যা হয়েছে।'));
  }
}

// ============================================================================
// 9. PROFILE CREATE / EDIT / ADMIN MANAGEMENT (Real Supabase Upsert & Refetch)
// ============================================================================
export async function adminUpdateProfileFull(id: string, data: Record<string, any>): Promise<Profile> {
  const client = requireSupabase();
  await ensureLookupsLoaded();

  try {
    // Fetch existing row first so we preserve extra_info keys, auth_user_id, email, role, status
    const { data: existing, error: fetchErr } = await client
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      console.error('[Supabase] adminUpdateProfileFull fetch existing error:', fetchErr);
    }

    const mergedInput: Record<string, any> = {
      ...(existing || {}),
      ...data,
      id,
      email:
        data.email !== undefined && data.email !== ''
          ? data.email
          : existing?.email ?? null,
      extra_info: {
        ...(existing?.extra_info || {}),
        ...(data.extra_info || {}),
      },
    };

    const payload = buildProfileDbPayload(mergedInput);

    // If upazila_id had a NOT NULL constraint in older DB schemas and user chose district-level only, fallback to first upazila
    if (payload.upazila_id === null && existing?.upazila_id) {
      payload.upazila_id = existing.upazila_id;
    }

    const { data: saved, error } = await client
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single();

    if (error) {
      console.error('[Supabase] adminUpdateProfileFull upsert error:', error);
      throw new Error(translateSupabaseError(error, 'প্রোফাইল সংরক্ষণ ব্যর্থ হয়েছে।'));
    }

    return normalizeProfileRow(saved);
  } catch (err: any) {
    console.error('[Supabase] adminUpdateProfileFull exception:', err);
    throw new Error(translateSupabaseError(err, 'প্রোফাইল সংরক্ষণ ব্যর্থ হয়েছে।'));
  }
}

export async function adminCreateDisplayProfile(data: Record<string, any>): Promise<Profile> {
  const client = requireSupabase();
  await ensureLookupsLoaded();

  try {
    const newId = generateUUID();
    const payload = buildProfileDbPayload({
      ...data,
      id: newId,
      auth_user_id: null,
      email: data.email ? String(data.email).trim().toLowerCase() : null,
      role: 'user',
      status: data.status || 'approved',
      is_verified: data.is_verified ?? true,
    });

    const { data: created, error } = await client
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single();

    if (error) {
      console.error('[Supabase] adminCreateDisplayProfile error:', error);
      throw new Error(translateSupabaseError(error, 'নতুন প্রোফাইল তৈরি করতে সমস্যা হয়েছে।'));
    }

    return normalizeProfileRow(created);
  } catch (err: any) {
    console.error('[Supabase] adminCreateDisplayProfile exception:', err);
    throw new Error(translateSupabaseError(err, 'নতুন প্রোফাইল তৈরি করতে সমস্যা হয়েছে।'));
  }
}

export async function adminFetchAllProfiles(): Promise<Profile[]> {
  const client = requireSupabase();
  await ensureLookupsLoaded();

  try {
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase] adminFetchAllProfiles error:', error);
      throw new Error(translateSupabaseError(error, 'প্রোফাইল তালিকা লোড করতে সমস্যা হয়েছে।'));
    }

    return (data || []).map(normalizeProfileRow);
  } catch (err: any) {
    console.error('[Supabase] adminFetchAllProfiles exception:', err);
    throw new Error(translateSupabaseError(err, 'প্রোফাইল তালিকা লোড করতে সমস্যা হয়েছে।'));
  }
}

export async function adminGetProfileById(id: string): Promise<Profile | null> {
  const client = requireSupabase();
  await ensureLookupsLoaded();

  try {
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[Supabase] adminGetProfileById error:', error);
      return null;
    }

    return data ? normalizeProfileRow(data) : null;
  } catch (err) {
    console.error('[Supabase] adminGetProfileById exception:', err);
    return null;
  }
}

export async function adminUpdateProfileStatus(id: string, status: ProfileStatus): Promise<Profile> {
  const client = requireSupabase();
  try {
    const { data, error } = await client
      .from('profiles')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('[Supabase] adminUpdateProfileStatus error:', error);
      throw new Error(translateSupabaseError(error, 'প্রোফাইলের স্ট্যাটাস আপডেট করা যায়নি।'));
    }
    return normalizeProfileRow(data);
  } catch (err: any) {
    console.error('[Supabase] adminUpdateProfileStatus exception:', err);
    throw new Error(translateSupabaseError(err, 'প্রোফাইলের স্ট্যাটাস আপডেট করা যায়নি।'));
  }
}

export async function adminToggleVerified(id: string, is_verified: boolean): Promise<Profile> {
  const client = requireSupabase();
  try {
    const { data, error } = await client
      .from('profiles')
      .update({ is_verified })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('[Supabase] adminToggleVerified error:', error);
      throw new Error(translateSupabaseError(error, 'ভেরিফিকেশন স্ট্যাটাস আপডেট করা যায়নি।'));
    }
    return normalizeProfileRow(data);
  } catch (err: any) {
    console.error('[Supabase] adminToggleVerified exception:', err);
    throw new Error(translateSupabaseError(err, 'ভেরিফিকেশন স্ট্যাটাস আপডেট করা যায়নি।'));
  }
}

export async function adminDeleteProfile(id: string): Promise<void> {
  const client = requireSupabase();
  try {
    const { error } = await client.from('profiles').delete().eq('id', id);
    if (error) {
      console.error('[Supabase] adminDeleteProfile error:', error);
      throw new Error(translateSupabaseError(error, 'প্রোফাইল মুছে ফেলতে সমস্যা হয়েছে।'));
    }
  } catch (err: any) {
    console.error('[Supabase] adminDeleteProfile exception:', err);
    throw new Error(translateSupabaseError(err, 'প্রোফাইল মুছে ফেলতে সমস্যা হয়েছে।'));
  }
}

// ============================================================================
// 10. POSTS CRUD
// ============================================================================
export async function fetchPostsForProfile(profileId: string): Promise<Post[]> {
  if (!isSupabaseConfigured || !supabase || !profileId) return [];
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('profile_id', profileId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase] fetchPostsForProfile error:', error);
      return [];
    }
    return (data || []) as Post[];
  } catch (err) {
    console.error('[Supabase] fetchPostsForProfile exception:', err);
    return [];
  }
}

export async function createPostInDb(postData: {
  profile_id: string;
  content: string;
  image_url?: string | null;
}): Promise<Post> {
  const client = requireSupabase();
  try {
    const { data, error } = await client
      .from('posts')
      .insert([
        {
          profile_id: postData.profile_id,
          content: postData.content.trim(),
          image_url: postData.image_url || null,
          is_hidden: false,
        },
      ])
      .select('*')
      .single();

    if (error) {
      console.error('[Supabase] createPostInDb error:', error);
      throw new Error(translateSupabaseError(error, 'পোস্ট প্রকাশ করতে সমস্যা হয়েছে।'));
    }
    return data as Post;
  } catch (err: any) {
    console.error('[Supabase] createPostInDb exception:', err);
    throw new Error(translateSupabaseError(err, 'পোস্ট প্রকাশ করতে সমস্যা হয়েছে।'));
  }
}

export async function adminCreatePost(postData: {
  profile_id: string;
  content: string;
  image_url?: string | null;
}): Promise<Post> {
  return createPostInDb(postData);
}

export async function fetchAllPostsForAdmin(): Promise<Post[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase] fetchAllPostsForAdmin error:', error);
      return [];
    }
    return (data || []) as Post[];
  } catch (err) {
    console.error('[Supabase] fetchAllPostsForAdmin exception:', err);
    return [];
  }
}

export async function toggleHidePostInDb(id: string, is_hidden: boolean): Promise<void> {
  const client = requireSupabase();
  try {
    const { error } = await client.from('posts').update({ is_hidden }).eq('id', id);
    if (error) {
      console.error('[Supabase] toggleHidePostInDb error:', error);
      throw new Error(translateSupabaseError(error, 'পোস্ট আপডেট করা যায়নি।'));
    }
  } catch (err: any) {
    console.error('[Supabase] toggleHidePostInDb exception:', err);
    throw new Error(translateSupabaseError(err, 'পোস্ট আপডেট করা যায়নি।'));
  }
}

export async function deletePostInDb(postId: string): Promise<void> {
  const client = requireSupabase();
  try {
    const { error } = await client.from('posts').delete().eq('id', postId);
    if (error) {
      console.error('[Supabase] deletePostInDb error:', error);
      throw new Error(translateSupabaseError(error, 'পোস্ট মুছে ফেলতে সমস্যা হয়েছে।'));
    }
  } catch (err: any) {
    console.error('[Supabase] deletePostInDb exception:', err);
    throw new Error(translateSupabaseError(err, 'পোস্ট মুছে ফেলতে সমস্যা হয়েছে।'));
  }
}