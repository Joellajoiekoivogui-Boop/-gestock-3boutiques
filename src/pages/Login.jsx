import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Sparkles, Mail, Lock, Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react';

export const Login = () => {
  const { login } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [showHint, setShowHint] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const res = login(email, password);
    if (!res.ok) setError(res.error);
  };

  return (
    <div className="auth-shell">
      <div className="auth-card glass-panel animate-pop">
        <div className="auth-brand">
          <div className="brand-icon">
            <Sparkles className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="auth-title">GESTOCK 3B</h1>
            <p className="auth-subtitle">Gestion Multi-Boutiques — Conakry</p>
          </div>
        </div>

        <h2 className="auth-heading">Connexion à votre espace</h2>
        <p className="auth-help">
          Saisissez l'e-mail et le mot de passe de votre compte pour accéder à votre boutique.
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label flex-center gap-1" style={{ justifyContent: 'flex-start' }}>
              <Mail className="w-3.5 h-3.5" /> Adresse e-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemple@gestock.gn"
              autoComplete="username"
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label flex-center gap-1" style={{ justifyContent: 'flex-start' }}>
              <Lock className="w-3.5 h-3.5" /> Mot de passe
            </label>
            <div className="auth-pwd-wrap">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="form-input"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="auth-pwd-toggle"
                aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="btn btn-primary w-full flex-center gap-2">
            <LogIn className="w-4 h-4" /> Se connecter
          </button>
        </form>

        <button
          type="button"
          className="auth-hint-toggle"
          onClick={() => setShowHint((v) => !v)}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          {showHint ? 'Masquer les comptes de démonstration' : 'Voir les comptes de démonstration'}
        </button>

        {showHint && (
          <div className="auth-hint">
            <div><strong>Admin</strong> · admin@gestock.gn · admin2026</div>
            <div><strong>Gérant Kissosso</strong> · kissosso@gestock.gn · kissosso2026</div>
            <div><strong>Gérant Tombolia</strong> · tombolia@gestock.gn · tombolia2026</div>
            <div><strong>Gérant Sangoyah</strong> · sangoyah@gestock.gn · sangoyah2026</div>
          </div>
        )}
      </div>

      <p className="auth-footer">© {new Date().getFullYear()} Gestock 3B · Tous droits réservés</p>
    </div>
  );
};
