import React, { useState } from 'react';
import { AlertTriangle, Copy, Check, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { JOBS_RLS_FIX_SQL } from '../lib/jobsSqlFix';

interface JobsRlsFixBannerProps {
  onRetry?: () => void;
}

export const JobsRlsFixBanner: React.FC<JobsRlsFixBannerProps> = ({ onRetry }) => {
  const [copied, setCopied] = useState(false);
  const [showSql, setShowSql] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JOBS_RLS_FIX_SQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setShowSql(true);
    }
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded-2xl shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm sm:text-base font-black text-amber-950 dark:text-amber-100 font-siliguri">
              ডাটাবেস পলিসি আপডেট প্রয়োজন (Supabase Error 42P17)
            </h3>
            <p className="text-xs sm:text-sm text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
              আপনার Supabase ডাটাবেসের <code className="font-mono font-bold">jobs</code> ও{' '}
              <code className="font-mono font-bold">job_applications</code> টেবিলের পুরনো RLS পলিসিতে লুপ থাকায় জব লোড ও পোস্ট ব্লক হচ্ছে। নিচের বাটনে ক্লিক করে ফিক্স SQL কপি করে{' '}
              <strong>Supabase SQL Editor</strong>-এ একবার <strong>Run</strong> করলেই জব পোস্ট, আবেদন, হায়ার ও মেসেজিং সাথে সাথে সচল হয়ে যাবে।
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="px-4 py-2.5 bg-brand text-white text-xs font-extrabold rounded-xl inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'SQL কপি হয়েছে!' : 'ফিক্স SQL কপি করুন'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSql((prev) => !prev)}
            className="px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs font-bold rounded-xl inline-flex items-center gap-1 cursor-pointer"
          >
            <span>{showSql ? 'SQL লুকান' : 'SQL দেখুন'}</span>
            {showSql ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>পুনরায় চেক করুন</span>
            </button>
          )}
        </div>
      </div>

      {showSql && (
        <pre className="p-4 bg-slate-950 text-emerald-300 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-64 overflow-y-auto border border-slate-800">
          {JOBS_RLS_FIX_SQL}
        </pre>
      )}
    </div>
  );
};
