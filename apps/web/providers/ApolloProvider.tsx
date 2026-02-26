'use client';

import { ApolloProvider } from '@apollo/client';
import { createApolloClient } from '../lib/apollo-client';
import { useMemo } from 'react';
import Cookies from 'js-cookie';

export function ApolloAppProvider({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => {
    const token = typeof window !== 'undefined' ? Cookies.get('token') : undefined;
    return createApolloClient(token);
  }, []);

  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
