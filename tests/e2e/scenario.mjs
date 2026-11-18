// Scénario de bout en bout dans un vrai navigateur (Playwright/Chromium).
// Lancé par tests/e2e/run.mjs : application Next.js + émulateur Supabase +
// PostgreSQL avec les migrations. Les captures d'écran sont écrites dans
// E2E_SCREENSHOTS (par défaut ./e2e-screenshots).
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3100';
const SHOTS = process.env.E2E_SCREENSHOTS ?? 'e2e-screenshots';
mkdirSync(SHOTS, { recursive: true });

const ADMIN = { email: 'admin@massagui.test', password: process.env.ADMIN_PASSWORD ?? 'Admin12345678' };
const CASHIER = { name: 'Awa Camara', email: 'awa@massagui.test', password: 'Caisse123456' };
// PNG 1×1 vert, pour tester le téléversement d'image.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const steps = [];
async function step(name, fn) {
  process.stdout.write(`• ${name} … `);
  await fn();
  steps.push(name);
  process.stdout.write('ok\n');
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR', acceptDownloads: true });
const page = await context.newPage();
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(e.message));
const shot = (name) => page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true });

async function login(email, password) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}
async function logout() {
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await page.waitForURL('**/login');
}
const dialog = () => page.getByRole('dialog');
const toast = (text) => page.locator('[data-sonner-toast]').filter({ hasText: text }).first();

