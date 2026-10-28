import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export function NotFound() {
  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-lg border border-[#E2E8F0] dark:border-slate-800 text-center">
        <div className="text-6xl font-extrabold text-[#0B63E5] mb-4">৪০৪</div>
        <h1 className="text-2xl font-bold text-[#0F2942] dark:text-slate-100 mb-2">
          পেজটি পাওয়া যায়নি
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
          আপনি যে পেজটি খুঁজছেন তা সরানো হয়েছে বা অস্তিত্ব নেই।
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#0B63E5] hover:bg-[#084FC7] text-white font-bold rounded-xl transition shadow-sm"
          >
            <Home className="w-4 h-4" />
            হোম পেজে যান
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#F1F5F9] dark:bg-slate-800 hover:bg-[#EFF6FF] dark:hover:bg-slate-700 text-[#0F2942] dark:text-slate-300 font-semibold rounded-xl transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            ফিরে যান
          </button>
        </div>
      </div>
    </div>
  );
}
