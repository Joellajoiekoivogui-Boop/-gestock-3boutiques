import { getDb, requireUser, toCamel } from './_db.js';
import { readBody } from './_lib.js';

// Construit les "lignes" (forme attendue par le frontend) pour une boutique
// et une date données, en reportant le "reste" du dernier jour saisi comme
// "initial" du jour demandé quand ce dernier n'a pas encore été saisi.
async function buildLignes(db, boutiqueId, date) {
  const { data: articles, error: artErr } = await db
    .from('feuille_articles')
    .select('*')
    .eq('boutique_id', boutiqueId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (artErr) throw artErr;
  if (!articles.length) return [];

  const articleIds = articles.map((a) => a.id);
  const { data: counts, error: cntErr } = await db
    .from('feuille_counts')
    .select('*')
    .in('article_id', articleIds)
    .lte('date', date)
    .order('date', { ascending: false });
  if (cntErr) throw cntErr;

  const latestByArticle = new Map();
  for (const c of counts) {
    if (!latestByArticle.has(c.article_id)) latestByArticle.set(c.article_id, c);
  }

  return articles.map((a) => {
    const latest = latestByArticle.get(a.id);
    let initial = '';
    let nouveau = '';
    let reste = '';

    if (latest && latest.date === date) {
      // Le jour demandé a déjà été saisi : on renvoie tel quel.
      initial = latest.initial ?? '';
      nouveau = latest.nouveau ?? '';
      reste = latest.reste ?? '';
    } else if (latest) {
      // Report automatique : le reste du dernier jour saisi devient l'initial du jour.
      initial = latest.reste ?? 0;
      nouveau = 0;
      reste = '';
    } else {
      initial = 0;
      nouveau = 0;
      reste = '';
    }

    return {
      id: a.id,
      category: a.category,
      designation: a.designation,
      pVente: a.p_vente,
      stock: a.stock,
      minAlertStock: a.min_alert_stock,
      image: a.image,
      initial,
      nouveau,
      reste
    };
  });
}

function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export default async function handler(req, res) {
  const user = requireUser(req);
  if (!user) return res.status(401).json({ error: 'Session invalide ou expirée.' });

  const db = getDb();

  if (req.method === 'GET') {
    const { boutiqueId, date } = req.query;
    if (!date) return res.status(400).json({ error: 'Date manquante.' });

    try {
      if (boutiqueId === 'all') {
        if (user.role !== 'admin') {
          return res.status(403).json({ error: 'Accès refusé.' });
        }
        const { data: boutiques, error } = await db.from('boutiques').select('*').order('id');
        if (error) throw error;

        const results = await Promise.all(
          boutiques.map(async (b) => ({
            boutiqueId: b.id,
            boutiqueName: b.name,
            boutiqueColor: b.color,
            lignes: await buildLignes(db, b.id, date)
          }))
        );
        return res.status(200).json({ boutiques: results });
      }

      if (!boutiqueId) return res.status(400).json({ error: 'Boutique manquante.' });
      if (user.role !== 'admin' && user.boutiqueId !== boutiqueId) {
        return res.status(403).json({ error: 'Accès refusé à cette boutique.' });
      }

      const lignes = await buildLignes(db, boutiqueId, date);
      return res.status(200).json({ lignes: toCamel(lignes) });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Erreur serveur.' });
    }
  }

  if (req.method === 'POST') {
    const { boutiqueId, date, lignes } = readBody(req);
    if (!boutiqueId || !date || !Array.isArray(lignes)) {
      return res.status(400).json({ error: 'Requête invalide.' });
    }
    if (user.role !== 'admin' && user.boutiqueId !== boutiqueId) {
      return res.status(403).json({ error: 'Accès refusé à cette boutique.' });
    }
    const isAdmin = user.role === 'admin';

    try {
      const { data: existingArticles, error: exErr } = await db
        .from('feuille_articles')
        .select('id')
        .eq('boutique_id', boutiqueId);
      if (exErr) throw exErr;
      const existingIds = new Set(existingArticles.map((a) => a.id));
      const postedExistingIds = new Set();

      for (const ligne of lignes) {
        let articleId = ligne.id;

        if (isUuid(articleId) && existingIds.has(articleId)) {
          postedExistingIds.add(articleId);
          if (isAdmin) {
            const { error } = await db
              .from('feuille_articles')
              .update({
                category: ligne.category,
                designation: ligne.designation || '',
                p_vente: Number(ligne.pVente) || 0,
                stock: Number(ligne.stock) || 0,
                min_alert_stock: Number(ligne.minAlertStock) || 0,
                image: ligne.image || null
              })
              .eq('id', articleId);
            if (error) throw error;
          }
        } else {
          // Nouvel article : réservé à l'administrateur.
          if (!isAdmin) continue;
          const { data: created, error } = await db
            .from('feuille_articles')
            .insert({
              boutique_id: boutiqueId,
              category: ligne.category,
              designation: ligne.designation || '',
              p_vente: Number(ligne.pVente) || 0,
              stock: Number(ligne.stock) || 0,
              min_alert_stock: Number(ligne.minAlertStock) || 0,
              image: ligne.image || null
            })
            .select()
            .single();
          if (error) throw error;
          articleId = created.id;
          postedExistingIds.add(articleId);
        }

        const countPatch = isAdmin
          ? {
              initial: ligne.initial === '' ? null : Number(ligne.initial),
              nouveau: Number(ligne.nouveau) || 0,
              reste: ligne.reste === '' ? null : Number(ligne.reste)
            }
          : {
              initial: ligne.initial === '' ? null : Number(ligne.initial),
              reste: ligne.reste === '' ? null : Number(ligne.reste)
            };

        const { error: upsertErr } = await db
          .from('feuille_counts')
          .upsert(
            { article_id: articleId, date, ...countPatch, updated_at: new Date().toISOString() },
            { onConflict: 'article_id,date' }
          );
        if (upsertErr) throw upsertErr;
      }

      // Articles retirés de la feuille par l'admin (non renvoyés dans la liste).
      if (isAdmin) {
        const toDelete = [...existingIds].filter((id) => !postedExistingIds.has(id));
        if (toDelete.length) {
          const { error } = await db.from('feuille_articles').delete().in('id', toDelete);
          if (error) throw error;
        }
      }

      const freshLignes = await buildLignes(db, boutiqueId, date);
      return res.status(200).json({ lignes: toCamel(freshLignes) });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Erreur serveur.' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Méthode non autorisée' });
}
