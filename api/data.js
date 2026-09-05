import { getDb, requireUser, toCamel } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const user = requireUser(req);
  if (!user) return res.status(401).json({ error: 'Session invalide ou expirée.' });

  try {
    const db = getDb();
    const [boutiques, products, sales, debts, expenses, customers] = await Promise.all([
      db.from('boutiques').select('*').order('id'),
      db.from('products').select('*').order('created_at'),
      db.from('sales').select('*').order('date', { ascending: false }),
      db.from('debts').select('*').order('date', { ascending: false }),
      db.from('expenses').select('*').order('date', { ascending: false }),
      db.from('customers').select('*').order('created_at')
    ]);

    const firstError = [boutiques, products, sales, debts, expenses, customers].find((r) => r.error);
    if (firstError) throw firstError.error;

    return res.status(200).json({
      boutiques: toCamel(boutiques.data),
      products: toCamel(products.data),
      sales: toCamel(sales.data),
      debts: toCamel(debts.data),
      expenses: toCamel(expenses.data),
      customers: toCamel(customers.data)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erreur serveur.' });
  }
}
