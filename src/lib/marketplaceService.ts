import type { User } from '@supabase/supabase-js';
import type {
  Profile,
  PublicProfile,
  VerificationRequest,
  VerificationStatus,
  Job,
  JobStatus,
  BudgetType,
  WorkMode,
  JobApplication,
  ApplicationStatus,
  JobMessage,
  Review,
  AppNotification,
  NotificationType,
  Banner,
  SiteSettings,
  UserRole,
} from '../types/database';
import {
  supabase,
  isSupabaseConfigured,
  ensureLookupsLoaded,
  resolveLocationNames,
  resolveProfessionName,
  toDbForeignKey,
  toEnglishDigits,
  normalizeBn,
  normalizeProfileRow,
  enrichProfileToPublic,
  uploadPrivateVerificationDoc,
  uploadProfileMedia,
  syncAuthenticatedUserProfile,
  translateSupabaseError,
} from './supabase';
import { saveUserOwnProfile } from './profileService';
import { isJobsRlsError } from './jobsSqlFix';

function requireClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('ডাটাবেস সংযোগ কনফিগার করা হয়নি। অনুগ্রহ করে Supabase Environment Variables যাচাই করুন।');
  }
  return supabase;
}

function logReadError(scope: string, error: any) {
  const code = String(error?.code || '');
  if (code === 'PGRST205' || code === '42P01') {
    console.warn(`[marketplaceService] ${scope}: table not provisioned yet (${code}) — run the Supabase SQL script.`);
    return;
  }
  console.error(`[marketplaceService] ${scope}:`, error);
}

// Helper to map profiles in bulk without exposing sensitive fields or phone numbers prematurely
async function fetchPublicProfileMap(ids: string[], revealPhones = false): Promise<Map<string, PublicProfile>> {
  const map = new Map<string, PublicProfile>();
  if (!isSupabaseConfigured || !supabase) return map;
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return map;

  await ensureLookupsLoaded();
  try {
    const { data, error } = await supabase.from('profiles').select('*').in('id', uniqueIds);
    if (error) {
      console.error('[marketplaceService] fetchPublicProfileMap error:', error);
      return map;
    }
    (data || []).forEach((row: any) => {
      const pub = enrichProfileToPublic(row);
      if (!revealPhones) {
        pub.phone = '';
      }
      map.set(pub.id, pub);
    });
  } catch (err) {
    console.error('[marketplaceService] fetchPublicProfileMap exception:', err);
  }
  return map;
}

// ============================================================================
// 1. NOTIFICATIONS
// ============================================================================
export async function createNotification(params: {
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
}): Promise<void> {
  if (!isSupabaseConfigured || !supabase || !params.user_id) return;
  try {
    const { error } = await supabase.from('notifications').insert([
      {
        user_id: params.user_id,
        type: params.type,
        title: params.title,
        body: params.body,
        link: params.link || null,
        is_read: false,
      },
    ]);
    if (error) {
      console.error('[marketplaceService] createNotification error:', error);
    }
  } catch (err) {
    console.error('[marketplaceService] createNotification exception:', err);
  }
}

export async function fetchMyNotifications(userId: string, limit = 40): Promise<AppNotification[]> {
  if (!isSupabaseConfigured || !supabase || !userId) return [];
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logReadError('fetchMyNotifications error', error);
      return [];
    }
    return (data || []) as AppNotification[];
  } catch (err) {
    console.error('[marketplaceService] fetchMyNotifications exception:', err);
    return [];
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase || !id) return;
  try {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    if (error) {
      console.error('[marketplaceService] markNotificationRead error:', error);
    }
  } catch (err) {
    console.error('[marketplaceService] markNotificationRead exception:', err);
  }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase || !userId) return;
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) {
      console.error('[marketplaceService] markAllNotificationsRead error:', error);
    }
  } catch (err) {
    console.error('[marketplaceService] markAllNotificationsRead exception:', err);
  }
}

// ============================================================================
// 2. VERIFICATION REQUESTS (Sensitive NID + Private Bucket)
// ============================================================================
function normalizeVerificationRow(raw: any): VerificationRequest {
  const loc = resolveLocationNames(raw.division_id, raw.district_id, raw.upazila_id, {
    _division_name: raw.division_name,
    _district_name: raw.district_name,
    _upazila_name: raw.upazila_name,
  });

  return {
    id: String(raw.id),
    user_id: String(raw.user_id),
    profile_id: String(raw.profile_id || raw.user_id),
    full_name: String(raw.full_name || ''),
    phone: String(raw.phone || ''),
    profession_id: raw.profession_id ? String(raw.profession_id) : null,
    category_name: String(raw.category_name || resolveProfessionName(raw.profession_id)),
    division_id: raw.division_id ? String(raw.division_id) : null,
    district_id: raw.district_id ? String(raw.district_id) : null,
    upazila_id: raw.upazila_id ? String(raw.upazila_id) : null,
    division_name: raw.division_name || loc.division_name,
    district_name: raw.district_name || loc.district_name,
    upazila_name: raw.upazila_name || loc.upazila_name,
    short_bio: String(raw.short_bio || ''),
    nid_number: String(raw.nid_number || ''),
    id_front_path: String(raw.id_front_path || ''),
    id_back_path: String(raw.id_back_path || ''),
    selfie_path: String(raw.selfie_path || ''),
    status: (['unverified', 'pending', 'verified', 'rejected'].includes(raw.status)
      ? raw.status
      : 'pending') as VerificationStatus,
    rejection_reason: raw.rejection_reason ?? null,
    reviewed_by: raw.reviewed_by ? String(raw.reviewed_by) : null,
    reviewed_at: raw.reviewed_at ?? null,
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: raw.updated_at || raw.created_at || new Date().toISOString(),
  };
}

export async function fetchMyVerificationRequest(userId: string): Promise<VerificationRequest | null> {
  if (!isSupabaseConfigured || !supabase || !userId) return null;
  await ensureLookupsLoaded();
  try {
    const { data, error } = await supabase
      .from('verification_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logReadError('fetchMyVerificationRequest error', error);
      return null;
    }
    return data ? normalizeVerificationRow(data) : null;
  } catch (err) {
    console.error('[marketplaceService] fetchMyVerificationRequest exception:', err);
    return null;
  }
}

export interface SubmitVerificationInput {
  full_name: string;
  phone: string;
  profession_id: string;
  category_name: string;
  division_id: string;
  district_id: string;
  upazila_id?: string;
  division_name?: string;
  district_name?: string;
  upazila_name?: string;
  short_bio: string;
  nid_number: string;
  id_front_file?: File | null;
  id_back_file?: File | null;
  selfie_file?: File | null;
  existing_front_path?: string;
  existing_back_path?: string;
  existing_selfie_path?: string;
}

