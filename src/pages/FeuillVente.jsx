import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatMoney } from '../utils/formatters';
import { calcLigne } from '../utils/feuilleCalc';
import { Plus, Trash2, Save, ClipboardList, Printer, Pencil, FolderPlus, Lock } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const newLigne = (category) => ({
  id: `new-${Date.now()}-${Math.random()}`,
  category,
  designation: '',
  pVente: '',
  stock: '',
  minAlertStock: '',
  initial: '',
  nouveau: '',
  reste: ''
});

// Catégories libres suggérées au tout premier usage d'une boutique (aucun
// article enregistré) — l'admin les édite puis les sauvegarde pour de bon.
const DEFAULT_INITIAL_LIGNES = [
  { id: 'init-1', category: 'Charbon', designation: 'Carton de charbon', pVente: '', stock: '', minAlertStock: '', initial: '', nouveau: '', reste: '' },
  { id: 'init-2', category: 'Charbon', designation: 'Charbon tête restant', pVente: '60000', stock: '23', minAlertStock: '10', initial: '21', nouveau: '48', reste: '23' },
  { id: 'init-3', category: 'Chicha', designation: 'Tete 60.000', pVente: '10000', stock: '', minAlertStock: '', initial: '', nouveau: '', reste: '' },
  { id: 'init-4', category: 'Chicha', designation: 'Café', pVente: '60000', stock: '', minAlertStock: '', initial: '', nouveau: '', reste: '' },
  { id: 'init-5', category: 'Chicha', designation: 'Déjà vu', pVente: '50000', stock: '', minAlertStock: '', initial: '', nouveau: '', reste: '' },
  { id: 'init-6', category: 'Chicha', designation: 'Tete 100000', pVente: '40000', stock: '', minAlertStock: '', initial: '', nouveau: '', reste: '' }
];

// Le gérant ne renseigne que le "Reste" du jour en cours — l'Initial est
// calculé automatiquement (report du Reste de la veille), et tout le reste
// (articles, prix, nouveau stock) est réservé à l'admin.
const GERANT_EDITABLE = ['reste'];

// Le gérant ne peut saisir que la journée commerciale en cours : elle bascule
// à 3h du matin (le rangement/comptage d'une soirée se fait parfois après
// minuit). Passé cette heure, la veille est verrouillée pour lui — seul
// l'admin peut encore la modifier.
const currentBusinessDate = () => {
  const now = new Date();
  if (now.getHours() < 3) now.setDate(now.getDate() - 1);
  return now.toISOString().split('T')[0];
};

const sectionsOf = (lignes) => {
  const order = [];
  for (const l of lignes) {
    if (!order.includes(l.category)) order.push(l.category);
  }
  return order.map((name) => ({ name, lignes: lignes.filter((l) => l.category === name) }));
};

const sectionTotals = (secLignes) =>
  secLignes.reduce(
    (acc, l) => {
      const { qteVendue, somme } = calcLigne(l);
      return { qteVendue: acc.qteVendue + qteVendue, somme: acc.somme + somme };
    },
    { qteVendue: 0, somme: 0 }
  );

