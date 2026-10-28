import type { User } from '@supabase/supabase-js';
import type { Profile } from '../types/database';
import {
  supabase,
  isSupabaseConfigured,
  adminUpdateProfileFull,
  translateSupabaseError,
} from './supabase';

/**
 * Creates or updates the currently logged-in user's professional profile in `public.profiles`.
 * - Works seamlessly even if the user logged in without an existing `profiles` row.
 * - Publishes (`status: 'approved'`) when complete profile & location details are saved,
 *   unless an Admin has explicitly suspended or rejected the profile.
 * - Preserves `role` and `is_verified` (controlled exclusively by Admin).
 */
export async function saveUserOwnProfile(
  authUser: User,
  data: Record<string, any>,
  existingProfileId?: string | null
): Promise<Profile> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('ডাটাবেস সংযোগ কনফিগার করা হয়নি।');
  }

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
    if (!existing && authEmail) {
      const { data: byEmail } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', authEmail)
        .limit(1);
      if (byEmail && byEmail.length > 0) existing = byEmail[0];
    }

    const targetId = existing?.id ? String(existing.id) : authUser.id;
    const isRestrictedByAdmin =
      existing?.status === 'suspended' || existing?.status === 'rejected';

    const payloadForUpsert: Record<string, any> = {
      ...data,
      auth_user_id: authUser.id,
      email:
        data.email !== undefined && String(data.email).trim() !== ''
          ? String(data.email).trim().toLowerCase()
          : existing?.email || authEmail || null,
      role: existing?.role === 'admin' ? 'admin' : 'user',
      status: isRestrictedByAdmin ? existing.status : 'approved',
      is_verified: Boolean(existing?.is_verified),
    };

    return await adminUpdateProfileFull(targetId, payloadForUpsert);
  } catch (err: any) {
    console.error('[profileService] saveUserOwnProfile error:', err);
    throw new Error(translateSupabaseError(err, 'প্রোফাইল সংরক্ষণ ব্যর্থ হয়েছে।'));
  }
}
