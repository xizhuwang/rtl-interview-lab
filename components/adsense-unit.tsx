'use client';

import { useEffect, useRef, useState } from 'react';

import { adsenseConfig } from '@/lib/adsense-config';
import type { Locale } from '@/lib/challenges';

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

let adsenseScriptPromise: Promise<void> | null = null;

function loadAdSenseScript(clientId: string) {
  if (adsenseScriptPromise) return adsenseScriptPromise;

  adsenseScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-rtl-lab-adsense="true"]',
    );
    if (existing) {
      if (existing.dataset.loaded === 'true') resolve();
      else {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Ad script failed')), {
          once: true,
        });
      }
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.rtlLabAdsense = 'true';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = 'true';
        resolve();
      },
      { once: true },
    );
    script.addEventListener('error', () => reject(new Error('Ad script failed')), {
      once: true,
    });
    document.head.appendChild(script);
  });

  return adsenseScriptPromise;
}

export function AdSenseUnit({ locale }: { locale: Locale }) {
  const shellRef = useRef<HTMLElement>(null);
  const requestedRef = useRef(false);
  const [nearViewport, setNearViewport] = useState(false);

  const canServeAds =
    adsenseConfig.enabled &&
    typeof window !== 'undefined' &&
    adsenseConfig.allowedHosts.has(window.location.hostname);

  useEffect(() => {
    if (!canServeAds || !shellRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setNearViewport(true);
        observer.disconnect();
      },
      { rootMargin: '320px 0px' },
    );
    observer.observe(shellRef.current);
    return () => observer.disconnect();
  }, [canServeAds]);

  useEffect(() => {
    if (!canServeAds || !nearViewport || requestedRef.current) return;

    let cancelled = false;
    const requestAd = () => {
      void loadAdSenseScript(adsenseConfig.clientId)
        .then(() => {
          if (cancelled || requestedRef.current) return;
          requestedRef.current = true;
          window.adsbygoogle = window.adsbygoogle ?? [];
          window.adsbygoogle.push({});
        })
        .catch(() => {
          // An ad blocker or network failure must never affect the lab UI.
        });
    };

    const idleId = window.requestIdleCallback?.(requestAd, { timeout: 1800 });
    const timerId = idleId === undefined ? window.setTimeout(requestAd, 800) : undefined;

    return () => {
      cancelled = true;
      if (idleId !== undefined) window.cancelIdleCallback?.(idleId);
      if (timerId !== undefined) window.clearTimeout(timerId);
    };
  }, [canServeAds, nearViewport]);

  if (!canServeAds) return null;

  return (
    <aside ref={shellRef} className="site-ad-shell" aria-label={locale === 'zh' ? '廣告' : 'Advertisement'}>
      <span className="site-ad-label">{locale === 'zh' ? '廣告' : 'Advertisement'}</span>
      <ins
        className="adsbygoogle site-ad-unit"
        data-ad-client={adsenseConfig.clientId}
        data-ad-slot={adsenseConfig.footerSlotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}

