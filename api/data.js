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
    let articlesQuery = db.from('feuille_articles').select('*').order('sort_order').order('created_at');

    // Un gérant ne voit que les données de sa propre boutique.
    if (!isAdmin) {
      salesQuery = salesQuery.eq('boutique_id', user.boutiqueId);
      debtsQuery = debtsQuery.eq('boutique_id', user.boutiqueId);
      expensesQuery = expensesQuery.eq('boutique_id', user.boutiqueId);
      customersQuery = customersQuery.eq('boutique_id', user.boutiqueId);
      articlesQuery = articlesQuery.eq('boutique_id', user.boutiqueId);
    }

    const [boutiques, articles, sales, debts, expenses, customers] = await Promise.all([
      db.from('boutiques').select('*').order('id'),
      articlesQuery,
      salesQuery,
      debtsQuery,
      expensesQuery,
      customersQuery
    ]);

    const firstError = [boutiques, articles, sales, debts, expenses, customers].find((r) => r.error);
    if (firstError) throw firstError.error;

    // Le catalogue (issu de la Feuille de Vente) alimente Caisse, Tableau de
    // Bord et Rapports — chaque article appartient à une seule boutique.
    const products = toCamel(articles.data).map((a) => ({
      id: a.id,
      boutiqueId: a.boutiqueId,
      name: a.designation,
      category: a.category,
      sellPrice: a.pVente,
      stock: a.stock,
      minAlertStock: a.minAlertStock,
      image: a.image
    }));

    return res.status(200).json({
      boutiques: toCamel(boutiques.data),
      products,
      sales: toCamel(sales.data),
      debts: toCamel(debts.data),
      expenses: toCamel(expenses.data),
      customers: toCamel(customers.data)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erreur serveur.' });
  }
}