export async function submitVerificationRequest(
  authUser: User,
  input: SubmitVerificationInput,
  existingProfileId?: string | null
): Promise<VerificationRequest> {
  const client = requireClient();
  await ensureLookupsLoaded();

  try {
    // 1. Update public-safe profile fields first (never stores NID in profiles)
    const savedProfile = await saveUserOwnProfile(
      authUser,
      {
        full_name: input.full_name.trim(),
        phone: toEnglishDigits(input.phone.trim()),
        profession_id: input.profession_id,
        division_id: input.division_id,
        district_id: input.district_id,
        upazila_id: input.upazila_id || '',
        bio: input.short_bio.trim(),
        extra_info: {
          _division_name: input.division_name || '',
          _district_name: input.district_name || '',
          _upazila_name: input.upazila_name || '',
          _profession_name: input.category_name || '',
        },
      },
      existingProfileId
    );

    // 2. Upload sensitive ID photos & selfie strictly to PRIVATE bucket `verification-docs`
    let frontPath = input.existing_front_path || '';
    let backPath = input.existing_back_path || '';
    let selfiePath = input.existing_selfie_path || '';

    if (input.id_front_file) {
      frontPath = await uploadPrivateVerificationDoc(input.id_front_file, authUser.id, 'front');
    }
    if (input.id_back_file) {
      backPath = await uploadPrivateVerificationDoc(input.id_back_file, authUser.id, 'back');
    }
    if (input.selfie_file) {
      selfiePath = await uploadPrivateVerificationDoc(input.selfie_file, authUser.id, 'selfie');
    }

    if (!frontPath || !backPath || !selfiePath) {
      throw new Error('আইডি কার্ডের সামনের ছবি, পেছনের ছবি এবং সেলফি তিনটিই আপলোড করা আবশ্যিক।');
    }

    const loc = resolveLocationNames(input.division_id, input.district_id, input.upazila_id, {
      _division_name: input.division_name,
      _district_name: input.district_name,
      _upazila_name: input.upazila_name,
    });

    const payload: Record<string, any> = {
      user_id: authUser.id,
      profile_id: savedProfile.id,
      full_name: input.full_name.trim(),
      phone: toEnglishDigits(input.phone.trim()),
      profession_id: toDbForeignKey(input.profession_id, 'profession'),
      category_name: input.category_name || resolveProfessionName(input.profession_id),
      division_id: toDbForeignKey(input.division_id, 'division'),
      district_id: toDbForeignKey(input.district_id, 'district'),
      upazila_id: toDbForeignKey(input.upazila_id, 'upazila'),
      division_name: loc.division_name || input.division_name || '',
      district_name: loc.district_name || input.district_name || '',
      upazila_name: loc.upazila_name || input.upazila_name || '',
      short_bio: input.short_bio.trim(),
      nid_number: toEnglishDigits(input.nid_number.trim()),
      id_front_path: frontPath,
      id_back_path: backPath,
      selfie_path: selfiePath,
      status: 'pending',
      rejection_reason: null,
      reviewed_by: null,
      reviewed_at: null,
      updated_at: new Date().toISOString(),
    };

    const { data: existingReq } = await client
      .from('verification_requests')
      .select('id')
      .eq('user_id', authUser.id)
      .maybeSingle();

    let savedRow: any = null;
    if (existingReq?.id) {
      const { data, error } = await client
        .from('verification_requests')
        .update(payload)
        .eq('id', existingReq.id)
        .select('*')
        .single();
      if (error) {
        console.error('[marketplaceService] update verification_requests error:', error);
        throw new Error(translateSupabaseError(error, 'ভেরিফিকেশন আবেদন আপডেট করা যায়নি।'));
      }
      savedRow = data;
    } else {
      const { data, error } = await client
        .from('verification_requests')
        .insert([payload])
        .select('*')
        .single();
      if (error) {
        console.error('[marketplaceService] insert verification_requests error:', error);
        throw new Error(translateSupabaseError(error, 'ভেরিফিকেশন আবেদন জমা দেওয়া যায়নি।'));
      }
      savedRow = data;
    }

    return normalizeVerificationRow(savedRow);
  } catch (err: any) {
    console.error('[marketplaceService] submitVerificationRequest error:', err);
    throw new Error(translateSupabaseError(err, 'ভেরিফিকেশন আবেদন জমা দিতে সমস্যা হয়েছে।'));
  }
}

export async function adminFetchVerificationRequests(statusFilter = 'all'): Promise<VerificationRequest[]> {
  const client = requireClient();
  await ensureLookupsLoaded();
  try {
    let query = client.from('verification_requests').select('*').order('updated_at', { ascending: false });
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    const { data, error } = await query;
    if (error) {
      console.error('[marketplaceService] adminFetchVerificationRequests error:', error);
      throw new Error(translateSupabaseError(error, 'ভেরিফিকেশন তালিকা লোড করা যায়নি।'));
    }
    return (data || []).map(normalizeVerificationRow);
  } catch (err: any) {
    console.error('[marketplaceService] adminFetchVerificationRequests exception:', err);
    throw new Error(translateSupabaseError(err, 'ভেরিফিকেশন তালিকা লোড করা যায়নি।'));
  }
}

