import React, { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

const isIos = () =>
  typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

const isStandalone = () =>
  (typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(display-mode: standalone)').matches) ||
  (typeof navigator !== 'undefined' && navigator.standalone === true);

export const PwaInstall = () => {
  const [deferred, setDeferred] = useState(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem('gestock_3b_pwa_dismissed') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setDeferred(null);
      setShowIosHint(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (dismissed || isStandalone()) return null;

  const remember = () => {
    try {
      localStorage.setItem('gestock_3b_pwa_dismissed', '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  const handleClick = async () => {
    if (deferred) {
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') setDeferred(null);
      else remember();
      return;
    }
    if (isIos()) {
      setShowIosHint((v) => !v);
    }
  };

  // Rien à proposer (ni prompt Android, ni iOS Safari)
  if (!deferred && !isIos()) return null;

  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={handleClick} className="pwa-install-btn" title="Installer l'application">
        <Download className="w-4 h-4" />
        <span>Installer l'app</span>
      </button>

      {showIosHint && (
        <div className="pwa-ios-hint glass-panel">
          <button className="pwa-ios-close" onClick={() => setShowIosHint(false)} aria-label="Fermer">
            <X className="w-4 h-4" />
          </button>
          <p>
            Sur iPhone / iPad : appuyez sur <Share className="w-4 h-4" style={{ verticalAlign: 'middle' }} />{' '}
            <strong>Partager</strong>, puis <strong>« Sur l'écran d'accueil »</strong>.
          </p>
        </div>
      )}
    </div>
  );
};
