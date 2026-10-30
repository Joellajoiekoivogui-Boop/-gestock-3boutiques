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
    await page.getByText('CA net du jour').waitFor();
    await page.getByText('Aucune vente sur cette période.').waitFor();
    await shot('02-dashboard-vide');
  });

  await step('création de produits (dont stock suivi et photo)', async () => {
    await page.goto(`${BASE}/admin/products`);
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

    await page.getByRole('cell', { name: 'Jus naturel', exact: true }).waitFor();
    await page.getByRole('cell', { name: 'Riz au poulet', exact: true }).waitFor();
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
    await page.getByRole('button', { name: 'Créer le compte' }).click();
    await toast('Compte créé').waitFor();
    await page.getByRole('cell', { name: new RegExp(`${CASHIER.name} ${CASHIER.email}`) }).waitFor();
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
    await cart.getByRole('button', { name: 'Valider la vente' }).click();
    const dialog = page.getByRole('dialog', { name: 'Confirmer la vente' });
    await dialog.getByText('60\u00a0000\u00a0GNF').last().waitFor();
    // Double clic : une seule vente doit être créée.
    await dialog.getByRole('button', { name: 'Valider la vente' }).dblclick();
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
    for (const text of ['MASSAGUI FILS SARL.U', 'Riz au poulet', '2 x 25\u00a0000', '50\u00a0000', 'Jus naturel', 'Orange Money', 'Payé', 'Awa Camara', 'Merci de votre visite !']) {
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

  await step('responsive : caisse sur téléphone et tablette', async () => {
    for (const [name, width, height] of [['11-caisse-telephone', 390, 844], ['12-caisse-tablette', 820, 1180]]) {
      await page.setViewportSize({ width, height });
      await page.goto(`${BASE}/pos`);
      await page.getByRole('button', { name: /Ajouter Riz au poulet/ }).click();
      await page.getByRole('button', { name: /Panier \(1\)/ }).waitFor();
      await shot(name);
      await page.getByRole('button', { name: /Panier \(1\)/ }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Valider la vente' }).waitFor();
      await page.waitForTimeout(400); // fin de l'animation du tiroir
      await shot(`${name}-panier`);
      await page.keyboard.press('Escape');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 1, `${name} : défilement horizontal de ${overflow}px`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await logout();
  });

  await step('admin : tableau de bord à jour avec la vente réelle', async () => {
    await login(ADMIN.email, ADMIN.password);
    await page.waitForURL('**/admin/dashboard');
    const card = page.locator('[data-slot=card]').filter({ hasText: 'CA net du jour' }).first();
    await card.getByText('60\u00a0000\u00a0GNF').waitFor();
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
    const card = page.locator('[data-slot=card]').filter({ hasText: 'CA net du jour' }).first();
    await card.getByText('0\u00a0GNF', { exact: true }).waitFor();
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

  assert.deepEqual(consoleErrors, [], `Erreurs JavaScript : ${consoleErrors.join(' | ')}`);
  console.log(`\n✔ ${steps.length} étapes réussies. Captures : ${SHOTS}`);
} catch (error) {
  await shot('zz-echec').catch(() => {});
  console.error(`\n✖ Échec : ${error.message}\n  URL : ${page.url()}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
