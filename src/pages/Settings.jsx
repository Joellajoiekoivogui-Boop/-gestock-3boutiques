import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Settings as SettingsIcon,
  Store,
  Shield,
  RotateCcw,
  Smartphone,
  CheckCircle,
  HelpCircle,
  Database
} from 'lucide-react';

export const Settings = () => {
  const { boutiques, activeRole, resetToDemoData } = useApp();

  return (
    <div className="settings-page animate-fade">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Paramètres de la Plateforme</h1>
          <p className="page-subtitle">
            Configuration des boutiques, rôles d'accès et gestion des données.
          </p>
        </div>
      </div>

      {/* Boutique Configuration List */}
      <div className="glass-panel p-6 mt-4">
        <h3 className="text-lg font-bold mb-4 flex-center gap-2">
          <Store className="w-5 h-5 text-indigo-400" /> Vos 3 Boutiques Raccordées
        </h3>

        <div className="settings-boutiques-grid">
          {boutiques.map((b) => (
            <div key={b.id} className="boutique-setting-card glass-panel">
              <div className="flex-between">
                <span className="font-bold text-slate-100">{b.name}</span>
                <span className="badge badge-info">{b.id.toUpperCase()}</span>
              </div>
              <div className="text-sm text-slate-400 mt-2 space-y-1">
                <div>📍 <strong>Adresse :</strong> {b.location}</div>
                <div>👤 <strong>Gérant Attribué :</strong> {b.manager}</div>
                <div>📞 <strong>Contact :</strong> {b.phone}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Permissions matrix */}
      <div className="glass-panel p-6 mt-6">
        <h3 className="text-lg font-bold mb-4 flex-center gap-2">
          <Shield className="w-5 h-5 text-emerald-400" /> Matrice des Droits et Privilèges Rôles
        </h3>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fonctionnalité / Action</th>
                <th>Profil Administrateur 🔑</th>
                <th>Profil Gérant Boutique 👤</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Vue consolidée des 3 boutiques</td>
                <td><CheckCircle className="w-4 h-4 text-emerald-400 inline" /> Autorisé</td>
                <td>❌ Limité à sa propre boutique</td>
              </tr>
              <tr>
                <td>Consulter les Prix d'Achat & Marges</td>
                <td><CheckCircle className="w-4 h-4 text-emerald-400 inline" /> Autorisé</td>
                <td>❌ Masqué pour confidentialité</td>
              </tr>
              <tr>
                <td>Passer des ventes Caisse (POS)</td>
                <td><CheckCircle className="w-4 h-4 text-emerald-400 inline" /> Autorisé</td>
                <td><CheckCircle className="w-4 h-4 text-emerald-400 inline" /> Autorisé</td>
              </tr>
              <tr>
                <td>Enregistrer paiements Orange Money & Crédit</td>
                <td><CheckCircle className="w-4 h-4 text-emerald-400 inline" /> Autorisé</td>
                <td><CheckCircle className="w-4 h-4 text-emerald-400 inline" /> Autorisé</td>
              </tr>
              <tr>
                <td>Effectuer des transferts inter-boutiques</td>
                <td><CheckCircle className="w-4 h-4 text-emerald-400 inline" /> Autorisé</td>
                <td>❌ Sur approbation admin</td>
              </tr>
              <tr>
                <td>Générer & Télécharger les rapports PDF</td>
                <td><CheckCircle className="w-4 h-4 text-emerald-400 inline" /> Autorisé</td>
                <td><CheckCircle className="w-4 h-4 text-emerald-400 inline" /> Autorisé (Sa boutique)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Maintenance & Demo Reset */}
      <div className="glass-panel p-6 mt-6 border-red-500/30">
        <h3 className="text-lg font-bold text-red-400 mb-2 flex-center gap-2">
          <Database className="w-5 h-5" /> Maintenance & Données de Démonstration
        </h3>
        <p className="text-sm text-slate-400 mb-4">
          Si vous souhaitez réinitialiser l'application avec le jeu de données initial (produits, ventes test, dettes exemples pour les 3 boutiques), cliquez ci-dessous.
        </p>

        <button
          onClick={() => {
            if (confirm('Voulez-vous réinitialiser toutes les données aux valeurs par défaut ?')) {
              resetToDemoData();
            }
          }}
          className="btn btn-danger flex-center gap-2"
        >
          <RotateCcw className="w-4 h-4" /> Réinitialiser les données de démonstration
        </button>
      </div>
    </div>
  );
};
