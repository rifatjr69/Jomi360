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
} from 'lucide-react';
import { fetchSiteSettings } from '../lib/supabase';
import type { SiteSettings } from '../types/database';
import { useAuth } from '../context/AuthContext';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, isAdmin, logout } = useAuth();

  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('jomi360_theme_mode') === 'dark';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSiteSettings().then(setSettings);
  }, [location.pathname]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('jomi360_theme_mode', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('jomi360_theme_mode', 'light');
    }
  }, [darkMode]);

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

  const siteTitle = settings?.site_name || 'জমি৩৬০';
  const userInitials = profile?.full_name
    ? profile.full_name.charAt(0)
    : user?.email
    ? user.email.charAt(0).toUpperCase()
    : 'উ';

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-[#E5EAF2] dark:border-slate-800 shadow-[0_1px_3px_rgba(15,41,66,0.04)] transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <Link to="/" className="flex items-center gap-2.5 group whitespace-nowrap shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[#0B63E5] flex items-center justify-center text-white shadow-sm shadow-blue-600/20 group-hover:bg-[#084FC7] transition-colors duration-150">
            <Compass className="w-5 h-5" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-[#0F2942] dark:text-white font-siliguri group-hover:text-[#0B63E5] dark:group-hover:text-blue-400 transition-colors">
            {siteTitle}
          </span>
        </Link>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-[#1E293B] dark:text-slate-300">
          <Link
            to="/"
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#0B63E5] dark:hover:text-blue-400 py-1 ${
              location.pathname === '/'
                ? 'text-[#0B63E5] dark:text-blue-400 font-bold border-b-2 border-[#0B63E5]'
                : ''
            }`}
          >
            হোম
          </Link>
          <Link
            to="/professionals"
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#0B63E5] dark:hover:text-blue-400 py-1 ${
              location.pathname === '/professionals'
                ? 'text-[#0B63E5] dark:text-blue-400 font-bold border-b-2 border-[#0B63E5]'
                : ''
            }`}
          >
            পেশাজীবী তালিকা
          </Link>
        </nav>

        {/* Zone 3: Actions & Auth */}
        <div className="hidden md:flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-300 hover:bg-[#EFF6FF] hover:text-[#0B63E5] dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={darkMode ? 'লাইট মোড' : 'ডার্ক মোড'}
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {profile || user ? (
            <div className="flex items-center gap-2.5">
              {isAdmin && (
                <Link
                  to="/dashboard"
                  className={`px-3.5 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 shadow-xs ${
                    location.pathname.startsWith('/dashboard')
                      ? 'bg-[#084FC7] text-white'
                      : 'bg-[#0B63E5] hover:bg-[#084FC7] text-white'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  ড্যাশবোর্ড
                </Link>
              )}

              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 p-1 pr-3 bg-[#F8FAFC] dark:bg-slate-800 hover:bg-[#EFF6FF] dark:hover:bg-slate-700 rounded-full transition cursor-pointer border border-[#E2E8F0] dark:border-slate-700 whitespace-nowrap"
                >
                  {profile?.profile_photo_url ? (
                    <img
                      src={profile.profile_photo_url}
                      alt={profile.full_name}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover border border-[#0B63E5]"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#0B63E5] text-white font-bold flex items-center justify-center text-xs">
                      {userInitials}
                    </div>
                  )}
                  <span className="text-xs font-bold text-[#0F2942] dark:text-slate-200 max-w-[130px] truncate">
                    {profile?.full_name || 'আমার একাউন্ট'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-[#E2E8F0] dark:border-slate-800 py-2 z-50">
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                      <p className="text-xs font-bold text-[#0F2942] dark:text-white truncate">
                        {profile?.full_name || 'আমার একাউন্ট'}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {profile?.email || user?.email}
                      </p>
                    </div>

                    <Link
                      to="/account"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-[#1E293B] dark:text-slate-200 hover:bg-[#EFF6FF] dark:hover:bg-blue-950/40 hover:text-[#0B63E5] transition"
                    >
                      <User className="w-4 h-4 text-[#0B63E5]" />
                      আমার একাউন্ট ও প্রোফাইল
                    </Link>

                    {isAdmin && (
                      <Link
                        to="/dashboard"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-[#1E293B] dark:text-slate-200 hover:bg-[#EFF6FF] dark:hover:bg-blue-950/40 hover:text-[#0B63E5] transition"
                      >
                        <LayoutDashboard className="w-4 h-4 text-[#0B63E5]" />
                        অ্যাডমিন ড্যাশবোর্ড
                      </Link>
                    )}

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/45 transition cursor-pointer text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      লগআউট
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <Link
                to="/login"
                className="px-4 py-2 border border-[#BFDBFE] dark:border-blue-800 bg-[#EFF6FF]/60 dark:bg-blue-950/40 hover:bg-[#EFF6FF] text-[#0B63E5] dark:text-blue-300 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                লগইন
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 bg-[#0B63E5] hover:bg-[#084FC7] text-white text-xs font-bold rounded-lg transition-colors shadow-sm shadow-blue-600/15 whitespace-nowrap shrink-0"
              >
                রেজিস্ট্রেশন
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-[#EFF6FF] hover:text-[#0B63E5] dark:hover:bg-slate-800 cursor-pointer"
          >
            {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-[#0F2942] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-slate-900 border-b border-[#E5EAF2] dark:border-slate-800 px-4 py-4 space-y-3">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-bold text-[#0F2942] dark:text-slate-200 hover:text-[#0B63E5]"
          >
            হোম
          </Link>
          <Link
            to="/professionals"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-bold text-[#0F2942] dark:text-slate-200 hover:text-[#0B63E5]"
          >
            পেশাজীবী তালিকা
          </Link>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
            {profile || user ? (
              <>
                {isAdmin && (
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full py-2.5 bg-[#0B63E5] hover:bg-[#084FC7] text-white font-bold text-center text-xs rounded-lg flex items-center justify-center gap-2"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    ড্যাশবোর্ড
                  </Link>
                )}
                <Link
                  to="/account"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 bg-[#EFF6FF] dark:bg-slate-800 text-[#0B63E5] dark:text-slate-200 font-bold text-center text-xs rounded-lg flex items-center justify-center gap-2 border border-[#BFDBFE] dark:border-slate-700"
                >
                  <User className="w-4 h-4 text-[#0B63E5]" />
                  আমার প্রোফাইল
                </Link>
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-2.5 text-red-600 bg-red-50 dark:bg-red-950/40 font-bold text-center text-xs rounded-lg cursor-pointer flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  লগআউট
                </button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2.5 text-center border border-[#BFDBFE] bg-[#EFF6FF]/60 font-bold text-xs rounded-lg text-[#0B63E5]"
                >
                  লগইন
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2.5 text-center bg-[#0B63E5] text-white font-bold text-xs rounded-lg"
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
