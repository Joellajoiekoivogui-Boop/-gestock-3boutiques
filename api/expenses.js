import { getDb, requireUser, toCamel } from './_db.js';
import { readBody } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const user = requireUser(req);
  if (!user) return res.status(401).json({ error: 'Session invalide ou expirée.' });

  const { category, description, amount, boutiqueId } = readBody(req);
  const targetBoutiqueId = boutiqueId || user.boutiqueId;
  if (!targetBoutiqueId || !(Number(amount) > 0)) {
    return res.status(400).json({ error: 'Dépense invalide.' });
  }
  if (user.role !== 'admin' && user.boutiqueId !== targetBoutiqueId) {
    return res.status(403).json({ error: 'Accès refusé à cette boutique.' });
  }

  const db = getDb();

  try {
    const { data, error } = await db
      .from('expenses')
      .insert({
        boutique_id: targetBoutiqueId,
        category,
        description,
        amount: Number(amount),
        recorded_by: user.role === 'admin' ? 'Administrateur' : user.name
      })
      .select()
      .single();
    if (error) throw error;

    return res.status(200).json({ expense: toCamel(data) });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erreur serveur.' });
  }
}
