// Calculs partagés sur les lignes de la Feuille de Vente (Initial/Nouveau/Reste
// → Quantité Vendue → Somme), utilisés par la Feuille de Vente elle-même,
// le Tableau de Bord et les Rapports PDF.
export const calcLigne = (l) => {
  const pVente = Number(l.pVente) || 0;
  const initial = Number(l.initial) || 0;
  const nouveau = Number(l.nouveau) || 0;
  const reste = Number(l.reste) || 0;
  const total = initial + nouveau;
  const qteVendue = Math.max(0, total - reste);
  const somme = qteVendue * pVente;
  return { total, qteVendue, somme };
};

// Chiffre d'affaires total d'une feuille (somme de toutes ses lignes).
export const feuilleTotal = (lignes) => lignes.reduce((sum, l) => sum + calcLigne(l).somme, 0);
