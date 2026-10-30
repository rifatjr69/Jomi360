import type { User } from '@supabase/supabase-js';
import type { Profile } from '../types/database';
import {
  supabase,
  isSupabaseConfigured,
  ensureLookupsLoaded,
  resolveLocationNames,
  resolveProfessionName,
  toDbForeignKey,
  toEnglishDigits,
  normalizeProfileRow,
  translateSupabaseError,
} from './supabase';

/**
 * Creates or updates the currently logged-in user's own profile in `public.profiles`.
 * - Never modifies `role`, `verification_status`, `is_verified`, or `is_suspended` (strictly Admin-controlled + DB trigger enforced).
 * - Sensitive NID / ID documents are stored exclusively in `verification_requests` + private `verification-docs` bucket via `/verify`.
 */
export async function saveUserOwnProfile(
  authUser: User,
  data: Record<string, any>,
  existingProfileId?: string | null
): Promise<Profile> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('ডাটাবেস সংযোগ কনফিগার করা হয়নি।');
  }

  await ensureLookupsLoaded();

  try {
    let existing: any = null;

    if (existingProfileId) {
      const { data: byId } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', existingProfileId)
        .maybeSingle();
      if (byId) existing = byId;
    }

    if (!existing) {
      const { data: byAuth } = await supabase
        .from('profiles')
        .select('*')
        .or(`id.eq.${authUser.id},auth_user_id.eq.${authUser.id}`)
        .limit(1);
      if (byAuth && byAuth.length > 0) existing = byAuth[0];
    }

    const authEmail = authUser.email ? authUser.email.trim().toLowerCase() : null;
    const targetId = existing?.id ? String(existing.id) : authUser.id;

    const locNames = resolveLocationNames(
      data.division_id ?? existing?.division_id,
      data.district_id ?? existing?.district_id,
      data.upazila_id ?? existing?.upazila_id,
      data.extra_info ?? existing?.extra_info
    );
    const profName = resolveProfessionName(
      data.profession_id ?? existing?.profession_id,
      data.extra_info ?? existing?.extra_info
    );

    const mergedExtra: Record<string, any> = {
      ...(existing?.extra_info && typeof existing.extra_info === 'object' ? existing.extra_info : {}),
      ...(data.extra_info && typeof data.extra_info === 'object' ? data.extra_info : {}),
      ...(locNames.division_name ? { _division_name: locNames.division_name } : {}),
      ...(locNames.district_name ? { _district_name: locNames.district_name } : {}),
      ...(locNames.upazila_name ? { _upazila_name: locNames.upazila_name } : {}),
      ...(profName ? { _profession_name: profName } : {}),
    };

    const allowedPayload: Record<string, any> = {
      auth_user_id: authUser.id,
      email:
        data.email !== undefined && String(data.email).trim() !== ''
          ? String(data.email).trim().toLowerCase()
          : existing?.email || authEmail || null,
      full_name: String(data.full_name ?? existing?.full_name ?? '').trim(),
      phone: toEnglishDigits(data.phone ?? existing?.phone ?? '').trim(),
      profession_id:
        data.profession_id !== undefined
          ? toDbForeignKey(data.profession_id, 'profession')
          : existing?.profession_id ?? null,
      division_id:
        data.division_id !== undefined
          ? toDbForeignKey(data.division_id, 'division')
          : existing?.division_id ?? null,
      district_id:
        data.district_id !== undefined
          ? toDbForeignKey(data.district_id, 'district')
          : existing?.district_id ?? null,
      upazila_id:
        data.upazila_id !== undefined
          ? toDbForeignKey(data.upazila_id, 'upazila')
          : existing?.upazila_id ?? null,
      address_detail:
        data.address_detail !== undefined
          ? data.address_detail
            ? String(data.address_detail).trim()
            : null
          : existing?.address_detail ?? null,
      profile_photo_url:
        data.profile_photo_url !== undefined
          ? data.profile_photo_url || null
          : existing?.profile_photo_url ?? null,
      cover_photo_url:
        data.cover_photo_url !== undefined
          ? data.cover_photo_url || null
          : existing?.cover_photo_url ?? null,
      bio:
        data.bio !== undefined
          ? data.bio
            ? String(data.bio).trim()
            : null
          : existing?.bio ?? null,
      extra_info: mergedExtra,
    };

    if (allowedPayload.upazila_id === null && existing?.upazila_id) {
      allowedPayload.upazila_id = existing.upazila_id;
    }

    if (existing) {
      const { data: updated, error } = await supabase
        .from('profiles')
        .update(allowedPayload)
        .eq('id', targetId)
        .select('*')
        .single();

      if (error) {
        console.error('[profileService] saveUserOwnProfile update error:', error);
        throw new Error(translateSupabaseError(error, 'প্রোফাইল সংরক্ষণ ব্যর্থ হয়েছে।'));
      }
      return normalizeProfileRow(updated);
    }

    const { data: inserted, error: insertError } = await supabase
      .from('profiles')
      .insert([{ id: targetId, ...allowedPayload }])
      .select('*')
      .single();

    if (insertError) {
      console.error('[profileService] saveUserOwnProfile insert error:', insertError);
      throw new Error(translateSupabaseError(insertError, 'প্রোফাইল তৈরি করতে সমস্যা হয়েছে।'));
    }
    return normalizeProfileRow(inserted);
  } catch (err: any) {
    console.error('[profileService] saveUserOwnProfile error:', err);
    throw new Error(translateSupabaseError(err, 'প্রোফাইল সংরক্ষণ ব্যর্থ হয়েছে।'));
  }
}
