import React, { useEffect, useRef, useState } from 'react';
import { Download, Share, PlusSquare, MoreVertical, Smartphone, X } from 'lucide-react';

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

const isIos = () =>
  /iphone|ipad|ipod/i.test(ua) ||
  // iPadOS 13+ se présente comme un Mac
  (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);

const isAndroid = () => /android/i.test(ua);

const isStandalone = () =>
  (typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(display-mode: standalone)').matches) ||
  (typeof navigator !== 'undefined' && navigator.standalone === true);

export const PwaInstall = ({ variant = 'nav' }) => {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(isStandalone());
  const [showHint, setShowHint] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setDeferred(null);
      setInstalled(true);
      setShowHint(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Ferme la bulle d'aide au clic en dehors
  useEffect(() => {
    if (!showHint) return;
    const onClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowHint(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('touchstart', onClickOutside);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('touchstart', onClickOutside);
    };
  }, [showHint]);

  if (installed) return null;

  const triggerNative = async () => {
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') setDeferred(null);
  };

  const handleClick = () => {
    if (deferred) return triggerNative();
    setShowHint((v) => !v);
  };

  const Hint = () => {
    if (isIos()) {
      return (
        <div className="pwa-hint">
          <p>
            <span className="pwa-step">1</span> Touchez{' '}
            <Share className="w-4 h-4 pwa-ic" /> <strong>Partager</strong> en bas de Safari
          </p>
          <p>
            <span className="pwa-step">2</span> Choisissez{' '}
            <PlusSquare className="w-4 h-4 pwa-ic" /> <strong>Sur l'écran d'accueil</strong>
          </p>
        </div>
      );
    }
    return (
      <div className="pwa-hint">
        <p>
          <span className="pwa-step">1</span> Ouvrez le menu{' '}
          <MoreVertical className="w-4 h-4 pwa-ic" /> du navigateur
        </p>
        <p>
          <span className="pwa-step">2</span> Touchez{' '}
          <strong>{isAndroid() ? 'Installer l’application' : 'Ajouter à l’écran d’accueil'}</strong>
        </p>
      </div>
    );
  };

  // -- Variante navbar : toujours visible tant que l'app n'est pas installée --
  if (variant === 'nav') {
    return (
      <div className="pwa-nav-wrapper" ref={wrapperRef}>
        <button type="button" onClick={handleClick} className="pwa-install-btn" title="Télécharger l'application">
          <Download className="w-4 h-4" />
          <span>Télécharger</span>
        </button>

        {!deferred && showHint && (
          <div className="pwa-ios-hint pwa-card">
            <button type="button" className="pwa-ios-close" onClick={() => setShowHint(false)} aria-label="Fermer">
              <X className="w-4 h-4" />
            </button>
            <Hint />
          </div>
        )}
      </div>
    );
  }

  // -- Variante tiroir : toujours proposée tant que l'app n'est pas installée --
  return (
    <div className="pwa-card">
      <div className="pwa-card-top">
        <Smartphone className="w-5 h-5 text-indigo-400" />
        <div>
          <span className="pwa-card-title">Installer l'application</span>
          <span className="pwa-card-sub">Accès rapide depuis l'écran d'accueil, hors-ligne inclus</span>
        </div>
      </div>

      <button type="button" onClick={handleClick} className="btn btn-primary w-full flex-center gap-2">
        <Download className="w-4 h-4" />
        {deferred ? 'Installer maintenant' : showHint ? 'Masquer les étapes' : 'Voir comment faire'}
      </button>

      {!deferred && showHint && <Hint />}
    </div>
  );
};
