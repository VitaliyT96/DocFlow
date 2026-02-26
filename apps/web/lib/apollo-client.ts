import { ApolloClient, InMemoryCache, split, HttpLink, Operation } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';

/**
 * Instantiates an Apollo Client specifically tailored for the browser.
 * It intelligently routes standard queries to HTTP and subscriptions to WebSockets.
 */
export function createApolloClient(token?: string) {
  const httpUri = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/graphql';
  const wsUri = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000/graphql';

  const httpLink = new HttpLink({
    uri: httpUri,
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });

  const wsLink = typeof window !== 'undefined'
    ? new GraphQLWsLink(
        createClient({
          url: wsUri,
          connectionParams: {
            Authorization: token ? `Bearer ${token}` : '',
          },
          retryAttempts: 5,
        })
      )
    : null;

  const splitLink = typeof window !== 'undefined' && wsLink != null
    ? split(
        ({ query }: Operation) => {
          const definition = getMainDefinition(query);
          return (
            definition.kind === 'OperationDefinition' &&
            definition.operation === 'subscription'
          );
        },
        wsLink, 
        httpLink 
      )
    : httpLink;

  return new ApolloClient({
    link: splitLink,
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            documents: {
              merge(existing: unknown, incoming: unknown) {
                return incoming;
              }
            }
          }
        }
      }
    }),
  });
}
