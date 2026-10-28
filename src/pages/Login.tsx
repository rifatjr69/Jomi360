import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, Eye, EyeOff, ArrowLeft, LogIn, Compass } from 'lucide-react';
import { loginUser, getSupabaseConfigError } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, profile, isAdmin, refreshProfile } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>(getSupabaseConfigError() || '');

  // Auto-redirect if already logged in
  useEffect(() => {
    if (user || profile) {
      if (isAdmin || profile?.role === 'admin') {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/account', { replace: true });
      }
    }
  }, [user, profile, isAdmin, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('ই-মেইল এবং পাসওয়ার্ড প্রদান করুন।');
      return;
    }

    setLoading(true);

    try {
      const syncedProfile = await loginUser(email.trim(), password);
      const latestProfile = (await refreshProfile()) || syncedProfile;

      if (latestProfile?.role === 'admin') {
        showToast('অ্যাডমিন হিসেবে সফলভাবে লগইন হয়েছে!', 'success');
        navigate('/dashboard', { replace: true });
      } else {
        showToast('সফলভাবে লগইন হয়েছে!', 'success');
        navigate('/account', { replace: true });
      }
    } catch (err: any) {
      console.error('[Login] Error:', err);
      setErrorMessage(err.message || 'লগইন ব্যর্থ হয়েছে। তথ্য যাচাই করে আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6">
        {/* Header Icon */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#0B63E5] text-white flex items-center justify-center shadow-md shadow-blue-600/20">
            <Compass className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-[#0F2942] dark:text-white font-siliguri">
            লগইন করুন
          </h2>
          <p className="text-xs text-slate-500">আপনার একাউন্ট বা অ্যাডমিন প্যানেলে প্রবেশ করুন</p>
        </div>

        {errorMessage && (
          <div className="p-3.5 bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-xl text-xs font-semibold leading-relaxed">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Email Input */}
          <div>
            <label className="block text-xs font-bold text-[#0F2942] dark:text-slate-300 mb-1">
              ই-মেইল ঠিকানা
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@domain.com"
                required
                className="w-full pl-10 pr-4 py-3 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0B63E5] text-[#0F2942] dark:text-slate-100"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-[#0F2942] dark:text-slate-300">
                পাসওয়ার্ড
              </label>
              <Link
                to="/forgot-password"
                className="text-xs font-semibold text-[#0B63E5] dark:text-blue-400 hover:underline"
              >
                পাসওয়ার্ড ভুলে গেছেন?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-10 py-3 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0B63E5] text-[#0F2942] dark:text-slate-100"
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#0B63E5] hover:bg-[#084FC7] text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-60"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>লগইন করুন</span>
              </>
            )}
          </button>
        </form>

        {/* Links */}
        <div className="pt-2 text-center text-xs text-slate-600 dark:text-slate-400 space-y-3">
          <p>
            অ্যাকাউন্ট নেই?{' '}
            <Link to="/register" className="font-bold text-[#0B63E5] dark:text-blue-400 hover:underline">
              রেজিস্ট্রেশন করুন
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
