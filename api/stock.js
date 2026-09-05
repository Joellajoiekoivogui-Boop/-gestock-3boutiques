import { getDb, requireUser, toCamel } from './_db.js';
import { readBody } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const user = requireUser(req);
  if (!user) return res.status(401).json({ error: 'Session invalide ou expirée.' });
  if (user.role !== 'admin') {
    return res.status(403).json({ error: "Accès refusé : seul l'administrateur peut transférer du stock." });
  }

  const { productId, fromBoutiqueId, toBoutiqueId, quantity } = readBody(req);
  const qty = Number(quantity);
  if (!productId || !fromBoutiqueId || !toBoutiqueId || !(qty > 0)) {
    return res.status(400).json({ error: 'Transfert invalide.' });
  }

  const db = getDb();

  try {
    const { data: product, error } = await db.from('products').select('*').eq('id', productId).single();
    if (error || !product) return res.status(404).json({ error: 'Produit introuvable.' });

    const stocks = { ...(product.stocks || {}) };
    const currentFrom = stocks[fromBoutiqueId] || 0;
    if (currentFrom < qty) {
      return res.status(400).json({ error: 'Stock insuffisant dans la boutique source.' });
    }

    stocks[fromBoutiqueId] = currentFrom - qty;
    stocks[toBoutiqueId] = (stocks[toBoutiqueId] || 0) + qty;

    const { data: updated, error: updErr } = await db
      .from('products')
      .update({ stocks })
      .eq('id', productId)
      .select()
      .single();
    if (updErr) throw updErr;

    return res.status(200).json({ product: toCamel(updated) });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erreur serveur.' });
  }
}
