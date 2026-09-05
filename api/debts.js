import { getDb, requireUser, toCamel } from './_db.js';
import { readBody } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const user = requireUser(req);
  if (!user) return res.status(401).json({ error: 'Session invalide ou expirée.' });

  const { debtId, amount, paymentMethod, omRef, receivedBy } = readBody(req);
  const numAmount = Number(amount);
  if (!debtId || !(numAmount > 0)) {
    return res.status(400).json({ error: 'Remboursement invalide.' });
  }

  const db = getDb();

  try {
    const { data: debt, error } = await db.from('debts').select('*').eq('id', debtId).single();
    if (error || !debt) return res.status(404).json({ error: 'Dette introuvable.' });

    if (user.role !== 'admin' && user.boutiqueId !== debt.boutique_id) {
      return res.status(403).json({ error: 'Accès refusé à cette dette.' });
    }

    const newRemaining = Math.max(0, Number(debt.remaining_amount) - numAmount);
    const isPaid = newRemaining === 0;
    const repayment = {
      id: `R-${Date.now()}`,
      date: new Date().toISOString(),
      amount: numAmount,
      paymentMethod,
      omRef: omRef || null,
      receivedBy: receivedBy || user.name || 'Gérant'
    };

    const { data: updated, error: updErr } = await db
      .from('debts')
      .update({
        remaining_amount: newRemaining,
        status: isPaid ? 'paid' : 'partial',
        repayments: [...(debt.repayments || []), repayment]
      })
      .eq('id', debtId)
      .select()
      .single();
    if (updErr) throw updErr;

    return res.status(200).json({ debt: toCamel(updated) });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erreur serveur.' });
  }
}
