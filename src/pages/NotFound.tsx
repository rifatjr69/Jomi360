import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export function NotFound() {
  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 text-center">
        <div className="text-6xl font-extrabold text-emerald-600 mb-4">৪০৪</div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          পেজটি পাওয়া যায়নি
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
          আপনি যে পেজটি খুঁজছেন তা সরানো হয়েছে বা অস্তিত্ব নেই।
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition shadow-md shadow-emerald-600/20"
          >
            <Home className="w-4 h-4" />
            হোম পেজে যান
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-xl transition"
          >
            <ArrowLeft className="w-4 h-4" />
            ফিরে যান
          </button>
        </div>
      </div>
    </div>
  );
}
