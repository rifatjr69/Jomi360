import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import type { Banner } from '../types/database';
import { fetchActiveBanners } from '../lib/marketplaceService';

export const HomeBannerCarousel: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    fetchActiveBanners().then((list) => {
      setBanners(Array.isArray(list) ? list : []);
    });
  }, []);

  useEffect(() => {
    if (banners.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length, isPaused]);

  // Hide the section completely if there are no active banners
  if (banners.length === 0) {
    return null;
  }

  const current = banners[currentIndex] || banners[0];

  const goPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const goNext = () => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsPaused(false);
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const diff = touchStartX.current - endX;
    if (Math.abs(diff) > 45) {
      if (diff > 0) goNext();
      else goPrev();
    }
    touchStartX.current = null;
  };

  const titleText = current.title?.trim() || '';
  const subtitleText = current.subtitle?.trim() || '';
  const hasTextOverlay = Boolean(titleText || subtitleText);
  const linkUrl = current.link_url?.trim() || '';

  const isExternalLink = Boolean(
    linkUrl && (linkUrl.startsWith('http://') || linkUrl.startsWith('https://'))
  );

  const bannerPicture = (
    <picture className="block w-full h-full">
      {current.mobile_image_url && (
        <source media="(max-width: 639px)" srcSet={current.mobile_image_url} />
      )}
      <img
        src={current.image_url}
        alt={titleText || 'প্রোমোশনাল ব্যানার'}
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover transition-all duration-500"
      />
    </picture>
  );

  return (
    <section
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label="হোম পেজ প্রোমোশনাল ব্যানার"
    >
      <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 shadow-[0_6px_24px_rgba(15,41,66,0.08)]">
        <div className="relative h-52 sm:h-72 lg:h-80 w-full">
          {!hasTextOverlay && linkUrl ? (
            isExternalLink ? (
              <a
                href={linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full h-full cursor-pointer"
                aria-label="প্রোমোশনাল ব্যানার লিংক"
              >
                {bannerPicture}
              </a>
            ) : (
              <Link
                to={linkUrl}
                className="block w-full h-full cursor-pointer"
                aria-label="প্রোমোশনাল ব্যানার লিংক"
              >
                {bannerPicture}
              </Link>
            )
          ) : (
            bannerPicture
          )}

          {hasTextOverlay && (
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/45 to-transparent flex items-center">
              <div className="px-6 sm:px-12 max-w-2xl space-y-3 text-white">
                {titleText && (
                  <h2 className="text-xl sm:text-3xl lg:text-4xl font-black font-siliguri leading-snug text-balance">
                    {titleText}
                  </h2>
                )}
                {subtitleText && (
                  <p className="text-xs sm:text-base text-slate-200 line-clamp-2 leading-relaxed">
                    {subtitleText}
                  </p>
                )}
                {linkUrl && (
                  <div className="pt-1">
                    {isExternalLink ? (
                      <a
                        href={linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-colors"
                      >
                        <span>{current.button_text || 'বিস্তারিত দেখুন'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </a>
                    ) : (
                      <Link
                        to={linkUrl}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-colors"
                      >
                        <span>{current.button_text || 'বিস্তারিত দেখুন'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {banners.length > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                aria-label="পূর্ববর্তী ব্যানার"
                className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 hover:bg-white text-slate-900 items-center justify-center shadow-md transition cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="পরবর্তী ব্যানার"
                className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 hover:bg-white text-slate-900 items-center justify-center shadow-md transition cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                {banners.map((b, idx) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    aria-label={`ব্যানার ${idx + 1}`}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      idx === currentIndex ? 'w-6 bg-white' : 'w-2 bg-white/55 hover:bg-white/80'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};
