import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { SiteSettings } from '../types/database';
import { DEFAULT_SITE_SETTINGS } from '../lib/bangladeshLocations';
import { fetchSiteSettings, updateSiteSettingsInDb } from '../lib/supabase';

function darkenHex(hex: string, amount = 18): string {
  const clean = hex.replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) return hex;
  const r = Math.max(0, parseInt(clean.slice(0, 2), 16) - amount);
  const g = Math.max(0, parseInt(clean.slice(2, 4), 16) - amount);
  const b = Math.max(0, parseInt(clean.slice(4, 6), 16) - amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) return `rgba(11, 99, 229, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface SiteSettingsContextValue {
  settings: SiteSettings;
  loadingSettings: boolean;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  refreshSettings: () => Promise<SiteSettings>;
  saveSettings: (updates: Partial<SiteSettings>) => Promise<SiteSettings>;
}

const SiteSettingsContext = createContext<SiteSettingsContextValue>({
  settings: DEFAULT_SITE_SETTINGS,
  loadingSettings: true,
  darkMode: false,
  setDarkMode: () => {},
  refreshSettings: async () => DEFAULT_SITE_SETTINGS,
  saveSettings: async () => DEFAULT_SITE_SETTINGS,
});

export const SiteSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [darkMode, setDarkModeState] = useState<boolean>(() => {
    return localStorage.getItem('jomi360_theme_mode') === 'dark';
  });

  const applyThemeAndColors = useCallback((s: SiteSettings, isDark: boolean) => {
    const root = document.documentElement;
    const primary = s.primary_color || '#0B63E5';
    const accent = s.accent_color || '#16A34A';

    root.style.setProperty('--brand-primary', primary);
    root.style.setProperty('--brand-primary-hover', darkenHex(primary, 20));
    root.style.setProperty('--brand-primary-soft', hexToRgba(primary, isDark ? 0.2 : 0.1));
    root.style.setProperty('--brand-accent', accent);
    root.style.setProperty('--brand-accent-hover', darkenHex(accent, 18));
    root.style.setProperty('--brand-accent-soft', hexToRgba(accent, isDark ? 0.2 : 0.12));

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    const baseTitle = s.site_name || 'জমি৩৬০';
    const subTitle = s.tagline || 'পেশাজীবী ডিরেক্টরি ও মার্কেটপ্লেস';
    document.title = `${baseTitle} – ${subTitle}`;

    if (s.favicon_url) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = s.favicon_url;
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    const data = await fetchSiteSettings();
    setSettings(data);

    const hasUserOverride = localStorage.getItem('jomi360_theme_user_override') === '1';
    if (!hasUserOverride) {
      const nextDark = data.default_theme === 'dark';
      setDarkModeState(nextDark);
      localStorage.setItem('jomi360_theme_mode', nextDark ? 'dark' : 'light');
    }

    return data;
  }, []);

  useEffect(() => {
    refreshSettings().finally(() => setLoadingSettings(false));
  }, [refreshSettings]);

  useEffect(() => {
    applyThemeAndColors(settings, darkMode);
  }, [settings, darkMode, applyThemeAndColors]);

  const setDarkMode = (dark: boolean) => {
    setDarkModeState(dark);
    localStorage.setItem('jomi360_theme_mode', dark ? 'dark' : 'light');
    localStorage.setItem('jomi360_theme_user_override', '1');
  };

  const saveSettings = async (updates: Partial<SiteSettings>) => {
    const saved = await updateSiteSettingsInDb(updates);
    setSettings(saved);
    return saved;
  };

  return (
    <SiteSettingsContext.Provider
      value={{
        settings,
        loadingSettings,
        darkMode,
        setDarkMode,
        refreshSettings,
        saveSettings,
      }}
    >
      {children}
    </SiteSettingsContext.Provider>
  );
};

export const useSiteSettings = () => useContext(SiteSettingsContext);
