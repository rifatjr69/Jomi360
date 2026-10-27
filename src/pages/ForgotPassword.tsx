import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Send, Compass } from 'lucide-react';
import { resetUserPassword } from '../lib/supabase';
import { useToast } from '../components/Toast';

export const ForgotPassword: React.FC = () => {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.trim()) {
      showToast('আপনার ই-মেইল ঠিকানা প্রদান করুন।', 'error');
      return;
    }

    setLoading(true);
    try {
      await resetUserPassword(email.trim());
      setSubmitted(true);
      showToast('পাসওয়ার্ড রিসেট লিংক সফলভাবে পাঠানো হয়েছে।', 'success');
    } catch (err: any) {
      console.error('[ForgotPassword] Error:', err);
      const msg = err.message || 'রিসেট লিংক পাঠাতে সমস্যা হয়েছে। আবার চেষ্টা করুন।';
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-600 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30">
            <Compass className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white font-siliguri">
            পাসওয়ার্ড পুনরুদ্ধার
          </h2>
          <p className="text-xs text-slate-500">আপনার রেজিস্টર્ડ ই-মেইল ঠিকানা দিন</p>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {submitted ? (
          <div className="space-y-4 text-center">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-sm">
              ই-মেইলে পাসওয়ার্ড রিসেট নির্দেশনা পাঠানো হয়েছে। ইনবক্স বা স্প্যাম ফোল্ডার চেক করুন।
            </div>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-md shadow-emerald-600/20"
            >
              লগইন পেজে ফিরে যান
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                ই-মেইল ঠিকানা
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@domain.com"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>রিসেট লিংক পাঠান</span>
                </>
              )}
            </button>
          </form>
        )}

        <div className="text-center pt-2">
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>লগইন পেজে ফিরে যান</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
