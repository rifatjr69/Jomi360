export type UserRole = 'user' | 'admin';
export type ProfileStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

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
  technologies?: string[]; // AutoCAD, Laptop/Desktop, CAD/PDF Map Processing, Patograph
  equipment?: string[]; // Total Station, GPS RTK, etc.
}

export interface ExtraInfoAdvocate {
  bar_council_no?: string;
  court?: string; // Judge Court, High Court, etc.
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
  created_at: string;
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
  created_at: string;
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
  site_name: string;
  site_name_en: string;
  hero_title: string;
  video_url: string;
  footer_about: string;
  owner_name: string;
  owner_designation: string;
  contact_email: string;
  contact_phone: string;
  contact_address: string;
}

export type SiteSettingKey = keyof SiteSettings;
