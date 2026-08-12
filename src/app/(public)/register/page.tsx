import type { Metadata } from 'next';

import { RegisterForm } from '@/features/auth/RegisterForm';

export const metadata: Metadata = { title: 'Daftar — Learning Study AI' };

export default function RegisterPage() {
  return <RegisterForm />;
}
