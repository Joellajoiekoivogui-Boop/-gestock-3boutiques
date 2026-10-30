#!/usr/bin/env node
// Création sécurisée du PREMIER administrateur.
//
//   npm run create-admin -- --email gerant@exemple.com --name "Prénom Nom"
//
// * Nécessite SUPABASE_SERVICE_ROLE_KEY : seul le propriétaire du projet
//   Supabase peut donc l'exécuter (aucune page publique de création d'admin).
// * Refuse de s'exécuter si un administrateur actif existe déjà : les comptes
//   suivants se créent depuis l'application (Administration → Utilisateurs).
// * Le mot de passe est demandé de façon masquée (jamais en argument, pour ne
//   pas finir dans l'historique du terminal). Variable ADMIN_PASSWORD acceptée
//   pour l'automatisation.
import { createInterface } from 'node:readline';
import { createClient } from '@supabase/supabase-js';

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : undefined;
}

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (text) => {
      if (text.startsWith(question)) rl.output.write(text);
      else rl.output.write('*');
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  fail('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies (fichier .env.local).');
}

const email = arg('email')?.trim().toLowerCase();
const fullName = arg('name')?.trim();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Indiquez une adresse e-mail valide : --email gerant@exemple.com');
if (!fullName || fullName.length < 2) fail('Indiquez le nom complet : --name "Prénom Nom"');

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const { count, error: countError } = await supabase
  .from('profiles')
  .select('id', { count: 'exact', head: true })
  .eq('role', 'admin')
  .eq('is_active', true);
if (countError) fail(`Base inaccessible : ${countError.message}. Les migrations ont-elles été appliquées ?`);
if ((count ?? 0) > 0) {
  fail('Un administrateur actif existe déjà. Créez les autres comptes depuis l’application (Utilisateurs).');
}

const password = process.env.ADMIN_PASSWORD ?? (await askHidden('Mot de passe (10 caractères min., lettres et chiffres) : '));
if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
  fail('Mot de passe trop faible : 10 caractères minimum, avec lettres et chiffres.');
}

let userId;
const { data: created, error: createError } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName },
});
if (createError) {
  if (createError.code !== 'email_exists' && !/already been registered/i.test(createError.message)) {
    fail(`Création du compte impossible : ${createError.message}`);
  }
  // Compte déjà créé (ex. depuis le tableau de bord Supabase) : on le promeut.
  const { data: existing } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
  if (!existing) fail('Ce compte existe dans Supabase Auth mais sans profil. Les migrations ont-elles été appliquées ?');
  userId = existing.id;
  const { error: pwError } = await supabase.auth.admin.updateUserById(userId, { password, ban_duration: 'none' });
  if (pwError) fail(`Mise à jour du mot de passe impossible : ${pwError.message}`);
} else {
  userId = created.user.id;
}

const { error: profileError } = await supabase
  .from('profiles')
  .update({ role: 'admin', is_active: true, full_name: fullName, permissions: [] })
  .eq('id', userId);
if (profileError) fail(`Activation du profil impossible : ${profileError.message}`);

console.log(`\n✔ Administrateur prêt : ${fullName} <${email}>`);
console.log('  Connectez-vous sur /login. Les autres comptes se créent depuis Administration → Utilisateurs.\n');