export async function adminReviewVerificationRequest(params: {
  request: VerificationRequest;
  action: 'approve' | 'reject';
  rejection_reason?: string;
  admin_user_id: string;
}): Promise<void> {
  const client = requireClient();
  const { request, action, rejection_reason, admin_user_id } = params;
  const newStatus: VerificationStatus = action === 'approve' ? 'verified' : 'rejected';
  const reason = action === 'reject' ? (rejection_reason || '').trim() : null;

  if (action === 'reject' && !reason) {
    throw new Error('প্রত্যাখ্যান করার কারণ উল্লেখ করা আবশ্যিক।');
  }

  try {
    const { error: reqErr } = await client
      .from('verification_requests')
      .update({
        status: newStatus,
        rejection_reason: reason,
        reviewed_by: admin_user_id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', request.id);

    if (reqErr) {
      console.error('[marketplaceService] adminReviewVerificationRequest reqErr:', reqErr);
      throw new Error(translateSupabaseError(reqErr, 'ভেরিফিকেশন স্ট্যাটাস আপডেট ব্যর্থ হয়েছে।'));
    }

    const profileUpdates: Record<string, any> = {
      verification_status: newStatus,
      is_verified: action === 'approve',
      verification_rejection_reason: reason,
      ...(action === 'approve' ? { status: 'approved' } : {}),
      updated_at: new Date().toISOString(),
    };

    const { error: profErr } = await client
      .from('profiles')
      .update(profileUpdates)
      .or(`id.eq.${request.profile_id},auth_user_id.eq.${request.user_id}`);

    if (profErr) {
      console.error('[marketplaceService] adminReviewVerificationRequest profErr:', profErr);
      throw new Error(translateSupabaseError(profErr, 'প্রোফাইল ভেরিফিকেশন আপডেট ব্যর্থ হয়েছে।'));
    }

    await createNotification({
      user_id: request.user_id,
      type: action === 'approve' ? 'verification_approved' : 'verification_rejected',
      title:
        action === 'approve'
          ? 'প্রোফাইল ভেরিফিকেশন অনুমোদিত হয়েছে!'
          : 'প্রোফাইল ভেরিফিকেশন প্রত্যাখ্যাত হয়েছে',
      body:
        action === 'approve'
          ? 'অভিনন্দন! আপনার প্রোফাইলটি ভেরিফাইড হিসেবে অনুমোদিত হয়েছে এবং পাবলিক ডিরেক্টরিতে যুক্ত হয়েছে।'
          : `দুঃখিত, আপনার ভেরিফিকেশন আবেদনটি গৃহীত হয়নি। কারণ: ${reason}`,
      link: '/verify',
    });
  } catch (err: any) {
    console.error('[marketplaceService] adminReviewVerificationRequest exception:', err);
    throw new Error(translateSupabaseError(err, 'ভেরিফিকেশন রিভিউ সম্পন্ন করা যায়নি।'));
  }
}

// ============================================================================
// 3. JOBS MARKETPLACE
// ============================================================================
function normalizeJobRow(raw: any, profileMap?: Map<string, PublicProfile>): Job {
  const loc = resolveLocationNames(raw.division_id, raw.district_id, raw.upazila_id, {
    _division_name: raw.division_name,
    _district_name: raw.district_name,
    _upazila_name: raw.upazila_name,
  });

  const attachments = Array.isArray(raw.attachments)
    ? raw.attachments.map(String)
    : typeof raw.attachments === 'string' && raw.attachments.trim()
    ? [raw.attachments.trim()]
    : [];

  const posterId = String(raw.poster_id || '');
  const assignedTo = raw.assigned_to ? String(raw.assigned_to) : null;

  return {
    id: String(raw.id),
    poster_id: posterId,
    assigned_to: assignedTo,
    title: String(raw.title || ''),
    description: String(raw.description || ''),
    category: String(raw.category || resolveProfessionName(raw.profession_id)),
    profession_id: raw.profession_id ? String(raw.profession_id) : null,
    budget_type: (raw.budget_type === 'negotiable' ? 'negotiable' : 'fixed') as BudgetType,
    budget_min: raw.budget_min !== null && raw.budget_min !== undefined ? Number(raw.budget_min) : null,
    budget_max: raw.budget_max !== null && raw.budget_max !== undefined ? Number(raw.budget_max) : null,
    deadline: raw.deadline ?? null,
    division_id: raw.division_id ? String(raw.division_id) : null,
    district_id: raw.district_id ? String(raw.district_id) : null,
    upazila_id: raw.upazila_id ? String(raw.upazila_id) : null,
    division_name: raw.division_name || loc.division_name || '',
    district_name: raw.district_name || loc.district_name || '',
    upazila_name: raw.upazila_name || loc.upazila_name || '',
    work_mode: (raw.work_mode === 'remote' ? 'remote' : 'onsite') as WorkMode,
    attachments,
    status: ([
      'pending_approval',
      'open',
      'in_progress',
      'delivered',
      'completed',
      'rejected',
      'cancelled',
      'closed',
    ].includes(raw.status)
      ? raw.status
      : 'open') as JobStatus,
    admin_note: raw.admin_note ?? null,
    delivered_at: raw.delivered_at ?? null,
    completed_at: raw.completed_at ?? null,
    applications_count: raw.applications_count !== undefined ? Number(raw.applications_count) : undefined,
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: raw.updated_at || raw.created_at || new Date().toISOString(),
    poster: profileMap?.get(posterId) || null,
    assignee: assignedTo ? profileMap?.get(assignedTo) || null : null,
  };
}

export interface JobFilters {
  search?: string;
  category?: string;
  division_id?: string;
  division_name?: string;
  district_id?: string;
  district_name?: string;
  upazila_id?: string;
  upazila_name?: string;
  work_mode?: string;
  budget_min?: number | null;
  budget_max?: number | null;
  sortBy?: 'newest' | 'budget_high' | 'budget_low' | 'deadline';
  throwOnRlsError?: boolean;
}

export async function fetchPublicJobs(filters: JobFilters = {}): Promise<Job[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  await ensureLookupsLoaded();

  try {
    let query = supabase.from('jobs').select('*').eq('status', 'open');

    if (filters.work_mode && filters.work_mode !== 'all') {
      query = query.eq('work_mode', filters.work_mode);
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(300);

    if (error) {
      logReadError('fetchPublicJobs error', error);
      if (filters.throwOnRlsError && isJobsRlsError(error)) {
        throw error;
      }
      return [];
    }

    const rows = data || [];
    const posterIds = rows.map((r: any) => String(r.poster_id || '')).filter(Boolean);
    const profileMap = await fetchPublicProfileMap(posterIds, false);

    let list = rows.map((r: any) => normalizeJobRow(r, profileMap));

    if (filters.category && filters.category !== 'all') {
      const normCat = normalizeBn(filters.category);
      const isOtherCat = normCat === normalizeBn('অন্যান্য');
      list = list.filter((j) => {
        const jobCat = normalizeBn(j.category);
        if (jobCat === normCat || String(j.profession_id) === String(filters.category)) {
          return true;
        }
        if (isOtherCat && jobCat.includes(normalizeBn('অন্যান্য'))) {
          return true;
        }
        return false;
      });
    }

    if (filters.division_id) {
      const normDiv = normalizeBn(filters.division_name || '');
      list = list.filter(
        (j) =>
          String(j.division_id) === String(filters.division_id) ||
          (normDiv && normalizeBn(j.division_name) === normDiv)
      );
    }

    if (filters.district_id && !String(filters.district_id).startsWith('dis-all-')) {
      const normDis = normalizeBn(filters.district_name || '');
      list = list.filter(
        (j) =>
          String(j.district_id) === String(filters.district_id) ||
          (normDis && normalizeBn(j.district_name) === normDis)
      );
    }

    if (filters.upazila_id && !String(filters.upazila_id).startsWith('upa-all-')) {
      const normUpa = normalizeBn(filters.upazila_name || '');
      list = list.filter(
        (j) =>
          String(j.upazila_id) === String(filters.upazila_id) ||
          (normUpa && normalizeBn(j.upazila_name) === normUpa)
      );
    }

    if (filters.budget_min !== null && filters.budget_min !== undefined && filters.budget_min > 0) {
      list = list.filter((j) => {
        const val = j.budget_max ?? j.budget_min ?? 0;
        return val >= (filters.budget_min as number);
      });
    }

    if (filters.budget_max !== null && filters.budget_max !== undefined && filters.budget_max > 0) {
      list = list.filter((j) => {
        const val = j.budget_min ?? j.budget_max ?? 0;
        return val <= (filters.budget_max as number);
      });
    }

    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      const qBn = normalizeBn(filters.search.trim()).toLowerCase();
      list = list.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          normalizeBn(j.title).toLowerCase().includes(qBn) ||
          j.description.toLowerCase().includes(q) ||
          normalizeBn(j.description).toLowerCase().includes(qBn) ||
          normalizeBn(j.category).toLowerCase().includes(qBn)
      );
    }

    if (filters.sortBy === 'budget_high') {
      list.sort((a, b) => (b.budget_max ?? b.budget_min ?? 0) - (a.budget_max ?? a.budget_min ?? 0));
    } else if (filters.sortBy === 'budget_low') {
      list.sort((a, b) => (a.budget_min ?? a.budget_max ?? 0) - (b.budget_min ?? b.budget_max ?? 0));
    } else if (filters.sortBy === 'deadline') {
      list.sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
    }

    return list;
  } catch (err) {
    console.error('[marketplaceService] fetchPublicJobs exception:', err);
    if (filters.throwOnRlsError && isJobsRlsError(err)) {
      throw err;
    }
    return [];
  }
}

export async function fetchJobById(
  jobId: string,
  options?: { throwOnRlsError?: boolean }
): Promise<Job | null> {
  if (!isSupabaseConfigured || !supabase || !jobId) return null;
  await ensureLookupsLoaded();
  try {
    const { data, error } = await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle();
    if (error) {
      console.error('[marketplaceService] fetchJobById error:', error);
      if (options?.throwOnRlsError && isJobsRlsError(error)) {
        throw error;
      }
      return null;
    }
    if (!data) return null;

    const idsToLoad = [String(data.poster_id || ''), data.assigned_to ? String(data.assigned_to) : ''].filter(Boolean);
    const profileMap = await fetchPublicProfileMap(idsToLoad, false);
    return normalizeJobRow(data, profileMap);
  } catch (err) {
    console.error('[marketplaceService] fetchJobById exception:', err);
    if (options?.throwOnRlsError && isJobsRlsError(err)) {
      throw err;
    }
    return null;
  }
}

export async function fetchMutualJobContacts(
  job: Job,
  viewerId: string | null | undefined,
  isAdmin = false
): Promise<{ posterPhone: string | null; workerPhone: string | null }> {
  if (!isSupabaseConfigured || !supabase || !job.assigned_to || !viewerId) {
    return { posterPhone: null, workerPhone: null };
  }

  const isParty = viewerId === job.poster_id || viewerId === job.assigned_to || isAdmin;
  if (!isParty) {
    return { posterPhone: null, workerPhone: null };
  }

  try {
    // Try secure RPC first if installed, else fallback to authorized profiles query
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_hired_job_contacts', {
      p_job_id: job.id,
    });
    if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
      return {
        posterPhone: rpcData[0].poster_phone || null,
        workerPhone: rpcData[0].worker_phone || null,
      };
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, auth_user_id, phone')
      .or(`id.eq.${job.poster_id},auth_user_id.eq.${job.poster_id},id.eq.${job.assigned_to},auth_user_id.eq.${job.assigned_to}`);

    if (error) {
      console.error('[marketplaceService] fetchMutualJobContacts error:', error);
      return { posterPhone: null, workerPhone: null };
    }

    let posterPhone: string | null = null;
    let workerPhone: string | null = null;
    (data || []).forEach((r: any) => {
      if (String(r.id) === job.poster_id || String(r.auth_user_id) === job.poster_id) {
        posterPhone = r.phone || null;
      }
      if (String(r.id) === job.assigned_to || String(r.auth_user_id) === job.assigned_to) {
        workerPhone = r.phone || null;
      }
    });

    return { posterPhone, workerPhone };
  } catch (err) {
    console.error('[marketplaceService] fetchMutualJobContacts exception:', err);
    return { posterPhone: null, workerPhone: null };
  }
}

