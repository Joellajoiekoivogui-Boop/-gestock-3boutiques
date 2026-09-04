import { getUsers, checkPassword, hashPassword, sign, readBody } from './_lib.js';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret || !process.env.AUTH_USERS) {
    return res.status(500).json({ error: "L'authentification n'est pas configurée sur le serveur." });
  }

  const { email, password } = readBody(req);
  const cleanEmail = String(email || '').trim().toLowerCase();
  const users = getUsers();
  const user = users.find((u) => String(u.email).toLowerCase() === cleanEmail);

  // Vérifie toujours un hash (même si l'utilisateur n'existe pas) pour limiter
  // la distinction par temps de réponse.
  const decoyHash = hashPassword('decoy', '00000000000000000000000000000000');
  const ok = user
    ? checkPassword(String(password || ''), user.pw)
    : checkPassword(String(password || ''), decoyHash) && false;

  if (!user || !ok) {
    return res.status(401).json({ error: 'E-mail ou mot de passe incorrect.' });
  }

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role === 'admin' ? 'admin' : 'gerant',
    boutiqueId: user.boutiqueId
  };
  const token = sign({ sub: user.id, ...safeUser }, secret);
  return res.status(200).json({ token, user: safeUser });
}
