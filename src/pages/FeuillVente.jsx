import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatMoney } from '../utils/formatters';
import { Plus, Trash2, Save, ClipboardList, Printer, Pencil, FolderPlus, Lock } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const newLigne = (category) => ({
  id: Date.now() + Math.random(),
  category,
  designation: '',
  pVente: '',
  initial: '',
  nouveau: '',
  reste: ''
});

const calcLigne = (l) => {
  const pVente = Number(l.pVente) || 0;
  const initial = Number(l.initial) || 0;
  const nouveau = Number(l.nouveau) || 0;
  const reste = Number(l.reste) || 0;
  const total = initial + nouveau;
  const qteVendue = Math.max(0, total - reste);
  const somme = qteVendue * pVente;
  return { total, qteVendue, somme };
};

// Catégories libres : le vendeur crée les siennes (Chicha, Charbon, Arômes...)
const DEFAULT_INITIAL_LIGNES = [
  { id: 'init-1', category: 'Charbon', designation: 'Carton de charbon', pVente: '', initial: '', nouveau: '', reste: '' },
  { id: 'init-2', category: 'Charbon', designation: 'Charbon tête restant', pVente: '60000', initial: '21', nouveau: '48', reste: '23' },
  { id: 'init-3', category: 'Chicha', designation: 'Tete 60.000', pVente: '10000', initial: '', nouveau: '', reste: '' },
  { id: 'init-4', category: 'Chicha', designation: 'Café', pVente: '60000', initial: '', nouveau: '', reste: '' },
  { id: 'init-5', category: 'Chicha', designation: 'Déjà vu', pVente: '50000', initial: '', nouveau: '', reste: '' },
  { id: 'init-6', category: 'Chicha', designation: 'Tete 100000', pVente: '40000', initial: '', nouveau: '', reste: '' }
];

const storageKey = (boutiqueId, date) => `gestock_3b_feuille_vente_${boutiqueId}_${date}`;

// Le gérant ne renseigne que le comptage du jour (Initial / Reste).
// La création des articles, le prix et le nouveau stock sont réservés à l'admin.
const GERANT_EDITABLE = ['initial', 'reste'];

