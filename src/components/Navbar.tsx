import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Compass,
  LogOut,
  LayoutDashboard,
  User,
  Moon,
  Sun,
  Menu,
  X,
  ChevronDown,
  Briefcase,
  ShieldCheck,
  FileText,
  Plus,
  Bell,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { VerifiedBadge } from './VerifiedBadge';
import { NotificationBell } from './NotificationBell';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, isAdmin, logout } = useAuth();
  const { settings, darkMode, setDarkMode } = useSiteSettings();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  const siteTitle = settings.site_name || 'জমি৩৬০';
  const isUserVerified = profile?.verification_status === 'verified' || Boolean(profile?.is_verified);
  const userInitials = profile?.full_name
    ? profile.full_name.charAt(0)
    : user?.email
    ? user.email.charAt(0).toUpperCase()
    : 'উ';

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-[#E5EAF2] dark:border-slate-800 shadow-[0_1px_3px_rgba(15,41,66,0.04)] transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Wordmark & Live Logo */}
        <Link to="/" className="flex items-center gap-2.5 group whitespace-nowrap shrink-0">
          {settings.logo_url ? (
            <img
              src={settings.logo_url}
              alt={siteTitle}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-xl object-contain bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-0.5"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center text-white shadow-sm transition-colors duration-150">
              <Compass className="w-5 h-5" />
            </div>
          )}
          <div className="leading-tight">
            <span className="block text-xl font-extrabold tracking-tight text-[#0F2942] dark:text-white font-siliguri group-hover:text-[var(--brand-primary)] dark:group-hover:text-blue-400 transition-colors">
              {siteTitle}
            </span>
          </div>
        </Link>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-[#1E293B] dark:text-slate-300">
          <Link
            to="/"
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-[var(--brand-primary)] dark:hover:text-blue-400 py-1 ${
              location.pathname === '/'
                ? 'text-[var(--brand-primary)] dark:text-blue-400 font-bold border-b-2 border-[var(--brand-primary)]'
                : ''
            }`}
          >
            হোম
          </Link>
          <Link
            to="/professionals"
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-[var(--brand-primary)] dark:hover:text-blue-400 py-1 ${
              location.pathname === '/professionals'
                ? 'text-[var(--brand-primary)] dark:text-blue-400 font-bold border-b-2 border-[var(--brand-primary)]'
                : ''
            }`}
          >
            পেশাজীবী তালিকা
          </Link>
          <Link
            to="/jobs"
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-[var(--brand-primary)] dark:hover:text-blue-400 py-1 ${
              location.pathname.startsWith('/jobs')
                ? 'text-[var(--brand-primary)] dark:text-blue-400 font-bold border-b-2 border-[var(--brand-primary)]'
                : ''
            }`}
          >
            জব মার্কেটপ্লেস
          </Link>
        </nav>

        {/* Zone 3: Actions & Auth */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <Link
            to={user || profile ? '/jobs/new' : '/login'}
            className="px-3.5 py-2 text-xs font-bold rounded-lg border border-[#BFDBFE] dark:border-blue-800 bg-[#EFF6FF]/70 dark:bg-blue-950/40 text-[var(--brand-primary)] dark:text-blue-300 hover:bg-[#DBEAFE] dark:hover:bg-blue-900/50 flex items-center gap-1 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>জব পোস্ট করুন</span>
          </Link>

          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-300 hover:bg-[#EFF6FF] hover:text-[var(--brand-primary)] dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={darkMode ? 'লাইট মোড' : 'ডার্ক মোড'}
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {(profile || user) && <NotificationBell />}

          {profile || user ? (
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Link
                  to="/admin"
                  className="px-3.5 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 shadow-xs bg-brand text-white"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>অ্যাডমিন</span>
                </Link>
              )}

              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 p-1 pr-3 bg-[#F8FAFC] dark:bg-slate-800 hover:bg-[#EFF6FF] dark:hover:bg-slate-700 rounded-full transition cursor-pointer border border-[#E2E8F0] dark:border-slate-700 whitespace-nowrap"
                >
                  {profile?.profile_photo_url ? (
                    <img
                      src={profile.profile_photo_url}
                      alt={profile.full_name}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover border border-[var(--brand-primary)]"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-brand text-white font-bold flex items-center justify-center text-xs">
                      {userInitials}
                    </div>
                  )}
                  <span className="text-xs font-bold text-[#0F2942] dark:text-slate-200 max-w-[125px] truncate inline-flex items-center gap-1">
                    <span className="truncate">{profile?.full_name || 'আমার একাউন্ট'}</span>
                    {isUserVerified && <VerifiedBadge size="sm" />}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-[#E2E8F0] dark:border-slate-800 py-2 z-50">
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                      <p className="text-xs font-bold text-[#0F2942] dark:text-white flex items-center gap-1">
                        <span className="truncate">{profile?.full_name || 'আমার একাউন্ট'}</span>
                        {isUserVerified && <VerifiedBadge size="sm" />}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {profile?.email || user?.email}
                      </p>
                    </div>

                    <Link
                      to="/account"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#1E293B] dark:text-slate-200 hover:bg-[#EFF6FF] dark:hover:bg-blue-950/40 hover:text-[var(--brand-primary)] transition"
                    >
                      <User className="w-4 h-4 text-[var(--brand-primary)]" />
                      <span>আমার প্রোফাইল</span>
                    </Link>

                    <Link
                      to="/verify"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center justify-between px-4 py-2 text-xs font-medium text-[#1E293B] dark:text-slate-200 hover:bg-[#EFF6FF] dark:hover:bg-blue-950/40 hover:text-[var(--brand-primary)] transition"
                    >
                      <span className="flex items-center gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-[var(--brand-primary)]" />
                        <span>প্রোফাইল ভেরিফিকেশন</span>
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {isUserVerified
                          ? 'ভেরিফাইড'
                          : profile?.verification_status === 'pending'
                          ? 'পেন্ডিং'
                          : 'যাচাই করুন'}
                      </span>
                    </Link>

                    <Link
                      to="/my-jobs"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#1E293B] dark:text-slate-200 hover:bg-[#EFF6FF] dark:hover:bg-blue-950/40 hover:text-[var(--brand-primary)] transition"
                    >
                      <Briefcase className="w-4 h-4 text-[var(--brand-primary)]" />
                      <span>আমার জবসমূহ</span>
                    </Link>

                    <Link
                      to="/my-applications"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#1E293B] dark:text-slate-200 hover:bg-[#EFF6FF] dark:hover:bg-blue-950/40 hover:text-[var(--brand-primary)] transition"
                    >
                      <FileText className="w-4 h-4 text-[var(--brand-primary)]" />
                      <span>আমার আবেদনসমূহ</span>
                    </Link>

                    <Link
                      to="/notifications"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#1E293B] dark:text-slate-200 hover:bg-[#EFF6FF] dark:hover:bg-blue-950/40 hover:text-[var(--brand-primary)] transition"
                    >
                      <Bell className="w-4 h-4 text-[var(--brand-primary)]" />
                      <span>নোটিফিকেশন</span>
                    </Link>

                    {isAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#1E293B] dark:text-slate-200 hover:bg-[#EFF6FF] dark:hover:bg-blue-950/40 hover:text-[var(--brand-primary)] transition border-t border-slate-100 dark:border-slate-800 mt-1 pt-2"
                      >
                        <LayoutDashboard className="w-4 h-4 text-[var(--brand-primary)]" />
                        <span>অ্যাডমিন প্যানেল</span>
                      </Link>
                    )}

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/45 transition cursor-pointer text-left border-t border-slate-100 dark:border-slate-800 mt-1 pt-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>লগআউট</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-4 py-2 border border-[#BFDBFE] dark:border-blue-800 bg-[#EFF6FF]/60 dark:bg-blue-950/40 hover:bg-[#EFF6FF] text-[var(--brand-primary)] dark:text-blue-300 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                লগইন
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 bg-brand text-white text-xs font-bold rounded-lg transition-colors shadow-sm whitespace-nowrap shrink-0"
              >
                রেজিস্ট্রেশন
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger & Bell */}
        <div className="flex md:hidden items-center gap-1.5">
          {(profile || user) && <NotificationBell />}
          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-[#EFF6FF] hover:text-[var(--brand-primary)] dark:hover:bg-slate-800 cursor-pointer"
          >
            {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-[#0F2942] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-slate-900 border-b border-[#E5EAF2] dark:border-slate-800 px-4 py-4 space-y-2.5">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-bold text-[#0F2942] dark:text-slate-200 hover:text-[var(--brand-primary)]"
          >
            হোম
          </Link>
          <Link
            to="/professionals"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-bold text-[#0F2942] dark:text-slate-200 hover:text-[var(--brand-primary)]"
          >
            পেশাজীবী তালিকা
          </Link>
          <Link
            to="/jobs"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-bold text-[#0F2942] dark:text-slate-200 hover:text-[var(--brand-primary)]"
          >
            জব মার্কেটপ্লেস
          </Link>
          <Link
            to={user || profile ? '/jobs/new' : '/login'}
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-bold text-[var(--brand-primary)] dark:text-blue-400"
          >
            + নতুন জব পোস্ট করুন
          </Link>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
            {profile || user ? (
              <>
                {isAdmin && (
                  <Link
                    to="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full py-2.5 bg-brand text-white font-bold text-center text-xs rounded-lg flex items-center justify-center gap-2"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>অ্যাডমিন প্যানেল</span>
                  </Link>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/account"
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-2.5 bg-[#EFF6FF] dark:bg-slate-800 text-[var(--brand-primary)] dark:text-slate-200 font-bold text-center text-xs rounded-lg flex items-center justify-center gap-1.5 border border-[#BFDBFE] dark:border-slate-700"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>প্রোফাইল</span>
                  </Link>
                  <Link
                    to="/verify"
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-2.5 bg-[#EFF6FF] dark:bg-slate-800 text-[var(--brand-primary)] dark:text-slate-200 font-bold text-center text-xs rounded-lg flex items-center justify-center gap-1.5 border border-[#BFDBFE] dark:border-slate-700"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>ভেরিফিকেশন</span>
                  </Link>
                  <Link
                    to="/my-jobs"
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-center text-xs rounded-lg flex items-center justify-center gap-1.5"
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>আমার জব</span>
                  </Link>
                  <Link
                    to="/my-applications"
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-center text-xs rounded-lg flex items-center justify-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>আমার আবেদন</span>
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-2.5 text-red-600 bg-red-50 dark:bg-red-950/40 font-bold text-center text-xs rounded-lg cursor-pointer flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>লগআউট</span>
                </button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2.5 text-center border border-[#BFDBFE] bg-[#EFF6FF]/60 font-bold text-xs rounded-lg text-[var(--brand-primary)]"
                >
                  লগইন
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2.5 text-center bg-brand text-white font-bold text-xs rounded-lg"
                >
                  রেজিস্ট্রেশন
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
