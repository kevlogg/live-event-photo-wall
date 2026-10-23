import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = 'admin_session';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'super-secret-admin-session-salt-2026';

// Helper to calculate HMAC-SHA256 signature in Web Crypto (Edge + Node compatible)
async function signMessage(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createAdminSessionToken(): Promise<string> {
  const timestamp = Date.now().toString();
  const signature = await signMessage(timestamp, SESSION_SECRET);
  return `${timestamp}.${signature}`;
}

export async function verifyAdminSessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [timestamp, signature] = parts;
  const time = parseInt(timestamp, 10);
  if (isNaN(time)) return false;

  // Session valid for 7 days
  const maxAge = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - time > maxAge) return false;

  const expectedSignature = await signMessage(timestamp, SESSION_SECRET);
  return signature === expectedSignature;
}

export async function checkAdminPassword(input: string): Promise<boolean> {
  return input === DEFAULT_ADMIN_PASSWORD;
}

export async function getAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifyAdminSessionToken(token);
}

export async function setAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  const token = await createAdminSessionToken();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export { SESSION_COOKIE_NAME };
