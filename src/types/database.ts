export type UserRole = 'user' | 'admin';
export type ProfileStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface Division {
  id: string;
  name_bn: string;
  name_en: string;
  is_active: boolean;
}

export interface District {
  id: string;
  division_id: string;
  name_bn: string;
  is_active: boolean;
}

export interface Upazila {
  id: string;
  district_id: string;
  name_bn: string;
  is_active: boolean;
}

export interface Profession {
  id: string;
  name_bn: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
}

export interface ExtraInfoSurveyor {
  cert_year?: string;
  cert_issuer?: string;
  surveyor_type?: 'analog' | 'digital' | 'both';
  technologies?: string[];
  equipment?: string[];
}

export interface ExtraInfoAdvocate {
  bar_council_no?: string;
  court?: string;
  experience_years?: string;
}

export interface ExtraInfoDeedWriter {
  license_no?: string;
  sub_registry_office?: string;
  experience_years?: string;
}

export interface ExtraInfoGeneric {
  services?: string;
  specialization?: string;
  experience_years?: string;
  qualification?: string;
  [key: string]: any;
}

export type ProfileExtraInfo = ExtraInfoSurveyor & ExtraInfoAdvocate & ExtraInfoDeedWriter & ExtraInfoGeneric;

export interface Profile {
  id: string;
  auth_user_id: string | null;
  user_serial: number;
  full_name: string;
  email: string | null;
  phone: string;
  profession_id: string;
  division_id: string;
  district_id: string;
  upazila_id: string;
  address_detail: string | null;
  nid_number?: string | null;
  nid_photo_url?: string | null;
  profile_photo_url: string | null;
  cover_photo_url: string | null;
  bio: string | null;
  extra_info: ProfileExtraInfo;
  role: UserRole;
  status: ProfileStatus;
  is_verified: boolean;
  verification_status: VerificationStatus;
  verification_rejection_reason: string | null;
  is_suspended: boolean;
  avg_rating: number;
  review_count: number;
  completed_jobs_count: number;
  created_at: string;
  updated_at?: string;
}

export interface PublicProfile {
  id: string;
  auth_user_id: string | null;
  user_serial: number;
  full_name: string;
  email: string | null;
  phone: string;
  profession_id: string;
  profession_name: string;
  division_id: string;
  division_name: string;
  district_id: string;
  district_name: string;
  upazila_id: string;
  upazila_name: string;
  address_detail: string | null;
  profile_photo_url: string | null;
  cover_photo_url: string | null;
  bio: string | null;
  extra_info: ProfileExtraInfo;
  role: UserRole;
  status: ProfileStatus;
  is_verified: boolean;
  verification_status: VerificationStatus;
  is_suspended: boolean;
  avg_rating: number;
  review_count: number;
  completed_jobs_count: number;
  created_at: string;
}

export interface VerificationRequest {
  id: string;
  user_id: string;
  profile_id: string;
  full_name: string;
  phone: string;
  profession_id: string | null;
  category_name: string;
  division_id: string | null;
  district_id: string | null;
  upazila_id: string | null;
  division_name?: string;
  district_name?: string;
  upazila_name?: string;
  short_bio: string;
  nid_number: string;
  id_front_path: string;
  id_back_path: string;
  selfie_path: string;
  status: VerificationStatus;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  profile?: Profile | null;
}

export type JobStatus =
  | 'pending_approval'
  | 'open'
  | 'in_progress'
  | 'delivered'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'closed';

export type BudgetType = 'fixed' | 'negotiable';
export type WorkMode = 'onsite' | 'remote';

export interface Job {
  id: string;
  poster_id: string;
  assigned_to: string | null;
  title: string;
  description: string;
  category: string;
  profession_id: string | null;
  budget_type: BudgetType;
  budget_min: number | null;
  budget_max: number | null;
  deadline: string | null;
  division_id: string | null;
  district_id: string | null;
  upazila_id: string | null;
  division_name: string;
  district_name: string;
  upazila_name: string;
  work_mode: WorkMode;
  attachments: string[];
  status: JobStatus;
  admin_note: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  applications_count?: number;
  created_at: string;
  updated_at: string;
  poster?: PublicProfile | null;
  assignee?: PublicProfile | null;
}

export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export interface JobApplication {
  id: string;
  job_id: string;
  applicant_id: string;
  cover_letter: string;
  proposed_price: number;
  estimated_days: number;
  status: ApplicationStatus;
  is_admin_approved: boolean;
  created_at: string;
  updated_at: string;
  applicant?: PublicProfile | null;
  job?: Job | null;
}

export interface JobMessage {
  id: string;
  job_id: string;
  applicant_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender?: PublicProfile | null;
}

export interface Review {
  id: string;
  job_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer?: PublicProfile | null;
  job_title?: string;
}

export type NotificationType =
  | 'verification_approved'
  | 'verification_rejected'
  | 'job_approved'
  | 'job_rejected'
  | 'new_application'
  | 'application_accepted'
  | 'application_rejected'
  | 'job_delivered'
  | 'job_completed'
  | 'new_message'
  | 'system';

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  mobile_image_url: string | null;
  link_url: string | null;
  button_text: string | null;
  sort_order: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  profile_id: string;
  content: string;
  image_url: string | null;
  is_hidden: boolean;
  created_at: string;
  profile?: PublicProfile;
}

export interface SiteSettings {
  id?: number;
  site_name: string;
  site_name_en: string;
  tagline: string;
  hero_title: string;
  hero_subtitle: string;
  logo_url: string;
  favicon_url: string;
  primary_color: string;
  accent_color: string;
  default_theme: 'light' | 'dark';
  video_url: string;
  footer_about: string;
  support_whatsapp: string;
  owner_name: string;
  owner_designation: string;
  contact_email: string;
  contact_phone: string;
  contact_address: string;
  require_job_approval: boolean;
  require_application_approval: boolean;
  require_verified_to_post_job: boolean;
  require_verified_to_apply_job: boolean;
}

export type SiteSettingKey = keyof SiteSettings;
