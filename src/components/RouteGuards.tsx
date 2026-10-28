import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RefreshCw, AlertCircle } from 'lucide-react';

export const GuestRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4 px-4">
        <div className="w-12 h-12 border-4 border-[#0B63E5] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 font-siliguri">
          যাচাই করা হচ্ছে...
        </p>
      </div>
    );
  }

  if (user || profile) {
    if (profile?.role === 'admin') {
      return <Navigate to="/dashboard" replace />;
    }
    return <Navigate to="/account" replace />;
  }

  return <>{children}</>;
};

export const UserRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading, error, refreshProfile } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4 px-4">
        <div className="w-12 h-12 border-4 border-[#0B63E5] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 font-siliguri">
          প্রোফাইল লোড হচ্ছে...
        </p>
      </div>
    );
  }

  if (error && !user && !profile) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-md mx-auto">
        <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-[#0F2942] dark:text-white font-siliguri">
          প্রোফাইল লোড করা যায়নি
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          {error || 'সার্ভার থেকে প্রোফাইল তথ্য লোড করতে সমস্যা হয়েছে।'}
        </p>
        <button
          onClick={() => refreshProfile()}
          className="px-6 py-2.5 bg-[#0B63E5] hover:bg-[#084FC7] text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-2 transition cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>আবার চেষ্টা করুন</span>
        </button>
      </div>
    );
  }

  if (!user && !profile) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, isAdmin, loading, error, refreshProfile } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4 px-4">
        <div className="w-12 h-12 border-4 border-[#0B63E5] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 font-siliguri">
          অ্যাডমিন অনুমোদন যাচাই করা হচ্ছে...
        </p>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-md mx-auto">
        <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-[#0F2942] dark:text-white font-siliguri">
          প্রোফাইল লোড করা যায়নি
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          {error || 'সার্ভার থেকে প্রোফাইল তথ্য লোড করতে সমস্যা হয়েছে।'}
        </p>
        <button
          onClick={() => refreshProfile()}
          className="px-6 py-2.5 bg-[#0B63E5] hover:bg-[#084FC7] text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-2 transition cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>আবার চেষ্টা করুন</span>
        </button>
      </div>
    );
  }

  if (!user && !profile) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin && profile?.role !== 'admin') {
    return <Navigate to="/account" replace />;
  }

  return <>{children}</>;
};
