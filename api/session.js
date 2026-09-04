import { verify } from './_lib.js';

export default function handler(req, res) {
  const secret = process.env.AUTH_SECRET;
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  const payload = token && secret ? verify(token, secret) : null;
  if (!payload) {
    return res.status(401).json({ error: 'Session invalide ou expirée.' });
  }

  return res.status(200).json({
    user: {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role === 'admin' ? 'admin' : 'gerant',
      boutiqueId: payload.boutiqueId
    }
  });
}
