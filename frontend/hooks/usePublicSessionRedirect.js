'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { tokens } from '@/lib/api';

export function usePublicSessionRedirect({ redirect = true } = {}) {
  const router = useRouter();
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    const session = tokens();
    const authenticated = Boolean(session.access || session.refresh);
    setStatus(authenticated ? 'authenticated' : 'anonymous');
    if (authenticated && redirect) router.replace('/dashboard');
  }, [redirect, router]);

  return status;
}
