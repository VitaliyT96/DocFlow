import { cookies } from 'next/headers';

/**
 * Server-side GraphQL fetcher acting as the modern equivalent of getServerSideProps.
 * Ensures data is securely fetched on the server before rendering the UI.
 */
export async function fetchServerGraphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/graphql';
  
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store', // fresh data on every request
  });

  if (!res.ok) {
    if (res.status === 401) {
       throw new Error(`Unauthorized`);
    }
    throw new Error(`Integration Error: API Gateway returned status ${res.status}`);
  }

  const json = await res.json();
  if (json.errors && json.errors.length > 0) {
     if (json.errors[0].message === 'Unauthorized') {
       throw new Error(`Unauthorized`);
     }
     throw new Error(`GraphQL Error: ${json.errors[0].message}`);
  }
  
  return json.data;
}
