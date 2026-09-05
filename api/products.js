import { getDb, requireUser, toCamel } from './_db.js';
import { readBody } from './_lib.js';

export default async function handler(req, res) {
  const user = requireUser(req);
  if (!user) return res.status(401).json({ error: 'Session invalide ou expirée.' });

  const db = getDb();

  if (req.method === 'POST') {
    if (user.role !== 'admin') {
      return res.status(403).json({ error: "Accès refusé : seul l'administrateur peut ajouter des produits." });
    }
    const body = readBody(req);
    try {
      const { data, error } = await db
        .from('products')
        .insert({
          name: body.name,
          category: body.category,
          buy_price: Number(body.buyPrice) || 0,
          sell_price: Number(body.sellPrice) || 0,
          min_alert_stock: Number(body.minAlertStock) || 0,
          image: body.image || null,
          stocks: body.stocks || { b1: 0, b2: 0, b3: 0 }
        })
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json({ product: toCamel(data) });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Erreur serveur.' });
    }
  }

  if (req.method === 'PATCH') {
    const { id, ...fields } = readBody(req);
    if (!id) return res.status(400).json({ error: 'Produit manquant.' });

    const patch = {};
    if (fields.name !== undefined) patch.name = fields.name;
    if (fields.category !== undefined) patch.category = fields.category;
    if (fields.buyPrice !== undefined) patch.buy_price = Number(fields.buyPrice);
    if (fields.sellPrice !== undefined) patch.sell_price = Number(fields.sellPrice);
    if (fields.minAlertStock !== undefined) patch.min_alert_stock = Number(fields.minAlertStock);
    if (fields.image !== undefined) patch.image = fields.image;
    if (fields.stocks !== undefined) patch.stocks = fields.stocks;

    try {
      const { data, error } = await db.from('products').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json({ product: toCamel(data) });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Erreur serveur.' });
    }
  }

  res.setHeader('Allow', 'POST, PATCH');
  return res.status(405).json({ error: 'Méthode non autorisée' });
}
