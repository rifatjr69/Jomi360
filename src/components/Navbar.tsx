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
    return document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load site settings
  useEffect(() => {
    fetchSiteSettings().then(setSettings);
  }, [location.pathname]);

  // Dark Mode Toggle
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Close dropdown on click outside or Esc
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
  const userInitials = profile?.full_name ? profile.full_name.charAt(0) : (user?.email ? user.email.charAt(0).toUpperCase() : 'উ');

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-700 via-emerald-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-emerald-900/20 group-hover:scale-105 transition-transform duration-200">
            <Compass className="w-6 h-6 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white font-siliguri group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
              {siteTitle}
            </span>
            <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 tracking-wider -mt-1 uppercase">
              {settings?.site_name_en || 'JOMI360'} DIRECTORY
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-700 dark:text-slate-300">
          <Link
            to="/"
            className={`transition-colors hover:text-emerald-600 dark:hover:text-emerald-400 ${
              location.pathname === '/' ? 'text-emerald-600 dark:text-emerald-400 font-bold border-b-2 border-emerald-600 pb-1' : ''
            }`}
          >
            হোম
          </Link>
          <Link
            to="/professionals"
            className={`transition-colors hover:text-emerald-600 dark:hover:text-emerald-400 ${
              location.pathname === '/professionals' ? 'text-emerald-600 dark:text-emerald-400 font-bold border-b-2 border-emerald-600 pb-1' : ''
            }`}
          >
            পেশাজীবী তালিকা
          </Link>
        </nav>

        {/* Actions & Auth */}
        <div className="hidden md:flex items-center gap-3">
          {/* Dark Mode Button */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={darkMode ? 'লাইট মোড' : 'ডার্ক মোড'}
          >
            {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
          </button>

          {profile || user ? (
            <div className="flex items-center gap-3">
              {/* Admin Dashboard Link (Only if admin) */}
              {isAdmin && (
                <Link
                  to="/dashboard"
                  className={`px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-sm ${
                    location.pathname.startsWith('/dashboard')
                      ? 'bg-emerald-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  ড্যাশবোর্ড
                </Link>
              )}

              {/* Account Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2.5 p-1.5 pr-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition cursor-pointer border border-slate-200 dark:border-slate-700"
                >
                  {profile?.profile_photo_url ? (
                    <img
                      src={profile.profile_photo_url}
                      alt={profile.full_name}
                      className="w-8 h-8 rounded-full object-cover border border-emerald-500"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
                      {userInitials}
                    </div>
                  )}
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 max-w-[130px] truncate">
                    {profile?.full_name || 'আমার একাউন্ট'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-fadeIn">
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {profile?.full_name || 'আমার একাউন্ট'}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">{profile?.email || user?.email}</p>
                    </div>

                    <Link
                      to="/account"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 transition"
                    >
                      <User className="w-4 h-4 text-emerald-600" />
                      আমার একাউন্ট ও প্রোফাইল
                    </Link>

                    {isAdmin && (
                      <Link
                        to="/dashboard"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 transition"
                      >
                        <LayoutDashboard className="w-4 h-4 text-emerald-600" />
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
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-4 py-2 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 text-xs font-bold transition-colors"
              >
                লগইন
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20"
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
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4 space-y-3 animate-fadeIn">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-bold text-slate-800 dark:text-slate-200 hover:text-emerald-600"
          >
            হোম
          </Link>
          <Link
            to="/professionals"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-bold text-slate-800 dark:text-slate-200 hover:text-emerald-600"
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
                    className="w-full py-2.5 bg-emerald-600 text-white font-bold text-center text-xs rounded-xl flex items-center justify-center gap-2"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    ড্যাশবোর্ড
                  </Link>
                )}
                <Link
                  to="/account"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-center text-xs rounded-xl flex items-center justify-center gap-2"
                >
                  <User className="w-4 h-4 text-emerald-600" />
                  আমার প্রোফাইল
                </Link>
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-2.5 text-red-600 bg-red-50 dark:bg-red-950/40 font-bold text-center text-xs rounded-xl cursor-pointer flex items-center justify-center gap-2"
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
                  className="py-2.5 text-center bg-slate-100 dark:bg-slate-800 font-bold text-xs rounded-xl text-slate-800 dark:text-slate-200"
                >
                  লগইন
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2.5 text-center bg-emerald-600 text-white font-bold text-xs rounded-xl"
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