export interface CreateJobInput {
  title: string;
  description: string;
  category: string;
  profession_id?: string | null;
  budget_type: BudgetType;
  budget_min: number | null;
  budget_max: number | null;
  deadline: string | null;
  division_id?: string | null;
  district_id?: string | null;
  upazila_id?: string | null;
  division_name?: string;
  district_name?: string;
  upazila_name?: string;
  work_mode: WorkMode;
  attachment_files?: File[];
  existing_attachments?: string[];
}

export async function createJob(
  authUser: User,
  profile: Profile | null,
  input: CreateJobInput,
  settings: SiteSettings
): Promise<Job> {
  const client = requireClient();
  await ensureLookupsLoaded();

  const activeProfile = profile || (await syncAuthenticatedUserProfile(authUser));

  const isAdmin = activeProfile?.role === 'admin';
  const isVerified =
    activeProfile?.verification_status === 'verified' || Boolean(activeProfile?.is_verified);

  if (activeProfile?.is_suspended) {
    throw new Error('আপনার অ্যাকাউন্টটি সাময়িকভাবে স্থগিত করা হয়েছে।');
  }

  if (settings.require_verified_to_post_job && !isVerified && !isAdmin) {
    throw new Error('জব পোস্ট করার জন্য আপনার প্রোফাইল ভেরিফাইড হওয়া আবশ্যিক।');
  }

  try {
    const uploadedAttachments: string[] = [...(input.existing_attachments || [])];
    if (input.attachment_files && input.attachment_files.length > 0) {
      for (const file of input.attachment_files) {
        const url = await uploadProfileMedia(file, 'job-attachments', authUser.id);
        if (url) uploadedAttachments.push(url);
      }
    }

    const loc = resolveLocationNames(input.division_id, input.district_id, input.upazila_id, {
      _division_name: input.division_name,
      _district_name: input.district_name,
      _upazila_name: input.upazila_name,
    });

    const initialStatus: JobStatus =
      !settings.require_job_approval || isAdmin ? 'open' : 'pending_approval';

    const payload: Record<string, any> = {
      poster_id: activeProfile?.id || authUser.id,
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category.trim(),
      profession_id: input.profession_id ? toDbForeignKey(input.profession_id, 'profession') : null,
      budget_type: input.budget_type,
      budget_min: input.budget_min,
      budget_max: input.budget_max,
      deadline: input.deadline || null,
      division_id: input.division_id ? toDbForeignKey(input.division_id, 'division') : null,
      district_id: input.district_id ? toDbForeignKey(input.district_id, 'district') : null,
      upazila_id: input.upazila_id ? toDbForeignKey(input.upazila_id, 'upazila') : null,
      division_name: loc.division_name || input.division_name || '',
      district_name: loc.district_name || input.district_name || '',
      upazila_name: loc.upazila_name || input.upazila_name || '',
      work_mode: input.work_mode,
      attachments: uploadedAttachments,
      status: initialStatus,
    };

    const { data, error } = await client.from('jobs').insert([payload]).select('*').single();
    if (error) {
      console.error('[marketplaceService] createJob error:', error);
      if (isJobsRlsError(error)) {
        throw error;
      }
      throw new Error(translateSupabaseError(error, 'জব পোস্ট করতে সমস্যা হয়েছে।'));
    }

    return normalizeJobRow(data);
  } catch (err: any) {
    console.error('[marketplaceService] createJob exception:', err);
    if (isJobsRlsError(err)) {
      throw err;
    }
    throw new Error(translateSupabaseError(err, 'জব পোস্ট করতে সমস্যা হয়েছে।'));
  }
}

export async function updateJobInDb(jobId: string, updates: Partial<Job> & Record<string, any>): Promise<Job> {
  const client = requireClient();
  try {
    const cleanUpdates: Record<string, any> = {
      ...updates,
      updated_at: new Date().toISOString(),
    };
    delete cleanUpdates.poster;
    delete cleanUpdates.assignee;
    delete cleanUpdates.applications_count;

    if ('division_id' in cleanUpdates) {
      cleanUpdates.division_id = toDbForeignKey(cleanUpdates.division_id, 'division');
    }
    if ('district_id' in cleanUpdates) {
      cleanUpdates.district_id = toDbForeignKey(cleanUpdates.district_id, 'district');
    }
    if ('upazila_id' in cleanUpdates) {
      cleanUpdates.upazila_id = toDbForeignKey(cleanUpdates.upazila_id, 'upazila');
    }
    if ('profession_id' in cleanUpdates) {
      cleanUpdates.profession_id = toDbForeignKey(cleanUpdates.profession_id, 'profession');
    }

    const { data, error } = await client
      .from('jobs')
      .update(cleanUpdates)
      .eq('id', jobId)
      .select('*')
      .single();

    if (error) {
      console.error('[marketplaceService] updateJobInDb error:', error);
      throw new Error(translateSupabaseError(error, 'জব আপডেট করা যায়নি।'));
    }
    return normalizeJobRow(data);
  } catch (err: any) {
    console.error('[marketplaceService] updateJobInDb exception:', err);
    throw new Error(translateSupabaseError(err, 'জব আপডেট করা যায়নি।'));
  }
}

export async function updateOwnJobStatus(
  jobId: string,
  status: 'open' | 'closed' | 'cancelled'
): Promise<Job> {
  return updateJobInDb(jobId, { status });
}

export async function deleteOwnJob(jobId: string): Promise<void> {
  const client = requireClient();
  try {
    const { error } = await client.from('jobs').delete().eq('id', jobId);
    if (error) {
      console.error('[marketplaceService] deleteOwnJob error:', error);
      throw new Error(translateSupabaseError(error, 'জব মুছে ফেলতে সমস্যা হয়েছে।'));
    }
  } catch (err: any) {
    console.error('[marketplaceService] deleteOwnJob exception:', err);
    throw new Error(translateSupabaseError(err, 'জব মুছে ফেলতে সমস্যা হয়েছে।'));
  }
}

export async function fetchMyPostedJobs(
  posterIds: string | string[],
  options?: { throwOnRlsError?: boolean }
): Promise<Job[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const ids = Array.from(
    new Set((Array.isArray(posterIds) ? posterIds : [posterIds]).filter(Boolean))
  );
  if (ids.length === 0) return [];

  await ensureLookupsLoaded();
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .in('poster_id', ids)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[marketplaceService] fetchMyPostedJobs error:', error);
      if (options?.throwOnRlsError && isJobsRlsError(error)) {
        throw error;
      }
      return [];
    }

    const rows = data || [];
    const jobIds = rows.map((r: any) => String(r.id));
    const assigneeIds = rows.map((r: any) => (r.assigned_to ? String(r.assigned_to) : '')).filter(Boolean);
    const profileMap = await fetchPublicProfileMap(assigneeIds, true);

    const countMap = new Map<string, number>();
    if (jobIds.length > 0) {
      const { data: appRows } = await supabase
        .from('job_applications')
        .select('job_id')
        .in('job_id', jobIds)
        .neq('status', 'withdrawn');
      (appRows || []).forEach((a: any) => {
        const jId = String(a.job_id);
        countMap.set(jId, (countMap.get(jId) || 0) + 1);
      });
    }

    return rows.map((r: any) => {
      const j = normalizeJobRow(r, profileMap);
      j.applications_count = countMap.get(j.id) || 0;
      return j;
    });
  } catch (err) {
    console.error('[marketplaceService] fetchMyPostedJobs exception:', err);
    if (options?.throwOnRlsError && isJobsRlsError(err)) {
      throw err;
    }
    return [];
  }
}

