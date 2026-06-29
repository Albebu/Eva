import type { Handler, EvaSchema } from './handler';
import type { EvaMiddleware } from './middleware';

export interface TrieNode {
  handler?: Handler;
  param?: {
    name: string;
    node: TrieNode;
  };
  wildcard?: TrieNode;
  children: Record<string, TrieNode>;
  middlewares?: EvaMiddleware[];
  schema?: EvaSchema;
}

export interface MatchResult {
  handler: Handler;
  params: Record<string, string>;
  middlewares: EvaMiddleware[];
  schema?: EvaSchema;
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
