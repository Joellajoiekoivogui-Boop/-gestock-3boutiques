import { getDb, requireUser, toCamel } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const user = requireUser(req);
  if (!user) return res.status(401).json({ error: 'Session invalide ou expirée.' });

  const isAdmin = user.role === 'admin';

  try {
    const db = getDb();

    let salesQuery = db.from('sales').select('*').order('date', { ascending: false });
    let debtsQuery = db.from('debts').select('*').order('date', { ascending: false });
    let expensesQuery = db.from('expenses').select('*').order('date', { ascending: false });
    let customersQuery = db.from('customers').select('*').order('created_at');

    // Un gérant ne voit que les données de sa propre boutique.
    if (!isAdmin) {
      salesQuery = salesQuery.eq('boutique_id', user.boutiqueId);
      debtsQuery = debtsQuery.eq('boutique_id', user.boutiqueId);
      expensesQuery = expensesQuery.eq('boutique_id', user.boutiqueId);
      customersQuery = customersQuery.eq('boutique_id', user.boutiqueId);
    }

    const [boutiques, products, sales, debts, expenses, customers] = await Promise.all([
      db.from('boutiques').select('*').order('id'),
      db.from('products').select('*').order('created_at'),
      salesQuery,
      debtsQuery,
      expensesQuery,
      customersQuery
    ]);

    const firstError = [boutiques, products, sales, debts, expenses, customers].find((r) => r.error);
    if (firstError) throw firstError.error;

    let products_ = toCamel(products.data);
    if (!isAdmin) {
      // Prix d'achat et stocks des autres boutiques : réservés à l'administrateur.
      products_ = products_.map((p) => {
        const { buyPrice: _buyPrice, stocks, ...rest } = p;
        return { ...rest, stocks: { [user.boutiqueId]: stocks?.[user.boutiqueId] || 0 } };
      });
    }

    return res.status(200).json({
      boutiques: toCamel(boutiques.data),
      products: products_,
      sales: toCamel(sales.data),
      debts: toCamel(debts.data),
      expenses: toCamel(expenses.data),
      customers: toCamel(customers.data)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erreur serveur.' });
  }
}