// ============================================================================
// 4. APPLICATIONS, HIRING, DELIVERY & COMPLETION
// ============================================================================
function normalizeApplicationRow(
  raw: any,
  profileMap?: Map<string, PublicProfile>,
  jobMap?: Map<string, Job>
): JobApplication {
  const applicantId = String(raw.applicant_id || '');
  const jobId = String(raw.job_id || '');
  return {
    id: String(raw.id),
    job_id: jobId,
    applicant_id: applicantId,
    cover_letter: String(raw.cover_letter || ''),
    proposed_price: Number(raw.proposed_price || 0),
    estimated_days: Number(raw.estimated_days || 1),
    status: (['pending', 'accepted', 'rejected', 'withdrawn'].includes(raw.status)
      ? raw.status
      : 'pending') as ApplicationStatus,
    is_admin_approved: raw.is_admin_approved !== false,
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: raw.updated_at || raw.created_at || new Date().toISOString(),
    applicant: profileMap?.get(applicantId) || null,
    job: jobMap?.get(jobId) || null,
  };
}

export async function fetchJobApplications(
  jobId: string,
  requireAdminApproval = false
): Promise<JobApplication[]> {
  if (!isSupabaseConfigured || !supabase || !jobId) return [];
  try {
    let query = supabase
      .from('job_applications')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    if (requireAdminApproval) {
      query = query.eq('is_admin_approved', true);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[marketplaceService] fetchJobApplications error:', error);
      return [];
    }

    const rows = data || [];
    const applicantIds = rows.map((r: any) => String(r.applicant_id || '')).filter(Boolean);
    const profileMap = await fetchPublicProfileMap(applicantIds, false);

    return rows.map((r: any) => normalizeApplicationRow(r, profileMap));
  } catch (err) {
    console.error('[marketplaceService] fetchJobApplications exception:', err);
    return [];
  }
}

export async function fetchMyApplications(
  applicantIds: string | string[],
  options?: { throwOnRlsError?: boolean }
): Promise<JobApplication[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const ids = Array.from(
    new Set((Array.isArray(applicantIds) ? applicantIds : [applicantIds]).filter(Boolean))
  );
  if (ids.length === 0) return [];

  try {
    const { data, error } = await supabase
      .from('job_applications')
      .select('*')
      .in('applicant_id', ids)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[marketplaceService] fetchMyApplications error:', error);
      if (options?.throwOnRlsError && isJobsRlsError(error)) {
        throw error;
      }
      return [];
    }

    const rows = data || [];
    const jobIds = Array.from(new Set(rows.map((r: any) => String(r.job_id || '')).filter(Boolean)));
    const jobMap = new Map<string, Job>();

    if (jobIds.length > 0) {
      const { data: jobRows } = await supabase.from('jobs').select('*').in('id', jobIds);
      const posterIds = (jobRows || []).map((j: any) => String(j.poster_id || '')).filter(Boolean);
      const profMap = await fetchPublicProfileMap(posterIds, false);
      (jobRows || []).forEach((j: any) => {
        const norm = normalizeJobRow(j, profMap);
        jobMap.set(norm.id, norm);
      });
    }

    return rows.map((r: any) => normalizeApplicationRow(r, undefined, jobMap));
  } catch (err) {
    console.error('[marketplaceService] fetchMyApplications exception:', err);
    if (options?.throwOnRlsError && isJobsRlsError(err)) {
      throw err;
    }
    return [];
  }
}

