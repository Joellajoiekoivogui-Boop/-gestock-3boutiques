// Utilitaires d'authentification côté serveur (fonctions Vercel).
// Aucune dépendance : uniquement le module crypto de Node.
import crypto from 'node:crypto';

const b64url = (buf) => Buffer.from(buf).toString('base64url');

// --- Jeton de session : JSON signé HMAC-SHA256 (mini-JWT) ---
const TOKEN_TTL_SECONDS = 12 * 3600; // 12 h

export function sign(payload, secret) {
  const body = b64url(
    JSON.stringify({ ...payload, iat: nowSec(), exp: nowSec() + TOKEN_TTL_SECONDS })
  );
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verify(token, secret) {
  try {
    const [body, sig] = String(token).split('.');
    if (!body || !sig) return null;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof payload.exp !== 'number' || payload.exp < nowSec()) return null;
    return payload;
  } catch {
    return null;
  }
}

// --- Mots de passe : scrypt + sel, stockés "<selHex>:<hashHex>" ---
export function hashPassword(password, saltHex) {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 32);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function checkPassword(password, stored) {
  try {
    const [saltHex, hashHex] = String(stored).split(':');
    if (!saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, 'hex');
    const got = crypto.scryptSync(String(password), Buffer.from(saltHex, 'hex'), expected.length);
    return got.length === expected.length && crypto.timingSafeEqual(got, expected);
  } catch {
    return false;
  }
}

export function getUsers() {
  try {
    const arr = JSON.parse(process.env.AUTH_USERS || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}