try {
  await step('page de connexion et erreur d’identifiants', async () => {
    await login(ADMIN.email, 'mauvais-mot-de-passe1');
    await page.getByText('E-mail ou mot de passe incorrect.').waitFor();
    await shot('01-login-erreur');
  });

  await step('connexion administrateur → tableau de bord vide', async () => {
    await login(ADMIN.email, ADMIN.password);
    await page.waitForURL('**/admin/dashboard');
    await page.getByText('Encaissé aujourd’hui').waitFor();
    await page.getByText('Aucune vente sur cette période.').waitFor();
    await shot('02-dashboard-vide');
  });

  // L'administrateur choisit la boutique affichée en haut de l'écran.
  const chooseShop = async (name) => {
    const button = page.getByRole('group', { name: 'Boutique affichée' }).getByRole('button', { name, exact: true });
    await button.click();
    await page.waitForFunction(
      (label) =>
        [...document.querySelectorAll('[aria-label="Boutique affichée"] button')].some(
          (b) => b.textContent.trim() === label && b.getAttribute('aria-pressed') === 'true',
        ),
      name,
    );
  };

  await step('création de produits (dont stock suivi et photo)', async () => {
    await page.goto(`${BASE}/admin/products`);
    await chooseShop('Nabele Plus 1');
    await page.getByText('Aucun produit').waitFor();

    await page.getByRole('button', { name: 'Nouveau produit' }).click();
    await dialog().getByLabel('Nom', { exact: true }).fill('Riz au poulet');
    await dialog().getByLabel('Catégorie', { exact: true }).selectOption({ label: 'Plats africains' });
    await dialog().getByLabel('Prix (GNF)', { exact: true }).fill('25000');
    await dialog().locator('#product-image').setInputFiles({ name: 'riz.png', mimeType: 'image/png', buffer: PNG });
    await dialog().getByRole('button', { name: 'Enregistrer' }).click();
    await toast('Produit créé.').waitFor();

    await page.getByRole('button', { name: 'Nouveau produit' }).click();
    await dialog().getByLabel('Nom', { exact: true }).fill('Jus naturel');
    await dialog().getByLabel('Catégorie', { exact: true }).selectOption({ label: 'Boissons' });
    await dialog().getByLabel('Prix (GNF)', { exact: true }).fill('10000');
    await dialog().getByRole('switch', { name: /Suivre le stock/ }).click();
    await dialog().getByLabel('Seuil d’alerte (stock minimum)', { exact: true }).fill('1');
    await dialog().getByLabel('Stock initial', { exact: true }).fill('2');
    await dialog().getByRole('button', { name: 'Enregistrer' }).click();
    await toast('Produit créé.').waitFor();

    await page.getByRole('heading', { name: 'Jus naturel', exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Riz au poulet', exact: true }).waitFor();
    await shot('03-produits');
  });

  await step('validation : prix invalide refusé', async () => {
    await page.getByRole('button', { name: 'Nouveau produit' }).click();
    await dialog().getByLabel('Nom', { exact: true }).fill('Test');
    await dialog().getByLabel('Prix (GNF)', { exact: true }).fill('99.5');
    await dialog().getByRole('button', { name: 'Enregistrer' }).click();
    await page.getByText(/nombre entier attendu/).waitFor();
    await page.getByRole('button', { name: 'Annuler' }).click();
  });

  await step('création d’un compte caissier', async () => {
    await page.goto(`${BASE}/admin/users`);
    await page.getByRole('button', { name: 'Nouvel utilisateur' }).click();
    await dialog().getByLabel('Nom complet', { exact: true }).fill(CASHIER.name);
    await dialog().getByLabel('E-mail', { exact: true }).fill(CASHIER.email);
    await dialog().getByLabel('Mot de passe provisoire', { exact: true }).fill(CASHIER.password);
    // Un caissier est rattaché à une boutique : obligatoire.
    await page.getByRole('button', { name: 'Créer le compte' }).click();
    await dialog().getByText('Choisissez la boutique de ce caissier.').waitFor();
    await dialog().getByLabel('Boutique', { exact: true }).selectOption({ label: 'Nabele Plus 1' });
    await page.getByRole('button', { name: 'Créer le compte' }).click();
    await toast('Compte créé').waitFor();
    await page.getByRole('heading', { name: CASHIER.name }).waitFor();
    await page.getByText(CASHIER.email, { exact: true }).waitFor();
    await page.getByRole('article').filter({ hasText: CASHIER.email }).getByText('Nabele Plus 1').waitFor();
    await shot('04-utilisateurs');
    await logout();
  });

  await step('caissier : redirigé vers la caisse, administration interdite', async () => {
    await login(CASHIER.email, CASHIER.password);
    await page.waitForURL('**/pos');
    await page.goto(`${BASE}/admin/dashboard`);
    await page.waitForURL('**/pos');
    await page.goto(`${BASE}/admin/users`);
    await page.waitForURL('**/pos');
    assert.equal(await page.getByRole('link', { name: 'Utilisateurs' }).count(), 0);
    // Stocks et impression des journées : réservés à l'administrateur.
    await page.goto(`${BASE}/admin/inventory`);
    await page.waitForURL('**/pos');
    await page.goto(`${BASE}/admin/sales/journee`);
    await page.waitForURL('**/pos');
    assert.equal(await page.getByRole('link', { name: 'Stocks' }).count(), 0);
  });

  let receiptNumber = '';
  await step('vente : 2 × Riz au poulet + 1 × Jus naturel = 60 000 GNF, Orange Money', async () => {
    await page.getByRole('button', { name: /Ajouter Riz au poulet/ }).click();
    await page.getByRole('button', { name: /Ajouter Riz au poulet/ }).click();
    await page.getByRole('button', { name: /Ajouter Jus naturel/ }).click();
    const cart = page.getByRole('complementary', { name: 'Panier' });
    await cart.getByText('60\u00a0000\u00a0GNF').first().waitFor();
    await cart.getByRole('button', { name: 'Orange Money' }).click();
    await shot('05-caisse-panier');
    // Le bouton annonce le montant encaissé. Double clic : une seule vente doit être créée.
    const checkout = cart.getByRole('button', { name: /Encaisser/ });
    await checkout.getByText('60\u00a0000\u00a0GNF').waitFor();
    await checkout.dblclick();
    const success = page.getByRole('dialog', { name: 'Vente enregistrée' });
    await success.waitFor();
    receiptNumber = (await success.locator('strong').first().textContent())?.trim() ?? '';
    assert.match(receiptNumber, /^MG-\d{4}-000001$/);
    await shot('06-vente-enregistree');
  });

  await step('reçu : contenu, formats 80 mm / 58 mm / A4, PDF', async () => {
    await page.getByRole('link', { name: 'Voir le reçu' }).click();
    await page.waitForURL('**/receipts/**');
    const receipt = page.locator('#receipt');
    await receipt.getByText(receiptNumber).waitFor();
    for (const text of ['MASSAGUI FILS SARL.U', 'Riz au poulet', '2 x 25\u00a0000', '50\u00a0000', 'Jus naturel', 'Orange Money', 'Payé', 'Awa Camara', 'Nabele Plus 1', 'Merci de votre visite !']) {
      await receipt.getByText(text, { exact: false }).first().waitFor();
    }
    await receipt.getByText('60\u00a0000\u00a0GNF').first().waitFor();
    await shot('07-recu-80mm');
    // Aperçu d'impression : seul le reçu reste visible.
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.getByRole('navigation', { name: 'Navigation principale' }).isVisible(), false);
    assert.equal(await page.getByRole('button', { name: 'Imprimer' }).isVisible(), false);
    await page.screenshot({ path: join(SHOTS, '07b-recu-impression.png') });
    await page.emulateMedia({ media: 'screen' });
    await page.getByRole('combobox', { name: 'Format du reçu' }).click();
    await page.getByRole('option', { name: 'Ticket 58 mm' }).click();
    await page.waitForURL('**format=58mm**');
    await shot('08-recu-58mm');
    await page.getByRole('combobox', { name: 'Format du reçu' }).click();
    await page.getByRole('option', { name: 'Page A4' }).click();
    await page.waitForURL('**format=a4**');
    await receipt.getByRole('columnheader', { name: 'Désignation' }).waitFor();
    await shot('09-recu-a4');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PDF' }).click()]);
    assert.equal(download.suggestedFilename(), `recu-${receiptNumber}.pdf`);
  });

  await step('stock : impossible de vendre plus que le stock restant (1 jus)', async () => {
    await page.goto(`${BASE}/pos`);
    await page.getByRole('button', { name: /Ajouter Jus naturel/ }).click();
    await page.getByRole('button', { name: /Ajouter Jus naturel/ }).click();
    await toast('Stock insuffisant').waitFor();
    await page.getByRole('button', { name: 'Vider' }).click();
  });

  await step('mes ventes : une seule vente (pas de doublon)', async () => {
    await page.goto(`${BASE}/pos/sales`);
    await page.getByRole('link', { name: receiptNumber }).first().waitFor();
    assert.equal(await page.getByRole('link', { name: /^MG-/ }).count(), 1);
    assert.equal(await page.getByRole('button', { name: 'Annuler la vente' }).count(), 0);
    await shot('10-mes-ventes');
  });

  await step('dépenses : le caissier note un achat de condiments, retiré de l’argent du jour', async () => {
    await page.goto(`${BASE}/pos/sales`);
    await page.getByTestId('day-value').getByText('60\u00a0000\u00a0GNF').waitFor();
    await page.getByRole('button', { name: 'Ajouter la dépense' }).click();
    await page.getByText('Indiquez ce qui a été acheté.').waitFor();
    await page.getByLabel('Ce qui a été acheté').fill('Piment et oignons');
    await page.getByLabel('Prix (GNF)').fill('5000');
    await page.getByRole('button', { name: 'Ajouter la dépense' }).click();
    await toast('Dépense notée').waitFor();
    await page.getByTestId('day-value').getByText('55\u00a0000\u00a0GNF').waitFor();
    await page.getByRole('region', { name: 'Dépenses du jour' }).getByText('Piment et oignons').waitFor();
    // Seul l'administrateur peut supprimer une dépense.
    assert.equal(await page.getByRole('button', { name: /Supprimer la dépense/ }).count(), 0);
    await shot('10b-depenses');
  });

  await step('responsive : caisse sur téléphone et tablette', async () => {
    for (const [name, width, height] of [['11-caisse-telephone', 390, 844], ['12-caisse-tablette', 820, 1180]]) {
      await page.setViewportSize({ width, height });
      await page.goto(`${BASE}/pos`);
      await page.getByRole('button', { name: /Ajouter Riz au poulet/ }).click();
      await page.getByRole('button', { name: /Panier \(1\)/ }).waitFor();
      await shot(name);
      await page.getByRole('button', { name: /Panier \(1\)/ }).click();
      await page.getByRole('dialog').getByRole('button', { name: /Encaisser/ }).waitFor();
      await page.waitForTimeout(400); // fin de l'animation du tiroir
      await shot(`${name}-panier`);
      await page.keyboard.press('Escape');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 1, `${name} : défilement horizontal de ${overflow}px`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await logout();
  });

  await step('boutiques : Nabele Plus 2 a ses propres produits, la caisse admin demande la boutique', async () => {
    await login(ADMIN.email, ADMIN.password);
    await page.waitForURL('**/admin/dashboard');
    await page.goto(`${BASE}/admin/products`);
    await chooseShop('Nabele Plus 2');
    await page.getByText('Aucun produit').waitFor();
    await page.goto(`${BASE}/admin/dashboard`);
    await page.getByTestId('day-value').getByText('0\u00a0GNF', { exact: true }).waitFor();
    await shot('12b-boutique-2');
    // « Toutes les boutiques » : la caisse demande dans quelle boutique encaisser.
    await chooseShop('Toutes les boutiques');
    await page.goto(`${BASE}/pos`);
    await page.getByRole('heading', { name: 'Dans quelle boutique encaissez-vous ?' }).waitFor();
    await shot('12c-choix-boutique');
    await page.getByRole('button', { name: 'Nabele Plus 1', exact: true }).last().click();
    await page.getByRole('button', { name: /Ajouter Riz au poulet/ }).waitFor();
    await page.goto(`${BASE}/admin/dashboard`);
    await logout();
  });

  await step('admin : tableau de bord à jour avec la vente réelle', async () => {
    await login(ADMIN.email, ADMIN.password);
    await page.waitForURL('**/admin/dashboard');
    // La dépense du caissier est déduite ; l'admin la supprime (erreur de saisie).
    await page.getByTestId('day-value').getByText('55\u00a0000\u00a0GNF').waitFor();
    await page.getByRole('button', { name: 'Supprimer la dépense Piment et oignons' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Supprimer' }).click();
    await toast('Dépense supprimée.').waitFor();
    await page.getByTestId('day-value').getByText('60\u00a0000\u00a0GNF').waitFor();
    await page.getByText('Orange Money').first().waitFor();
    await shot('13-dashboard-avec-vente');
  });

  await step('historique, export CSV et annulation tracée', async () => {
    await page.goto(`${BASE}/admin/sales`);
    await page.getByRole('link', { name: receiptNumber }).first().click();
    await page.waitForURL('**/admin/sales/**');
    const csv = await page.request.get(`${BASE}/admin/sales/export`);
    assert.equal(csv.status(), 200);
    assert.match(await csv.text(), new RegExp(receiptNumber));

    await page.getByRole('button', { name: 'Annuler la vente' }).click();
    await page.getByRole('button', { name: 'Confirmer l’annulation' }).click();
    await page.getByText(/Le motif : 3 caractères minimum|Trop petit/).first().waitFor();
    await dialog().getByLabel('Motif de l’annulation', { exact: true }).fill('Erreur de saisie du caissier');
    await page.getByRole('button', { name: 'Confirmer l’annulation' }).click();
    await toast('annulée').waitFor();
    await page.getByText('Vente annulée').first().waitFor();
    await shot('14-vente-annulee');
  });

  await step('CA recalculé : la vente annulée n’est plus un revenu', async () => {
    await page.goto(`${BASE}/admin/dashboard`);
    await page.getByTestId('day-value').getByText('0\u00a0GNF', { exact: true }).waitFor();
    await page.goto(`${BASE}/admin/reports?period=today`);
    await page.getByText('Ventes annulées (exclues du CA)').waitFor();
    await shot('15-rapports');
    const csv = await page.request.get(`${BASE}/admin/reports/export?period=today`);
    assert.equal(csv.status(), 200);
  });

  await step('stocks : stock réintégré après annulation, mouvements tracés', async () => {
    await page.goto(`${BASE}/admin/inventory`);
    const row = page.getByRole('row').filter({ hasText: 'Jus naturel' }).first();
    await row.getByRole('cell', { name: '2', exact: true }).first().waitFor();
    await page.getByText('Annulation de vente').first().waitFor();
    await shot('16-stocks');
  });

  await step('journal d’activité', async () => {
    await page.goto(`${BASE}/admin/audit`);
    await page.getByText('Vente annulée').first().waitFor();
    await page.getByText('Compte créé').first().waitFor();
    await shot('17-journal');
  });

  await step('paramètres : adresse et téléphone affichés sur le reçu', async () => {
    await page.goto(`${BASE}/admin/settings`);
    await page.getByLabel('Adresse').fill('Kaloum, Conakry');
    await page.getByLabel('Téléphone').fill('+224 600 00 00 00');
    await page.getByRole('button', { name: 'Enregistrer les paramètres' }).click();
    await toast('Paramètres enregistrés.').waitFor();
    await shot('18-parametres');
  });

  await step('crédit : vente à crédit au nom du client, puis encaissement', async () => {
    await page.goto(`${BASE}/pos`);
    await page.getByRole('button', { name: /Ajouter Riz au poulet/ }).click();
    const cart = page.getByRole('complementary', { name: 'Panier' });
    await cart.getByRole('button', { name: 'Crédit' }).click();
    const save = cart.getByRole('button', { name: /Mettre à crédit/ });
    assert.equal(await save.isDisabled(), true, 'le nom du client doit être obligatoire');
    await cart.getByLabel('Nom du client').fill('Mamadou Bah');
    await cart.getByLabel('Téléphone du client').fill('+224 622 00 00 00');
    await save.click();
    await page.getByRole('dialog', { name: 'Vente enregistrée' }).waitFor();
    await page.keyboard.press('Escape');
    // Le crédit compte dans les ventes du jour mais pas dans l'argent encaissé.
    await page.goto(`${BASE}/admin/dashboard`);
    await page.getByTestId('day-value').getByText('0\u00a0GNF', { exact: true }).waitFor();
    await page.getByText('À crédit aujourd’hui').waitFor();
    // Un dossier a été ouvert pour le client.
    await page.goto(`${BASE}/credits`);
    await page.getByText('+224 622 00 00 00').waitFor();
    await shot('19-credits');
    await page.getByRole('link', { name: /Mamadou Bah/ }).click();
    await page.waitForURL(/\/credits\/[0-9a-f-]+$/);
    await page.getByRole('heading', { name: 'Mamadou Bah' }).waitFor();
    await page.getByText('Doit encore').waitFor();
    await shot('20-dossier-client');
    await page.getByRole('button', { name: 'Encaisser' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Espèces' }).click();
    await page.getByRole('button', { name: 'Confirmer le paiement' }).click();
    await toast('Crédit de Mamadou Bah encaissé.').waitFor();
    await page.getByText('Tout est réglé').waitFor();
    // Une fois réglé, le crédit devient de l'argent encaissé.
    await page.goto(`${BASE}/admin/dashboard`);
    await page.getByTestId('day-value').getByText('0\u00a0GNF', { exact: true }).waitFor({ state: 'detached' });
  });

  await step('journée passée : choisir une date pour revoir ses ventes', async () => {
    await page.goto(`${BASE}/admin/dashboard`);
    const today = await page.getByTestId('day-value').textContent();
    assert.notEqual(today?.trim(), '0\u00a0GNF', 'aujourd’hui doit avoir des ventes');
    await page.getByRole('link', { name: 'Jour précédent' }).click();
    await page.waitForURL('**jour=**');
    await page.getByText('Encaissé ce jour-là').waitFor();
    await page.getByTestId('day-value').getByText('0\u00a0GNF', { exact: true }).waitFor();
    await shot('21-jour-precedent');
    // Date précise saisie dans le calendrier.
    await page.getByLabel('Choisir une date').fill('2026-01-15');
    await page.waitForURL('**jour=2026-01-15**');
    await page.getByRole('heading', { name: /15 janvier 2026/ }).first().waitFor();
    await page.getByRole('link', { name: 'Revenir à aujourd’hui' }).click();
    await page.getByText('Encaissé aujourd’hui').waitFor();
    // Même chose dans « Mes ventes ».
    await page.goto(`${BASE}/pos/sales?jour=2026-01-15`);
    await page.getByText('Encaissé ce jour-là').waitFor();
    await page.getByRole('heading', { name: /15 janvier 2026/ }).first().waitFor();
  });

  await step('impression : l’administrateur imprime les ventes d’une journée', async () => {
    await page.goto(`${BASE}/admin/dashboard`);
    await page.getByRole('link', { name: 'Imprimer les ventes' }).click();
    await page.waitForURL('**/admin/sales/journee?jour=**');
    const sheet = page.locator('#day-sheet');
    await sheet.getByRole('heading', { name: /^Ventes du / }).waitFor();
    await sheet.getByText('Nabele Plus 1').first().waitFor();
    await sheet.getByText('Liste des ventes').waitFor();
    await sheet.getByText('Riz au poulet').first().waitFor();
    await page.getByRole('button', { name: 'Imprimer les ventes' }).waitFor();
    await shot('22-impression-journee');
    // En impression, seule la feuille reste visible.
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.getByRole('navigation', { name: 'Navigation principale' }).isVisible(), false);
    assert.equal(await page.getByRole('button', { name: 'Imprimer les ventes' }).isVisible(), false);
    await page.screenshot({ path: join(SHOTS, '22b-impression-apercu.png'), fullPage: true });
    await page.emulateMedia({ media: 'screen' });
    // Une autre date : feuille vide mais imprimable.
    await page.goto(`${BASE}/admin/sales/journee?jour=2026-01-15`);
    await sheet.getByText('Aucune vente ce jour-là.').waitFor();
  });

  assert.deepEqual(consoleErrors, [], `Erreurs JavaScript : ${consoleErrors.join(' | ')}`);
  console.log(`\n✔ ${steps.length} étapes réussies. Captures : ${SHOTS}`);
} catch (error) {
  await shot('zz-echec').catch(() => {});
  console.error(`\n✖ Échec : ${error.message}\n  URL : ${page.url()}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
