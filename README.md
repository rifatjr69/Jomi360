# জমি৩৬০ (Jomi360) – পেশাজীবী ডিরেক্টরি ওয়েবসাইট

জমি৩৬০ হলো একটি সম্পূর্ণ, প্রোডাকশন-রেডি, বাংলা ভাষার পেশাজীবী ডিরেক্টরি প্ল্যাটফর্ম। এর মাধ্যমে বাংলাদেশের যেকোনো এলাকার মানুষ সহজেই নিবন্ধিত ও দক্ষ সার্ভেয়ার, দলিল লেখক, এডভোকেট, সিভিল কোর্ট কমিশনার ও ব্যারিস্টার খুঁজে পাবেন।

## 🚀 প্রধান বৈশিষ্ট্যসমূহ
1. **১০০% বাংলা UI (Bengali Text):** সাইটের সকল কন্ট্রোল, ডায়ালগ, এরর মেসেজ ও নোটিফিকেশন বাংলায়।
2. **ডাইনামিক ঠিকানা নির্বাচন পপআপ (AddressPicker):** ৩ ধাপের স্টেপার (বিভাগ › জেলা › উপজেলা) ও লাইভ অনুসন্ধান সুবিধা সহ।
3. **প্রফেশনাল রেজিস্ট্রেশন ও NID আপলোড:** NID তথ্য ও ফাইল আপলোড সহ নিরাপদ রেজিস্ট্রেশন, যা অ্যাডমিন কর্তৃক অ্যাপ্রুভ হওয়ার পরই প্রকাশিত হয়।
4. **অ্যাডমিন প্যানেল (Admin Dashboard):** ইউজার ওভারভিউ, NID নথি যাচাই, ভেরিফাইড ব্যাজ প্রদান, লোকেশন ও পেশা কন্ট্রোল, পোস্ট মডারেশন এবং সাইট সেটিংস লাইভ সম্পাদনা।
5. **পাবলিক প্রোফাইল ও শেয়ারিং:** কিউরেটেড পেশাগত তথ্য (সার্ভেয়ারের ব্যবহৃত প্রযুক্তি, যন্ত্রপাতি, এডভোকেটের বার নম্বর ইত্যাদি) ও সরাসরি কল/হোয়াটসঅ্যাপ লিঙ্ক।

---

## 🛠️ টেক স্ট্যাক
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4 + React Router v7
- **Backend/Storage:** Supabase (Auth, Postgres, Storage)
- **Icons & Animation:** Lucide React, Framer Motion
- **Font:** Hind Siliguri (Google Font)

---

## 📁 Supabase Database Setup & Environment Variables

আপনার `.env` ফাইলে নিচের কি-গুলো যুক্ত করুন:

```env
VITE_SUPABASE_URL="https://your-supabase-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
```

### প্রয়োজনীয় টেবিল ও ভিউ স্ট্রাকচার:
1. `divisions(id, name_bn, name_en, is_active)`
2. `districts(id, division_id, name_bn, is_active)`
3. `upazilas(id, district_id, name_bn, is_active)`
4. `professions(id, name_bn, slug, sort_order, is_active)`
5. `profiles(id, auth_user_id, user_serial, full_name, email, phone, profession_id, division_id, district_id, upazila_id, address_detail, nid_number, nid_photo_url, profile_photo_url, cover_photo_url, bio, extra_info, role, status, is_verified, created_at)`
6. `posts(id, profile_id, content, image_url, is_hidden, created_at)`
7. `site_settings(key, value)`
8. **View (`public_profiles`):** Approved প্রোফাইলসমূহ, জয়নকৃত profession_name, division_name, district_name, upazila_name সহ (NID সংবেদনশীল তথ্য বাদ দিয়ে)।

### স্টোরেজ বাকেট:
- `avatars` (public)
- `post-images` (public)
- `nid-docs` (private - অ্যাডমিন ৬০ সেকেন্ডের সাইনড URL দেখতে পারবেন)

---

## ⚙️ লোকাল ডেভেলপমেন্ট রান করার ধাপ

১. ডিপেন্ডেন্সি ইনস্টল করুন:
```bash
npm install
```

২. ডেভেলপমেন্ট সার্ভার চালু করুন:
```bash
npm run dev
```

৩. প্রডাকশন বিল্ড তৈরি করুন:
```bash
npm run build
```

---

## 🔑 টেস্ট অ্যাডমিন কুইক লগইন
- **ইমেইল:** `admin@jomi360.com`
- **পাসওয়ার্ড:** যেকোনো ৮+ অক্ষরের পাসওয়ার্ড
- **লগইন URL:** `/login` (লগইনের পর সরাসরী `/admin` রিডাইরেক্ট হবে)
