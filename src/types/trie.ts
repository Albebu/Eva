import type { Handler, RouteConfig } from './handler';
import type { EvaMiddleware } from './middleware';

// The whole schema bundle (schema + whitelist/forbid flags) must survive
// from route registration to request time, so the trie and match result
// carry `schemaOptions`, not just the bare schema. Indexed access keeps it
// in sync with RouteConfig automatically.
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
