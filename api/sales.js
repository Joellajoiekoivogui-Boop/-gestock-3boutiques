import { getDb, requireUser, toCamel } from './_db.js';
import { readBody } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const user = requireUser(req);
  if (!user) return res.status(401).json({ error: 'Session invalide ou expirée.' });

  const body = readBody(req);
  const { boutiqueId, items, paymentMethod, cashReceived, cashChange, omReference, customerName, customerId, dueDate } = body;

  if (!boutiqueId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Requête de vente invalide.' });
  }
  if (user.role !== 'admin' && user.boutiqueId !== boutiqueId) {
    return res.status(403).json({ error: 'Accès refusé à cette boutique.' });
  }

  const db = getDb();

  try {
    const { data: boutique } = await db.from('boutiques').select('manager').eq('id', boutiqueId).single();
    const { data: articleRows, error: artErr } = await db
      .from('feuille_articles')
      .select('*')
      .eq('boutique_id', boutiqueId)
      .in('id', items.map((i) => i.productId));
    if (artErr) throw artErr;

    // Ne jamais faire confiance au prix/quantité envoyés par le client : on
    // recalcule tout à partir du catalogue (Feuille de Vente) et on rejette
    // les quantités invalides (une quantité négative permettrait sinon de
    // regonfler le stock arbitrairement).
    const resolvedItems = [];
    for (const item of items) {
      const article = articleRows.find((a) => a.id === item.productId);
      if (!article) return res.status(400).json({ error: 'Article introuvable pour cette boutique.' });
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ error: 'Quantité invalide.' });
      }
      if (quantity > Number(article.stock)) {
        return res.status(400).json({ error: `Stock insuffisant pour "${article.designation}".` });
      }
      resolvedItems.push({
        productId: article.id,
        name: article.designation,
        quantity,
        unitPrice: Number(article.p_vente)
      });
    }

    const totalAmount = resolvedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    for (const item of resolvedItems) {
      const article = articleRows.find((a) => a.id === item.productId);
      const { error } = await db
        .from('feuille_articles')
        .update({ stock: Math.max(0, Number(article.stock) - item.quantity) })
        .eq('id', item.productId);
      if (error) throw error;
    }

    const { data: sale, error: saleErr } = await db
      .from('sales')
      .insert({
        boutique_id: boutiqueId,
        items: resolvedItems,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        cash_received: paymentMethod === 'cash' ? Number(cashReceived) : null,
        cash_change: paymentMethod === 'cash' ? Number(cashChange) : null,
        om_reference: paymentMethod === 'orange_money' ? omReference : null,
        customer_name: customerName || 'Client Passant',
        customer_id: customerId || null,
        due_date: paymentMethod === 'credit' ? dueDate || null : null,
        seller: boutique?.manager || (user.role === 'admin' ? 'Administrateur' : user.name)
      })
      .select()
      .single();
    if (saleErr) throw saleErr;

    if (paymentMethod === 'credit') {
      const finalDueDate = dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
      const finalCustomerName = customerName || 'Client Crédit';

      const { data: boutiqueCustomers } = await db.from('customers').select('*').eq('boutique_id', boutiqueId);
      const existingCustomer =
        (boutiqueCustomers || []).find((c) => c.name.toLowerCase() === finalCustomerName.toLowerCase()) || null;
      let resolvedCustomerId;

      if (existingCustomer) {
        await db
          .from('customers')
          .update({ total_debt: Number(existingCustomer.total_debt) + totalAmount })
          .eq('id', existingCustomer.id);
        resolvedCustomerId = existingCustomer.id;
      } else {
        const { data: newCustomer, error: custErr } = await db
          .from('customers')
          .insert({ name: finalCustomerName, boutique_id: boutiqueId, total_debt: totalAmount })
          .select()
          .single();
        if (custErr) throw custErr;
        resolvedCustomerId = newCustomer.id;
      }

      const { error: debtErr } = await db.from('debts').insert({
        customer_id: resolvedCustomerId,
        customer_name: finalCustomerName,
        boutique_id: boutiqueId,
        sale_id: sale.id,
        due_date: finalDueDate,
        original_amount: totalAmount,
        remaining_amount: totalAmount,
        status: 'pending'
      });
      if (debtErr) throw debtErr;
    }

    return res.status(200).json({ sale: toCamel(sale) });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erreur serveur.' });
  }
}