export async function submitJobApplication(params: {
  job: Job;
  applicantProfile: Profile;
  cover_letter: string;
  proposed_price: number;
  estimated_days: number;
  settings: SiteSettings;
}): Promise<JobApplication> {
  const client = requireClient();
  const { job, applicantProfile, cover_letter, proposed_price, estimated_days, settings } = params;

  if (applicantProfile.is_suspended) {
    throw new Error('আপনার অ্যাকাউন্টটি সাময়িকভাবে স্থগিত করা হয়েছে।');
  }
  if (
    job.poster_id === applicantProfile.id ||
    (applicantProfile.auth_user_id && job.poster_id === applicantProfile.auth_user_id)
  ) {
    throw new Error('আপনি নিজের পোস্ট করা জবে আবেদন করতে পারবেন না।');
  }
  if (job.status !== 'open') {
    throw new Error('এই জবে বর্তমানে নতুন আবেদন গ্রহণ করা হচ্ছে না।');
  }

  const isVerified =
    applicantProfile.verification_status === 'verified' || Boolean(applicantProfile.is_verified);
  if (settings.require_verified_to_apply_job && !isVerified && applicantProfile.role !== 'admin') {
    throw new Error('জবে আবেদন করার জন্য আপনার প্রোফাইল ভেরিফাইড হওয়া আবশ্যিক।');
  }

  try {
    const isAdminApproved = !settings.require_application_approval || applicantProfile.role === 'admin';

    // Check if an earlier withdrawn application row exists for (job_id, applicant_id)
    const { data: existingApp } = await client
      .from('job_applications')
      .select('id, status')
      .eq('job_id', job.id)
      .eq('applicant_id', applicantProfile.id)
      .maybeSingle();

    let savedRow: any = null;

    if (existingApp?.id) {
      if (existingApp.status !== 'withdrawn') {
        throw new Error('আপনি ইতিমধ্যে এই জবে একবার আবেদন করেছেন।');
      }
      const { data, error } = await client
        .from('job_applications')
        .update({
          cover_letter: cover_letter.trim(),
          proposed_price,
          estimated_days,
          status: 'pending',
          is_admin_approved: isAdminApproved,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingApp.id)
        .select('*')
        .single();

      if (error) {
        console.error('[marketplaceService] re-submitJobApplication error:', error);
        if (isJobsRlsError(error)) throw error;
        throw new Error(translateSupabaseError(error, 'আবেদন জমা দিতে সমস্যা হয়েছে।'));
      }
      savedRow = data;
    } else {
      const { data, error } = await client
        .from('job_applications')
        .insert([
          {
            job_id: job.id,
            applicant_id: applicantProfile.id,
            cover_letter: cover_letter.trim(),
            proposed_price,
            estimated_days,
            status: 'pending',
            is_admin_approved: isAdminApproved,
          },
        ])
        .select('*')
        .single();

      if (error) {
        console.error('[marketplaceService] submitJobApplication error:', error);
        if (isJobsRlsError(error)) throw error;
        if (String(error.code) === '23505' || String(error.message || '').toLowerCase().includes('duplicate')) {
          throw new Error('আপনি ইতিমধ্যে এই জবে একবার আবেদন করেছেন।');
        }
        throw new Error(translateSupabaseError(error, 'আবেদন জমা দিতে সমস্যা হয়েছে।'));
      }
      savedRow = data;
    }

    if (isAdminApproved) {
      await createNotification({
        user_id: job.poster_id,
        type: 'new_application',
        title: 'আপনার জবে নতুন আবেদন জমা পড়েছে',
        body: `"${job.title}" জবে ${applicantProfile.full_name || 'একজন পেশাজীবী'} প্রস্তাব পাঠিয়েছেন (৳${proposed_price})।`,
        link: `/jobs/${job.id}`,
      });
    }

    return normalizeApplicationRow(savedRow);
  } catch (err: any) {
    console.error('[marketplaceService] submitJobApplication exception:', err);
    if (isJobsRlsError(err)) throw err;
    throw new Error(translateSupabaseError(err, 'আবেদন জমা দিতে সমস্যা হয়েছে।'));
  }
}

export async function withdrawJobApplication(applicationId: string): Promise<void> {
  const client = requireClient();
  try {
    const { error } = await client
      .from('job_applications')
      .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
      .eq('id', applicationId);
    if (error) {
      console.error('[marketplaceService] withdrawJobApplication error:', error);
      throw new Error(translateSupabaseError(error, 'আবেদন প্রত্যাহার করা যায়নি।'));
    }
  } catch (err: any) {
    console.error('[marketplaceService] withdrawJobApplication exception:', err);
    throw new Error(translateSupabaseError(err, 'আবেদন প্রত্যাহার করা যায়নি।'));
  }
}

export async function acceptJobApplication(job: Job, application: JobApplication): Promise<void> {
  const client = requireClient();
  try {
    // 1. Mark accepted application
    const { error: appErr } = await client
      .from('job_applications')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', application.id);

    if (appErr) {
      console.error('[marketplaceService] acceptJobApplication appErr:', appErr);
      throw new Error(translateSupabaseError(appErr, 'আবেদন গ্রহণ করা যায়নি।'));
    }

    // 2. Reject other pending applications on this job
    const { data: otherApps } = await client
      .from('job_applications')
      .select('id, applicant_id')
      .eq('job_id', job.id)
      .neq('id', application.id)
      .eq('status', 'pending');

    if (otherApps && otherApps.length > 0) {
      await client
        .from('job_applications')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('job_id', job.id)
        .neq('id', application.id)
        .eq('status', 'pending');

      for (const other of otherApps) {
        await createNotification({
          user_id: String(other.applicant_id),
          type: 'application_rejected',
          title: 'আবেদনের আপডেট',
          body: `"${job.title}" জবে অন্য একজন আবেদনকারীকে নির্বাচিত করা হয়েছে।`,
          link: `/jobs/${job.id}`,
        });
      }
    }

    // 3. Set job to in_progress & assigned_to
    const { error: jobErr } = await client
      .from('jobs')
      .update({
        status: 'in_progress',
        assigned_to: application.applicant_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    if (jobErr) {
      console.error('[marketplaceService] acceptJobApplication jobErr:', jobErr);
      throw new Error(translateSupabaseError(jobErr, 'জবের স্ট্যাটাস আপডেট করা যায়নি।'));
    }

    // 4. Notify hired worker
    await createNotification({
      user_id: application.applicant_id,
      type: 'application_accepted',
      title: 'অভিনন্দন! আপনার আবেদন গৃহীত হয়েছে',
      body: `"${job.title}" জবের জন্য আপনাকে নির্বাচিত করা হয়েছে। এখন উভয় পক্ষের যোগাযোগের নম্বর উন্মুক্ত হয়েছে।`,
      link: `/jobs/${job.id}`,
    });
  } catch (err: any) {
    console.error('[marketplaceService] acceptJobApplication exception:', err);
    throw new Error(translateSupabaseError(err, 'আবেদন গ্রহণ করতে সমস্যা হয়েছে।'));
  }
}

export async function rejectJobApplication(job: Job, application: JobApplication): Promise<void> {
  const client = requireClient();
  try {
    const { error } = await client
      .from('job_applications')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', application.id);

    if (error) {
      console.error('[marketplaceService] rejectJobApplication error:', error);
      throw new Error(translateSupabaseError(error, 'আবেদন প্রত্যাখ্যান করা যায়নি।'));
    }

    await createNotification({
      user_id: application.applicant_id,
      type: 'application_rejected',
      title: 'আবেদন প্রত্যাখ্যাত হয়েছে',
      body: `"${job.title}" জবে আপনার প্রস্তাবটি গৃহীত হয়নি।`,
      link: `/jobs/${job.id}`,
    });
  } catch (err: any) {
    console.error('[marketplaceService] rejectJobApplication exception:', err);
    throw new Error(translateSupabaseError(err, 'আবেদন প্রত্যাখ্যান করতে সমস্যা হয়েছে।'));
  }
}

export async function markJobDelivered(job: Job): Promise<Job> {
  const client = requireClient();
  try {
    const { data, error } = await client
      .from('jobs')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .select('*')
      .single();

    if (error) {
      console.error('[marketplaceService] markJobDelivered error:', error);
      throw new Error(translateSupabaseError(error, 'কাজ জমা দেওয়ার স্ট্যাটাস আপডেট করা যায়নি।'));
    }

    await createNotification({
      user_id: job.poster_id,
      type: 'job_delivered',
      title: 'কাজ জমা দেওয়া হয়েছে (Delivered)',
      body: `"${job.title}" জবের কাজ সম্পন্ন করে জমা দেওয়া হয়েছে। অনুগ্রহ করে যাচাই করে সম্পন্ন নিশ্চিত করুন।`,
      link: `/jobs/${job.id}`,
    });

    return normalizeJobRow(data);
  } catch (err: any) {
    console.error('[marketplaceService] markJobDelivered exception:', err);
    throw new Error(translateSupabaseError(err, 'কাজ জমা দিতে সমস্যা হয়েছে।'));
  }
}

export async function markJobCompleted(job: Job): Promise<Job> {
  const client = requireClient();
  try {
    const { data, error } = await client
      .from('jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .select('*')
      .single();

    if (error) {
      console.error('[marketplaceService] markJobCompleted error:', error);
      throw new Error(translateSupabaseError(error, 'জব সম্পন্ন হিসেবে চিহ্নিত করা যায়নি।'));
    }

    if (job.assigned_to) {
      await createNotification({
        user_id: job.assigned_to,
        type: 'job_completed',
        title: 'জব সফলভাবে সম্পন্ন হয়েছে!',
        body: `"${job.title}" জবটি ক্লায়েন্ট সম্পন্ন হিসেবে নিশ্চিত করেছেন। এখন আপনি রেটিং ও রিভিউ দিতে পারেন।`,
        link: `/jobs/${job.id}`,
      });
    }

    return normalizeJobRow(data);
  } catch (err: any) {
    console.error('[marketplaceService] markJobCompleted exception:', err);
    throw new Error(translateSupabaseError(err, 'জব সম্পন্ন করতে সমস্যা হয়েছে।'));
  }
}

// ============================================================================
// 5. IN-JOB MESSAGING (Between Job Owner and Each Applicant)
// ============================================================================
export async function fetchJobMessages(jobId: string, applicantId?: string): Promise<JobMessage[]> {
  if (!isSupabaseConfigured || !supabase || !jobId) return [];
  try {
    let query = supabase
      .from('job_messages')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });

    if (applicantId) {
      query = query.eq('applicant_id', applicantId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[marketplaceService] fetchJobMessages error:', error);
      return [];
    }

    const rows = data || [];
    const senderIds = rows.map((m: any) => String(m.sender_id || '')).filter(Boolean);
    const profMap = await fetchPublicProfileMap(senderIds, false);

    return rows.map((m: any) => ({
      id: String(m.id),
      job_id: String(m.job_id),
      applicant_id: String(m.applicant_id),
      sender_id: String(m.sender_id),
      receiver_id: String(m.receiver_id),
      content: String(m.content || ''),
      is_read: Boolean(m.is_read),
      created_at: m.created_at || new Date().toISOString(),
      sender: profMap.get(String(m.sender_id)) || null,
    }));
  } catch (err) {
    console.error('[marketplaceService] fetchJobMessages exception:', err);
    return [];
  }
}

export async function sendJobMessage(params: {
  job: Job;
  applicant_id: string;
  sender_id: string;
  sender_name: string;
  receiver_id: string;
  content: string;
}): Promise<JobMessage> {
  const client = requireClient();
  const { job, applicant_id, sender_id, sender_name, receiver_id, content } = params;

  try {
    const { data, error } = await client
      .from('job_messages')
      .insert([
        {
          job_id: job.id,
          applicant_id,
          sender_id,
          receiver_id,
          content: content.trim(),
          is_read: false,
        },
      ])
      .select('*')
      .single();

    if (error) {
      console.error('[marketplaceService] sendJobMessage error:', error);
      throw new Error(translateSupabaseError(error, 'মেসেজ পাঠাতে সমস্যা হয়েছে।'));
    }

    await createNotification({
      user_id: receiver_id,
      type: 'new_message',
      title: `${sender_name || 'ব্যবহারকারী'} নতুন মেসেজ পাঠিয়েছেন`,
      body: `"${job.title}": ${content.trim().slice(0, 80)}`,
      link: `/jobs/${job.id}`,
    });

    return {
      id: String(data.id),
      job_id: String(data.job_id),
      applicant_id: String(data.applicant_id),
      sender_id: String(data.sender_id),
      receiver_id: String(data.receiver_id),
      content: String(data.content || ''),
      is_read: Boolean(data.is_read),
      created_at: data.created_at || new Date().toISOString(),
    };
  } catch (err: any) {
    console.error('[marketplaceService] sendJobMessage exception:', err);
    throw new Error(translateSupabaseError(err, 'মেসেজ পাঠাতে সমস্যা হয়েছে।'));
  }
}

// ============================================================================
// 6. REVIEWS & STAR RATINGS (1–5 Stars)
// ============================================================================
export async function fetchReviewsForProfile(profileId: string): Promise<Review[]> {
  if (!isSupabaseConfigured || !supabase || !profileId) return [];
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('reviewee_id', profileId)
      .order('created_at', { ascending: false });

    if (error) {
      logReadError('fetchReviewsForProfile error', error);
      return [];
    }

    const rows = data || [];
    const reviewerIds = rows.map((r: any) => String(r.reviewer_id || '')).filter(Boolean);
    const profMap = await fetchPublicProfileMap(reviewerIds, false);

    return rows.map((r: any) => ({
      id: String(r.id),
      job_id: String(r.job_id),
      reviewer_id: String(r.reviewer_id),
      reviewee_id: String(r.reviewee_id),
      rating: Number(r.rating || 5),
      comment: r.comment ?? null,
      created_at: r.created_at || new Date().toISOString(),
      reviewer: profMap.get(String(r.reviewer_id)) || null,
    }));
  } catch (err) {
    console.error('[marketplaceService] fetchReviewsForProfile exception:', err);
    return [];
  }
}

export async function fetchReviewsForJob(jobId: string): Promise<Review[]> {
  if (!isSupabaseConfigured || !supabase || !jobId) return [];
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[marketplaceService] fetchReviewsForJob error:', error);
      return [];
    }

    const rows = data || [];
    const reviewerIds = rows.map((r: any) => String(r.reviewer_id || '')).filter(Boolean);
    const profMap = await fetchPublicProfileMap(reviewerIds, false);

    return rows.map((r: any) => ({
      id: String(r.id),
      job_id: String(r.job_id),
      reviewer_id: String(r.reviewer_id),
      reviewee_id: String(r.reviewee_id),
      rating: Number(r.rating || 5),
      comment: r.comment ?? null,
      created_at: r.created_at || new Date().toISOString(),
      reviewer: profMap.get(String(r.reviewer_id)) || null,
    }));
  } catch (err) {
    console.error('[marketplaceService] fetchReviewsForJob exception:', err);
    return [];
  }
}