export const FeuillVente = () => {
  const { activeBoutique, activeBoutiqueId, addToast, activeRole } = useApp();
  const isAdmin = activeRole === 'admin';

  const todayStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [lignes, setLignes] = useState(DEFAULT_INITIAL_LIGNES);
  const [saved, setSaved] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const boutiqueName =
    activeBoutiqueId === 'all' ? 'Toutes les Boutiques' : activeBoutique?.name || 'Boutique';

  // Load the sheet saved for the current (boutique, date) pair
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(activeBoutiqueId, date));
      if (raw) {
        const parsed = JSON.parse(raw);
        setLignes(Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_INITIAL_LIGNES);
      } else {
        setLignes(DEFAULT_INITIAL_LIGNES);
      }
    } catch {
      setLignes(DEFAULT_INITIAL_LIGNES);
    }
    setSaved(false);
  }, [activeBoutiqueId, date]);

  const updateLigne = useCallback(
    (id, field, value) => {
      if (!isAdmin && !GERANT_EDITABLE.includes(field)) return;
      setSaved(false);
      setLignes((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
    },
    [isAdmin]
  );

  const addLigne = (category) => {
    if (!isAdmin) return;
    setLignes((prev) => [...prev, newLigne(category)]);
    setSaved(false);
  };

  const removeLigne = (id) => {
    if (!isAdmin) return;
    setLignes((prev) => prev.filter((l) => l.id !== id));
    setSaved(false);
  };

  const addCategory = () => {
    if (!isAdmin) return;
    const name = newCatName.trim();
    if (!name) return;
    const exists = lignes.some((l) => l.category.toLowerCase() === name.toLowerCase());
    if (exists) {
      addToast(`La catégorie "${name}" existe déjà.`, 'info');
    } else {
      setLignes((prev) => [...prev, newLigne(name)]);
      setSaved(false);
    }
    setNewCatName('');
  };

  const renameCategory = (oldName) => {
    if (!isAdmin) return;
    const next = window.prompt('Renommer la catégorie :', oldName);
    if (!next || !next.trim() || next.trim() === oldName) return;
    const name = next.trim();
    setLignes((prev) => prev.map((l) => (l.category === oldName ? { ...l, category: name } : l)));
    setSaved(false);
  };

  const removeCategory = (name) => {
    if (!isAdmin) return;
    if (!window.confirm(`Supprimer la catégorie "${name}" et toutes ses lignes ?`)) return;
    setLignes((prev) => prev.filter((l) => l.category !== name));
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem(storageKey(activeBoutiqueId, date), JSON.stringify(lignes));
    setSaved(true);
    addToast('Feuille de vente sauvegardée !', 'success');
  };

  // Distinct categories, in the order they first appear
  const sections = useMemo(() => {
    const order = [];
    for (const l of lignes) {
      if (!order.includes(l.category)) order.push(l.category);
    }
    return order.map((name) => ({
      name,
      lignes: lignes.filter((l) => l.category === name)
    }));
  }, [lignes]);

  const sectionTotals = (secLignes) =>
    secLignes.reduce(
      (acc, l) => {
        const { qteVendue, somme } = calcLigne(l);
        return { qteVendue: acc.qteVendue + qteVendue, somme: acc.somme + somme };
      },
      { qteVendue: 0, somme: 0 }
    );

  const grandTotal = lignes.reduce((acc, l) => acc + calcLigne(l).somme, 0);
  const totalQteVendue = lignes.reduce((acc, l) => acc + calcLigne(l).qteVendue, 0);
  const nbReferences = lignes.filter((l) => l.designation.trim()).length;

  const handlePrint = () => {
    const doc = new jsPDF();

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('GESTOCK 3B — FEUILLE DE VENTE JOURNALIÈRE', 14, 14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(`Boutique : ${boutiqueName}  |  Date : ${date}`, 14, 23);

    let startY = 36;

    sections.forEach((sec) => {
      const rows = sec.lignes.map((l) => {
        const { total, qteVendue, somme } = calcLigne(l);
        return [
          l.designation || '—',
          l.pVente ? formatMoney(Number(l.pVente)) : '—',
          l.initial || '—',
          l.nouveau || '—',
          total || '—',
          l.reste || '—',
          qteVendue || '—',
          somme ? formatMoney(somme) : '—'
        ];
      });

      const st = sectionTotals(sec.lignes);
      rows.push([
        { content: `Sous-total ${sec.name}`, colSpan: 6, styles: { fontStyle: 'bold' } },
        { content: String(st.qteVendue), styles: { fontStyle: 'bold', halign: 'center' } },
        { content: formatMoney(st.somme), styles: { fontStyle: 'bold' } }
      ]);

      autoTable(doc, {
        startY,
        head: [
          [{ content: sec.name.toUpperCase(), colSpan: 8, styles: { halign: 'left', fillColor: [30, 41, 59] } }],
          ['Désignation', 'P.Vente', 'Initial', 'Nouveau', 'Total', 'Reste', 'Qté Vendue', 'Somme']
        ],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { cellWidth: 45 }, 7: { fontStyle: 'bold' } }
      });

      startY = doc.lastAutoTable.finalY + 6;
    });

    const finalY = startY + 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`TOTAL GÉNÉRAL : ${formatMoney(grandTotal)}`, 14, finalY);
    doc.text(`Quantités Vendues : ${totalQteVendue} unités`, 14, finalY + 8);

    doc.save(`FeuillVente_${boutiqueName.replace(/\s+/g, '_')}_${date}.pdf`);
  };

  return (
    <div className="feuille-vente-page animate-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title flex-center gap-2" style={{ justifyContent: 'flex-start' }}>
            <ClipboardList className="w-6 h-6 text-indigo-400" />
            Feuille de Vente Journalière
          </h1>
          <p className="page-subtitle">
            {boutiqueName} — {todayStr}
          </p>
        </div>

        <div className="flex-center gap-2" style={{ flexWrap: 'wrap' }}>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="form-input"
            style={{ width: 'auto', fontSize: '0.85rem' }}
          />
          <button onClick={handleSave} className="btn btn-emerald flex-center gap-2">
            <Save className="w-4 h-4" /> {saved ? 'Sauvegardé ✓' : 'Sauvegarder'}
          </button>
          <button onClick={handlePrint} className="btn btn-primary flex-center gap-2">
            <Printer className="w-4 h-4" /> Imprimer PDF
          </button>
        </div>
      </div>

      {/* Create a new category — admin only */}
      {isAdmin && (
        <div className="glass-panel feuille-add-section mt-4">
          <span className="val-label">Nouvelle catégorie :</span>
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
            placeholder="Ex : Chicha, Charbon, Arômes..."
            className="filter-select"
            style={{ flex: 1, minWidth: 160 }}
          />
          <button onClick={addCategory} className="btn btn-secondary flex-center gap-2">
            <FolderPlus className="w-4 h-4" /> Ajouter la catégorie
          </button>
        </div>
      )}

      {!isAdmin && (
        <div className="glass-panel feuille-add-section mt-4" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <Lock className="w-3.5 h-3.5" />
          Vous renseignez uniquement le <strong>stock Initial</strong> et le <strong>Reste</strong>.
          Les articles, le prix et le nouveau stock sont gérés par l'administrateur.
        </div>
      )}

      {sections.length === 0 && (
        <div className="glass-panel feuille-empty mt-4">
          {isAdmin
            ? 'Aucune catégorie. Créez-en une ci-dessus pour commencer votre feuille de vente.'
            : "Aucun article. L'administrateur doit d'abord configurer la feuille de stock."}
        </div>
      )}

      {/* One panel per category */}
      {sections.map((sec) => {
        const st = sectionTotals(sec.lignes);
        return (
          <div key={sec.name} className="glass-panel table-container feuille-section mt-4">
            <div className="feuille-cat-header">
              <div className="feuille-cat-title-wrap">
                <span className="feuille-cat-title">{sec.name}</span>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => renameCategory(sec.name)}
                      className="btn-icon"
                      title="Renommer la catégorie"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeCategory(sec.name)}
                      className="btn-icon"
                      title="Supprimer la catégorie"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </>
                )}
              </div>
              <span className="feuille-cat-meta">
                {sec.lignes.length} ligne{sec.lignes.length > 1 ? 's' : ''} · {st.qteVendue} u. vendues ·{' '}
                <strong>{formatMoney(st.somme)}</strong>
              </span>
            </div>

            <div className="table-responsive">
              <table className="data-table feuille-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 180 }} title={isAdmin ? undefined : 'Article défini par l\'administrateur'}>
                      Désignation {!isAdmin && <Lock className="w-3 h-3" style={{ verticalAlign: 'middle' }} />}
                    </th>
                    <th style={{ minWidth: 110 }} title={isAdmin ? undefined : 'Prix fixé par l\'administrateur'}>
                      P.Vente (GNF) {!isAdmin && <Lock className="w-3 h-3" style={{ verticalAlign: 'middle' }} />}
                    </th>
                    <th style={{ minWidth: 80 }}>Initial</th>
                    <th style={{ minWidth: 90 }} title={isAdmin ? undefined : 'Réservé à l\'administrateur'}>
                      Nouveau {!isAdmin && <Lock className="w-3 h-3" style={{ verticalAlign: 'middle' }} />}
                    </th>
                    <th style={{ minWidth: 70, background: 'rgba(99,102,241,0.08)' }}>Total</th>
                    <th style={{ minWidth: 80 }}>Reste</th>
                    <th style={{ minWidth: 90, background: 'rgba(16,185,129,0.08)' }}>Qté Vendue</th>
                    <th style={{ minWidth: 130, background: 'rgba(16,185,129,0.08)' }}>Somme</th>
                    <th style={{ minWidth: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sec.lignes.map((l) => {
                    const { total, qteVendue, somme } = calcLigne(l);
                    return (
                      <tr key={l.id} className="feuille-row">
                        <td>
                          {isAdmin ? (
                            <input
                              className="feuille-input"
                              type="text"
                              placeholder="Ex: Charbon Coconut..."
                              value={l.designation}
                              onChange={(e) => updateLigne(l.id, 'designation', e.target.value)}
                            />
                          ) : (
                            <span className="feuille-designation-ro">{l.designation || '—'}</span>
                          )}
                        </td>
                        <td>
                          {isAdmin ? (
                            <input
                              className="feuille-input feuille-input-num"
                              type="number"
                              placeholder="60000"
                              value={l.pVente}
                              onChange={(e) => updateLigne(l.id, 'pVente', e.target.value)}
                            />
                          ) : (
                            <span
                              className="feuille-calc-val feuille-locked"
                              title="Prix fixé par l'administrateur"
                            >
                              {l.pVente ? formatMoney(Number(l.pVente)) : '—'}
                            </span>
                          )}
                        </td>
                        <td>
                          <input
                            className="feuille-input feuille-input-num"
                            type="number"
                            placeholder="0"
                            value={l.initial}
                            onChange={(e) => updateLigne(l.id, 'initial', e.target.value)}
                          />
                        </td>
                        <td>
                          {isAdmin ? (
                            <input
                              className="feuille-input feuille-input-num"
                              type="number"
                              placeholder="0"
                              value={l.nouveau}
                              onChange={(e) => updateLigne(l.id, 'nouveau', e.target.value)}
                            />
                          ) : (
                            <span
                              className="feuille-calc-val feuille-locked"
                              title="Seul l'administrateur peut saisir le nouveau stock"
                            >
                              {l.nouveau || '—'}
                            </span>
                          )}
                        </td>
                        <td style={{ background: 'rgba(99,102,241,0.05)', textAlign: 'center' }}>
                          <span className="feuille-calc-val text-indigo-400">{total || '—'}</span>
                        </td>
                        <td>
                          <input
                            className="feuille-input feuille-input-num"
                            type="number"
                            placeholder="0"
                            value={l.reste}
                            onChange={(e) => updateLigne(l.id, 'reste', e.target.value)}
                          />
                        </td>
                        <td style={{ background: 'rgba(16,185,129,0.05)', textAlign: 'center' }}>
                          <span className="feuille-calc-val text-emerald-400">{qteVendue || '—'}</span>
                        </td>
                        <td style={{ background: 'rgba(16,185,129,0.05)' }}>
                          <span className="feuille-somme">{somme ? formatMoney(somme) : '—'}</span>
                        </td>
                        <td>
                          {isAdmin && (
                            <button
                              onClick={() => removeLigne(l.id)}
                              className="btn-icon"
                              title="Supprimer cette ligne"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="feuille-footer-row">
                    <td colSpan={2}>
                      {isAdmin && (
                        <button onClick={() => addLigne(sec.name)} className="btn-add-ligne">
                          <Plus className="w-4 h-4" /> Ajouter une ligne
                        </button>
                      )}
                    </td>
                    <td colSpan={4}></td>
                    <td style={{ textAlign: 'center', fontWeight: 800, color: '#34d399' }}>
                      {st.qteVendue > 0 ? st.qteVendue : '—'}
                    </td>
                    <td>
                      <span style={{ fontWeight: 800, fontSize: '1rem', color: '#818cf8' }}>
                        {st.somme > 0 ? formatMoney(st.somme) : '—'}
                      </span>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })}

      {/* Global summary */}
      {grandTotal > 0 && (
        <div className="feuille-summary mt-4">
          <div className="feuille-summary-card glass-panel">
            <span className="val-label">Total Quantités Vendues</span>
            <span className="val-num text-emerald-400">{totalQteVendue} unités</span>
          </div>
          <div className="feuille-summary-card glass-panel">
            <span className="val-label">Chiffre d'Affaires du Jour</span>
            <span className="val-num text-indigo-400">{formatMoney(grandTotal)}</span>
          </div>
          <div className="feuille-summary-card glass-panel">
            <span className="val-label">Nombre de Références</span>
            <span className="val-num text-amber-400">{nbReferences}</span>
          </div>
        </div>
      )}
    </div>
  );
};
