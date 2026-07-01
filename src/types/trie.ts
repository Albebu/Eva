import type { Handler, RouteConfig } from './handler';
import type { EvaMiddleware } from './middleware';

// El bundle de schema (schema + flags) tiene que sobrevivir del registro
// hasta la request, por eso el trie lleva schemaOptions entero. El acceso
// indexado lo mantiene sincronizado con RouteConfig solo.
type SchemaOptions = RouteConfig['schemaOptions'];

export interface TrieNode {
  handler?: Handler;
  param?: {
    name: string;
    node: TrieNode;
  };
  wildcard?: TrieNode;
  children: Record<string, TrieNode>;
  middlewares?: EvaMiddleware[];
  schemaOptions?: SchemaOptions;
}

export interface MatchResult {
  handler: Handler;
  params: Record<string, string>;
  middlewares: EvaMiddleware[];
  schemaOptions?: SchemaOptions;
}

export const METHOD = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
  OPTIONS: 'OPTIONS',
  HEAD: 'HEAD',
} as const;

export type Method = keyof typeof METHOD;