export async function submitJobReview(params: {
  job: Job;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string;
}): Promise<Review> {
  const client = requireClient();
  const { job, reviewer_id, reviewee_id, rating, comment } = params;

  if (rating < 1 || rating > 5) {
    throw new Error('অনুগ্রহ করে ১ থেকে ৫ স্টারের মধ্যে রেটিং প্রদান করুন।');
  }

  try {
    const { data, error } = await client
      .from('reviews')
      .insert([
        {
          job_id: job.id,
          reviewer_id,
          reviewee_id,
          rating,
          comment: comment.trim() || null,
        },
      ])
      .select('*')
      .single();

    if (error) {
      console.error('[marketplaceService] submitJobReview error:', error);
      if (String(error.code) === '23505') {
        throw new Error('আপনি ইতিমধ্যে এই জবের জন্য রিভিউ প্রদান করেছেন।');
      }
      throw new Error(translateSupabaseError(error, 'রিভিউ জমা দিতে সমস্যা হয়েছে।'));
    }

    return {
      id: String(data.id),
      job_id: String(data.job_id),
      reviewer_id: String(data.reviewer_id),
      reviewee_id: String(data.reviewee_id),
      rating: Number(data.rating || 5),
      comment: data.comment ?? null,
      created_at: data.created_at || new Date().toISOString(),
    };
  } catch (err: any) {
    console.error('[marketplaceService] submitJobReview exception:', err);
    throw new Error(translateSupabaseError(err, 'রিভিউ জমা দিতে সমস্যা হয়েছে।'));
  }
}

// ============================================================================
// 7. HOME BANNERS CAROUSEL
// ============================================================================
function normalizeBannerRow(raw: any): Banner {
  return {
    id: String(raw.id),
    title: String(raw.title || ''),
    subtitle: raw.subtitle ?? null,
    image_url: String(raw.image_url || ''),
    mobile_image_url: raw.mobile_image_url ?? null,
    link_url: raw.link_url ?? null,
    button_text: raw.button_text ?? null,
    sort_order: Number(raw.sort_order ?? 0),
    is_active: raw.is_active !== false,
    start_date: raw.start_date ?? null,
    end_date: raw.end_date ?? null,
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: raw.updated_at || raw.created_at || new Date().toISOString(),
  };
}

export async function fetchActiveBanners(): Promise<Banner[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      logReadError('fetchActiveBanners error', error);
      return [];
    }

    const now = Date.now();
    return (data || [])
      .map(normalizeBannerRow)
      .filter((b) => {
        if (!b.image_url) return false;
        if (b.start_date && new Date(b.start_date).getTime() > now) return false;
        if (b.end_date && new Date(b.end_date).getTime() < now) return false;
        return true;
      });
  } catch (err) {
    console.error('[marketplaceService] fetchActiveBanners exception:', err);
    return [];
  }
}

export async function adminFetchAllBanners(): Promise<Banner[]> {
  const client = requireClient();
  try {
    const { data, error } = await client
      .from('banners')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[marketplaceService] adminFetchAllBanners error:', error);
      throw new Error(translateSupabaseError(error, 'ব্যানার তালিকা লোড করা যায়নি।'));
    }
    return (data || []).map(normalizeBannerRow);
  } catch (err: any) {
    console.error('[marketplaceService] adminFetchAllBanners exception:', err);
    throw new Error(translateSupabaseError(err, 'ব্যানার তালিকা লোড করা যায়নি।'));
  }
}

export async function adminSaveBanner(banner: Partial<Banner> & { image_url: string }): Promise<Banner> {
  const client = requireClient();
  try {
    const payload: Record<string, any> = {
      title: (banner.title ?? '').trim(),
      subtitle: banner.subtitle ? banner.subtitle.trim() : null,
      image_url: banner.image_url,
      mobile_image_url: banner.mobile_image_url || null,
      link_url: banner.link_url ? banner.link_url.trim() : null,
      button_text: banner.button_text ? banner.button_text.trim() : null,
      sort_order: Number(banner.sort_order ?? 0),
      is_active: banner.is_active !== false,
      start_date: banner.start_date || null,
      end_date: banner.end_date || null,
      updated_at: new Date().toISOString(),
    };

    if (banner.id) {
      const { data, error } = await client
        .from('banners')
        .update(payload)
        .eq('id', banner.id)
        .select('*')
        .single();
      if (error) throw error;
      return normalizeBannerRow(data);
    }

    const { data, error } = await client.from('banners').insert([payload]).select('*').single();
    if (error) throw error;
    return normalizeBannerRow(data);
  } catch (err: any) {
    console.error('[marketplaceService] adminSaveBanner error:', err);
    throw new Error(translateSupabaseError(err, 'ব্যানার সংরক্ষণ ব্যর্থ হয়েছে।'));
  }
}

export async function adminDeleteBanner(id: string): Promise<void> {
  const client = requireClient();
  try {
    const { error } = await client.from('banners').delete().eq('id', id);
    if (error) throw error;
  } catch (err: any) {
    console.error('[marketplaceService] adminDeleteBanner error:', err);
    throw new Error(translateSupabaseError(err, 'ব্যানার মুছে ফেলতে সমস্যা হয়েছে।'));
  }
}