// Un bloc de tableaux (une boutique). `canEdit` gouverne toute saisie ;
// pour la vue "Toutes les Boutiques" de l'admin, canEdit vaut toujours false.
const FeuilleBoutique = ({
  lignes,
  canEdit,
  isAdmin,
  isEditableDate,
  onUpdateLigne,
  onRemoveLigne,
  onAddLigne,
  onRenameCategory,
  onRemoveCategory
}) => {
  const sections = useMemo(() => sectionsOf(lignes), [lignes]);

  const canEditField = (field) => {
    if (!canEdit) return false;
    if (isAdmin) return true;
    if (!GERANT_EDITABLE.includes(field)) return false;
    return isEditableDate;
  };

  if (sections.length === 0) {
    return (
      <div className="glass-panel feuille-empty mt-4">
        {canEdit
          ? 'Aucune catégorie. Créez-en une ci-dessus pour commencer votre feuille de vente.'
          : "Aucun article. L'administrateur doit d'abord configurer la feuille de stock."}
      </div>
    );
  }

  return (
    <>
      {sections.map((sec) => {
        const st = sectionTotals(sec.lignes);
        return (
          <div key={sec.name} className="glass-panel table-container feuille-section mt-4">
            <div className="feuille-cat-header">
              <div className="feuille-cat-title-wrap">
                <span className="feuille-cat-title">{sec.name}</span>
                {canEdit && (
                  <>
                    <button onClick={() => onRenameCategory(sec.name)} className="btn-icon" title="Renommer la catégorie">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => onRemoveCategory(sec.name)} className="btn-icon" title="Supprimer la catégorie">
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
                    <th style={{ minWidth: 180 }} title={canEdit ? undefined : "Article défini par l'administrateur"}>
                      Désignation {!canEdit && <Lock className="w-3 h-3" style={{ verticalAlign: 'middle' }} />}
                    </th>
                    <th style={{ minWidth: 110 }} title={canEdit ? undefined : 'Prix fixé par l\'administrateur'}>
                      P.Vente (GNF) {!canEdit && <Lock className="w-3 h-3" style={{ verticalAlign: 'middle' }} />}
                    </th>
                    <th style={{ minWidth: 80 }} title="Stock disponible en Caisse — réservé à l'administrateur">
                      Stock {!canEdit && <Lock className="w-3 h-3" style={{ verticalAlign: 'middle' }} />}
                    </th>
                    <th style={{ minWidth: 90 }} title="Seuil d'alerte stock bas — réservé à l'administrateur">
                      Alerte {!canEdit && <Lock className="w-3 h-3" style={{ verticalAlign: 'middle' }} />}
                    </th>
                    <th style={{ minWidth: 80 }} title={canEditField('initial') ? undefined : 'Calculé automatiquement (report du Reste de la veille)'}>
                      Initial {!canEditField('initial') && <Lock className="w-3 h-3" style={{ verticalAlign: 'middle' }} />}
                    </th>
                    <th style={{ minWidth: 90 }} title={canEdit ? undefined : "Réservé à l'administrateur"}>
                      Nouveau {!canEdit && <Lock className="w-3 h-3" style={{ verticalAlign: 'middle' }} />}
                    </th>
                    <th style={{ minWidth: 70, background: 'rgba(99,102,241,0.08)' }}>Total</th>
                    <th style={{ minWidth: 80 }} title={canEditField('reste') ? undefined : !isAdmin && canEdit ? 'Journée verrouillée — seul l\'administrateur peut la modifier' : undefined}>
                      Reste {canEdit && !isAdmin && !isEditableDate && <Lock className="w-3 h-3" style={{ verticalAlign: 'middle' }} />}
                    </th>
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
                          {canEditField('designation') ? (
                            <input
                              className="feuille-input"
                              type="text"
                              placeholder="Ex: Charbon Coconut..."
                              value={l.designation}
                              onChange={(e) => onUpdateLigne(l.id, 'designation', e.target.value)}
                            />
                          ) : (
                            <span className="feuille-designation-ro">{l.designation || '—'}</span>
                          )}
                        </td>
                        <td>
                          {canEditField('pVente') ? (
                            <input
                              className="feuille-input feuille-input-num"
                              type="number"
                              placeholder="60000"
                              value={l.pVente}
                              onChange={(e) => onUpdateLigne(l.id, 'pVente', e.target.value)}
                            />
                          ) : (
                            <span className="feuille-calc-val feuille-locked" title="Prix fixé par l'administrateur">
                              {l.pVente ? formatMoney(Number(l.pVente)) : '—'}
                            </span>
                          )}
                        </td>
                        <td>
                          {canEditField('stock') ? (
                            <input
                              className="feuille-input feuille-input-num"
                              type="number"
                              placeholder="0"
                              value={l.stock}
                              onChange={(e) => onUpdateLigne(l.id, 'stock', e.target.value)}
                            />
                          ) : (
                            <span className="feuille-calc-val feuille-locked" title="Stock géré par l'administrateur">
                              {l.stock || '—'}
                            </span>
                          )}
                        </td>
                        <td>
                          {canEditField('minAlertStock') ? (
                            <input
                              className="feuille-input feuille-input-num"
                              type="number"
                              placeholder="0"
                              value={l.minAlertStock}
                              onChange={(e) => onUpdateLigne(l.id, 'minAlertStock', e.target.value)}
                            />
                          ) : (
                            <span className="feuille-calc-val feuille-locked" title="Seuil géré par l'administrateur">
                              {l.minAlertStock || '—'}
                            </span>
                          )}
                        </td>
                        <td>
                          {canEditField('initial') ? (
                            <input
                              className="feuille-input feuille-input-num"
                              type="number"
                              placeholder="0"
                              value={l.initial}
                              onChange={(e) => onUpdateLigne(l.id, 'initial', e.target.value)}
                            />
                          ) : (
                            <span className="feuille-calc-val">{l.initial || '—'}</span>
                          )}
                        </td>
                        <td>
                          {canEditField('nouveau') ? (
                            <input
                              className="feuille-input feuille-input-num"
                              type="number"
                              placeholder="0"
                              value={l.nouveau}
                              onChange={(e) => onUpdateLigne(l.id, 'nouveau', e.target.value)}
                            />
                          ) : (
                            <span className="feuille-calc-val feuille-locked" title="Seul l'administrateur peut saisir le nouveau stock">
                              {l.nouveau || '—'}
                            </span>
                          )}
                        </td>
                        <td style={{ background: 'rgba(99,102,241,0.05)', textAlign: 'center' }}>
                          <span className="feuille-calc-val text-indigo-400">{total || '—'}</span>
                        </td>
                        <td>
                          {canEditField('reste') ? (
                            <input
                              className="feuille-input feuille-input-num"
                              type="number"
                              placeholder="0"
                              value={l.reste}
                              onChange={(e) => onUpdateLigne(l.id, 'reste', e.target.value)}
                            />
                          ) : (
                            <span className="feuille-calc-val">{l.reste || '—'}</span>
                          )}
                        </td>
                        <td style={{ background: 'rgba(16,185,129,0.05)', textAlign: 'center' }}>
                          <span className="feuille-calc-val text-emerald-400">{qteVendue || '—'}</span>
                        </td>
                        <td style={{ background: 'rgba(16,185,129,0.05)' }}>
                          <span className="feuille-somme">{somme ? formatMoney(somme) : '—'}</span>
                        </td>
                        <td>
                          {canEdit && (
                            <button onClick={() => onRemoveLigne(l.id)} className="btn-icon" title="Supprimer cette ligne">
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
                      {canEdit && (
                        <button onClick={() => onAddLigne(sec.name)} className="btn-add-ligne">
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
    </>
  );
};

export const FeuillVente = () => {
  const { activeBoutique, activeBoutiqueId, addToast, activeRole, apiRequest, refreshData } = useApp();
  const isAdmin = activeRole === 'admin';

  const todayStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const [date, setDate] = useState(currentBusinessDate);
  const [lignes, setLignes] = useState([]);
  const [allBoutiquesData, setAllBoutiquesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const boutiqueName =
    activeBoutiqueId === 'all' ? 'Toutes les Boutiques' : activeBoutique?.name || 'Boutique';

  const isEditableDate = date === currentBusinessDate();

  // Charge la feuille (Supabase) pour la boutique + date sélectionnées
  const load = useCallback(async () => {
    setLoading(true);
    if (activeBoutiqueId === 'all') {
      const result = await apiRequest(`/api/feuille?boutiqueId=all&date=${date}`, 'GET');
      if (result.ok) setAllBoutiquesData(result.data.boutiques || []);
      setLoading(false);
      return;
    }
    const result = await apiRequest(`/api/feuille?boutiqueId=${activeBoutiqueId}&date=${date}`, 'GET');
    if (result.ok) {
      const fetched = result.data.lignes || [];
      setLignes(fetched.length ? fetched : isAdmin ? DEFAULT_INITIAL_LIGNES : []);
    }
    setLoading(false);
  }, [activeBoutiqueId, date, apiRequest, isAdmin]);

  useEffect(() => {
    load();
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleSave = async () => {
    const result = await apiRequest('/api/feuille', 'POST', { boutiqueId: activeBoutiqueId, date, lignes });
    if (!result.ok) return;
    setLignes(result.data.lignes || []);
    setSaved(true);
    addToast('Feuille de vente sauvegardée !', 'success');
    // Le catalogue (Caisse, Tableau de Bord, Rapports) doit refléter les
    // articles/stocks à l'instant, pas seulement au prochain login.
    refreshData();
  };

  const sections = useMemo(() => sectionsOf(lignes), [lignes]);
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
    doc.text('DRAMERA CHICHA — FEUILLE DE VENTE JOURNALIÈRE', 14, 14);
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

  const isAllView = activeBoutiqueId === 'all';

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
          {!isAllView && (isAdmin || isEditableDate) && (
            <button onClick={handleSave} className="btn btn-emerald flex-center gap-2">
              <Save className="w-4 h-4" /> {saved ? 'Sauvegardé ✓' : 'Sauvegarder'}
            </button>
          )}
          <button onClick={handlePrint} className="btn btn-primary flex-center gap-2">
            <Printer className="w-4 h-4" /> Imprimer PDF
          </button>
        </div>
      </div>

      {isAllView && (
        <div className="glass-panel feuille-add-section mt-4" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <Lock className="w-3.5 h-3.5" />
          Vue consolidée en lecture seule. Sélectionnez une boutique précise pour saisir ou modifier sa feuille.
        </div>
      )}

      {!isAllView && isAdmin && (
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

      {!isAllView && !isAdmin && (
        <div className="glass-panel feuille-add-section mt-4" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <Lock className="w-3.5 h-3.5" />
          {isEditableDate
            ? "Vous renseignez uniquement le Reste du jour. L'Initial, les articles, le prix et le nouveau stock sont gérés par l'administrateur."
            : "Cette journée est clôturée (elle n'est plus modifiable après 3h du matin) — seul l'administrateur peut encore la modifier."}
        </div>
      )}

      {loading && <div className="glass-panel feuille-empty mt-4">Chargement…</div>}

      {!loading && isAllView && (
        <>
          {allBoutiquesData.map((b) => (
            <div key={b.boutiqueId} className="mt-6">
              <div
                className="feuille-cat-title"
                style={{ borderLeft: `3px solid ${b.boutiqueColor}`, paddingLeft: 10, marginBottom: 4 }}
              >
                🏬 {b.boutiqueName}
              </div>
              <FeuilleBoutique lignes={b.lignes} canEdit={false} isAdmin={isAdmin} isEditableDate={isEditableDate} />
            </div>
          ))}
        </>
      )}

      {!loading && !isAllView && (
        <FeuilleBoutique
          lignes={lignes}
          canEdit={true}
          isAdmin={isAdmin}
          isEditableDate={isEditableDate}
          onUpdateLigne={updateLigne}
          onRemoveLigne={removeLigne}
          onAddLigne={addLigne}
          onRenameCategory={renameCategory}
          onRemoveCategory={removeCategory}
        />
      )}

      {/* Global summary */}
      {!isAllView && grandTotal > 0 && (
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
