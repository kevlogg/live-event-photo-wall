import crypto from 'crypto';

/**
 * Generates a collision-resistant, URL-safe permanent token for a venue table
 */
export function generateTableToken(venueSlug: string, tableNumber: number): string {
  const randomBytes = crypto.randomBytes(16).toString('hex');
  const payload = `${venueSlug}-table-${tableNumber}-${randomBytes}`;
  return crypto.createHash('sha256').update(payload).digest('hex').substring(0, 32);
}

/**
 * Normalizes a scanned token
 */
export function sanitizeToken(rawToken: string): string {
  return rawToken.trim().toLowerCase().replace(/[^a-f0-9]/g, '');
}