// ============================================================================
// 8. ADMIN PANEL MANAGEMENT (Jobs, Applications, Users)
// ============================================================================
export async function adminFetchAllJobs(): Promise<Job[]> {
  const client = requireClient();
  await ensureLookupsLoaded();
  try {
    const { data, error } = await client
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[marketplaceService] adminFetchAllJobs error:', error);
      if (isJobsRlsError(error)) throw error;
      throw new Error(translateSupabaseError(error, 'জব তালিকা লোড করা যায়নি।'));
    }

    const rows = data || [];
    const userIds = Array.from(
      new Set(
        rows
          .flatMap((r: any) => [String(r.poster_id || ''), r.assigned_to ? String(r.assigned_to) : ''])
          .filter(Boolean)
      )
    );
    const profMap = await fetchPublicProfileMap(userIds, true);
    return rows.map((r: any) => normalizeJobRow(r, profMap));
  } catch (err: any) {
    console.error('[marketplaceService] adminFetchAllJobs exception:', err);
    if (isJobsRlsError(err)) throw err;
    throw new Error(translateSupabaseError(err, 'জব তালিকা লোড করা যায়নি।'));
  }
}

export async function adminReviewJob(params: {
  job: Job;
  action: 'approve' | 'reject' | 'close';
  admin_note?: string;
}): Promise<Job> {
  const client = requireClient();
  const { job, action, admin_note } = params;
  const nextStatus: JobStatus =
    action === 'approve' ? 'open' : action === 'reject' ? 'rejected' : 'closed';

  try {
    const { data, error } = await client
      .from('jobs')
      .update({
        status: nextStatus,
        admin_note: admin_note ? admin_note.trim() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .select('*')
      .single();

    if (error) throw error;

    if (action === 'approve' || action === 'reject') {
      await createNotification({
        user_id: job.poster_id,
        type: action === 'approve' ? 'job_approved' : 'job_rejected',
        title:
          action === 'approve'
            ? 'আপনার পোস্ট করা জব অনুমোদিত হয়েছে!'
            : 'আপনার জব পোস্টটি প্রত্যাখ্যাত হয়েছে',
        body:
          action === 'approve'
            ? `"${job.title}" জবটি এখন পাবলিক মার্কেটপ্লেসে প্রকাশিত হয়েছে।`
            : `"${job.title}" জবটি অনুমোদিত হয়নি। ${admin_note ? `নোট: ${admin_note}` : ''}`,
        link: `/jobs/${job.id}`,
      });
    }

    return normalizeJobRow(data);
  } catch (err: any) {
    console.error('[marketplaceService] adminReviewJob error:', err);
    throw new Error(translateSupabaseError(err, 'জব স্ট্যাটাস আপডেট করা যায়নি।'));
  }
}

export async function adminDeleteJob(jobId: string): Promise<void> {
  const client = requireClient();
  try {
    const { error } = await client.from('jobs').delete().eq('id', jobId);
    if (error) throw error;
  } catch (err: any) {
    console.error('[marketplaceService] adminDeleteJob error:', err);
    throw new Error(translateSupabaseError(err, 'জব মুছে ফেলতে সমস্যা হয়েছে।'));
  }
}

export async function adminFetchAllApplications(): Promise<JobApplication[]> {
  const client = requireClient();
  try {
    const { data, error } = await client
      .from('job_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    const rows = data || [];

    const applicantIds = rows.map((r: any) => String(r.applicant_id || '')).filter(Boolean);
    const jobIds = Array.from(new Set(rows.map((r: any) => String(r.job_id || '')).filter(Boolean)));

    const [profMap, jobsRes] = await Promise.all([
      fetchPublicProfileMap(applicantIds, true),
      jobIds.length > 0 ? client.from('jobs').select('*').in('id', jobIds) : Promise.resolve({ data: [] }),
    ]);

    const jobMap = new Map<string, Job>();
    const jobRows = (jobsRes as any)?.data || [];
    const assigneeIds = jobRows.map((j: any) => (j.assigned_to ? String(j.assigned_to) : '')).filter(Boolean);
    const assigneeMap = await fetchPublicProfileMap(assigneeIds, true);

    jobRows.forEach((j: any) => {
      const norm = normalizeJobRow(j, assigneeMap);
      jobMap.set(norm.id, norm);
    });

    return rows.map((r: any) => normalizeApplicationRow(r, profMap, jobMap));
  } catch (err: any) {
    console.error('[marketplaceService] adminFetchAllApplications error:', err);
    throw new Error(translateSupabaseError(err, 'আবেদন তালিকা লোড করা যায়নি।'));
  }
}

export async function adminApproveApplicationInDb(app: JobApplication): Promise<void> {
  const client = requireClient();
  try {
    const { error } = await client
      .from('job_applications')
      .update({ is_admin_approved: true, updated_at: new Date().toISOString() })
      .eq('id', app.id);
    if (error) throw error;

    if (app.job?.poster_id) {
      await createNotification({
        user_id: app.job.poster_id,
        type: 'new_application',
        title: 'আপনার জবে নতুন আবেদন অনুমোদিত হয়েছে',
        body: `"${app.job.title}" জবে নতুন একটি প্রস্তাব যুক্ত হয়েছে।`,
        link: `/jobs/${app.job_id}`,
      });
    }
  } catch (err: any) {
    console.error('[marketplaceService] adminApproveApplicationInDb error:', err);
    throw new Error(translateSupabaseError(err, 'আবেদন অনুমোদন করা যায়নি।'));
  }
}

export async function adminDeleteApplication(applicationId: string): Promise<void> {
  const client = requireClient();
  try {
    const { error } = await client.from('job_applications').delete().eq('id', applicationId);
    if (error) throw error;
  } catch (err: any) {
    console.error('[marketplaceService] adminDeleteApplication error:', err);
    throw new Error(translateSupabaseError(err, 'আবেদন মুছে ফেলা যায়নি।'));
  }
}

export async function adminUpdateUserRole(profileId: string, role: UserRole): Promise<Profile> {
  const client = requireClient();
  try {
    const { data, error } = await client
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', profileId)
      .select('*')
      .single();
    if (error) throw error;
    return normalizeProfileRow(data);
  } catch (err: any) {
    console.error('[marketplaceService] adminUpdateUserRole error:', err);
    throw new Error(translateSupabaseError(err, 'ইউজার রোল পরিবর্তন করা যায়নি।'));
  }
}

export async function adminUpdateUserSuspension(profileId: string, suspend: boolean): Promise<Profile> {
  const client = requireClient();
  try {
    const { data, error } = await client
      .from('profiles')
      .update({
        is_suspended: suspend,
        status: suspend ? 'suspended' : 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId)
      .select('*')
      .single();
    if (error) throw error;
    return normalizeProfileRow(data);
  } catch (err: any) {
    console.error('[marketplaceService] adminUpdateUserSuspension error:', err);
    throw new Error(translateSupabaseError(err, 'ইউজার সাসপেনশন আপডেট করা যায়নি।'));
  }
}

export async function adminToggleUserVerified(profileId: string, verify: boolean): Promise<Profile> {
  const client = requireClient();
  try {
    const { data, error } = await client
      .from('profiles')
      .update({
        is_verified: verify,
        verification_status: verify ? 'verified' : 'unverified',
        ...(verify ? { status: 'approved', verification_rejection_reason: null } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId)
      .select('*')
      .single();
    if (error) throw error;

    await createNotification({
      user_id: profileId,
      type: verify ? 'verification_approved' : 'verification_rejected',
      title: verify ? 'আপনার প্রোফাইল ভেরিফাইড করা হয়েছে!' : 'প্রোফাইল ভেরিফিকেশন স্ট্যাটাস পরিবর্তিত হয়েছে',
      body: verify
        ? 'অ্যাডমিন আপনার প্রোফাইল ভেরিফাইড করেছেন। আপনার প্রোফাইল এখন পাবলিক ডিরেক্টরিতে দৃশ্যমান।'
        : 'অ্যাডমিন আপনার প্রোফাইলের ভেরিফাইড স্ট্যাটাস আনভেরিফাইড করেছেন।',
      link: '/verify',
    });

    return normalizeProfileRow(data);
  } catch (err: any) {
    console.error('[marketplaceService] adminToggleUserVerified error:', err);
    throw new Error(translateSupabaseError(err, 'ভেরিফিকেশন স্ট্যাটাস পরিবর্তন করা যায়নি।'));
  }
}

