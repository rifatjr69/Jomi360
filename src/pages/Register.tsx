import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Eye, EyeOff, ArrowLeft, CheckCircle2, Compass, UserPlus } from 'lucide-react';
import { signUpSimpleUser, getSupabaseConfigError } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { refreshProfile } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState(getSupabaseConfigError() || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!fullName.trim()) {
      setErrorMsg('অনুগ্রহ করে আপনার পূর্ণ নাম লিখুন।');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('অনুগ্রহ করে একটি সঠিক ই-মেইল ঠিকানা প্রদান করুন।');
      return;
    }
    if (!password || password.length < 8) {
      setErrorMsg('পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('দুইটি পাসওয়ার্ড মিলেনি। অনুগ্রহ করে যাচাই করুন।');
      return;
    }

    setLoading(true);
    try {
      const result = await signUpSimpleUser({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
      });

      setNeedsEmailConfirm(result.requiresEmailConfirmation);
      if (!result.requiresEmailConfirmation) {
        await refreshProfile();
        showToast('রেজিস্ট্রেশন সফল হয়েছে! স্বাগতম।', 'success');
        navigate('/account', { replace: true });
        return;
      }

      setSuccessMsg(true);
      showToast('অ্যাকাউন্ট তৈরি হয়েছে! ই-মেইল কনফার্ম করুন।', 'success');
    } catch (err: any) {
      console.error('[Register] signUpSimpleUser error:', err);
      setErrorMsg(err.message || 'রেজিস্ট্রেশন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  if (successMsg) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-5">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-[#0F2942] dark:text-white font-siliguri">
            রেজিস্ট্রেশন সম্পন্ন হয়েছে!
          </h2>
          {needsEmailConfirm ? (
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              আপনার ই-মেইলে (<span className="font-bold">{email}</span>) একটি কনফার্মেশন লিংক পাঠানো হয়েছে। লগইন করার পূর্বে ইনবক্স বা স্প্যাম ফোল্ডার চেক করে লিংকটিতে ক্লিক করুন।
            </p>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              লগইন করার পর আপনি জব ব্রাউজ করতে পারবেন এবং প্রয়োজনে প্রোফাইল ভেরিফাই করতে পারবেন।
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/login"
              className="px-6 py-3 bg-brand text-white font-bold text-xs rounded-xl shadow-sm"
            >
              লগইন পেজে যান
            </Link>
            <Link
              to="/"
              className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl"
            >
              হোম পেজে যান
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-brand text-white flex items-center justify-center shadow-md">
            <Compass className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-[#0F2942] dark:text-white font-siliguri">
            নতুন একাউন্ট খুলুন
          </h1>
          <p className="text-xs text-slate-500">
            কোনো এনআইডি বা বাড়তি ডকুমেন্ট ছাড়াই সহজেই একাউন্ট খুলুন। পরবর্তীতে যেকোনো সময় প্রোফাইল ভেরিফাই করতে পারবেন।
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-xl text-xs font-semibold leading-relaxed">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#0F2942] dark:text-slate-300 mb-1">
              পূর্ণ নাম *
            </label>
            <div className="relative">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="যেমন: মোঃ ইমদাদুল হোসেন"
                required
                className="w-full pl-10 pr-4 py-3 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] text-[#0F2942] dark:text-slate-100"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F2942] dark:text-slate-300 mb-1">
              ই-মেইল ঠিকানা *
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@domain.com"
                required
                className="w-full pl-10 pr-4 py-3 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] text-[#0F2942] dark:text-slate-100"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F2942] dark:text-slate-300 mb-1">
              পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর) *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                className="w-full pl-10 pr-10 py-3 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] text-[#0F2942] dark:text-slate-100"
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
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F2942] dark:text-slate-300 mb-1">
              পাসওয়ার্ড নিশ্চিত করুন *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                className="w-full pl-10 pr-4 py-3 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] text-[#0F2942] dark:text-slate-100"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-brand text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-60"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>একাউন্ট তৈরি করুন</span>
              </>
            )}
          </button>
        </form>

        <div className="pt-2 text-center text-xs text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            ইতিমধ্যে একাউন্ট আছে?{' '}
            <Link to="/login" className="font-bold text-[var(--brand-primary)] dark:text-blue-400 hover:underline">
              লগইন করুন
            </Link>
          </p>

          <Link
            to="/"
            className="inline-flex items-center gap-1 text-slate-500 hover:text-[#0F2942] dark:hover:text-slate-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>হোম পেজে ফিরে যান</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
