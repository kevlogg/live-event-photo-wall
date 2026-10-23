'use server';

import { redirect } from 'next/navigation';
import { checkAdminPassword, setAdminSessionCookie, clearAdminSessionCookie } from '@/lib/auth';

export interface AuthActionResult {
  success: boolean;
  error?: string;
}

export async function loginAdminAction(password: string): Promise<AuthActionResult> {
  if (!password || typeof password !== 'string') {
    return { success: false, error: 'Por favor, ingresá una contraseña' };
  }

  const isValid = await checkAdminPassword(password.trim());
  if (!isValid) {
    return { success: false, error: 'Contraseña incorrecta. Verificá la clave de acceso.' };
  }

  await setAdminSessionCookie();
  return { success: true };
}

export async function logoutAdminAction(): Promise<void> {
  await clearAdminSessionCookie();
  redirect('/admin/login');
}
