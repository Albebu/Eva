import type { Handler } from './handler';
import type { EvaMiddleware } from './middleware';

export interface TrieNode {
  handler?: Handler;
  param?: {
    name: string;
    node: TrieNode;
  };
  children: Record<string, TrieNode>;
  middlewares?: EvaMiddleware[];
}

export interface MatchResult {
  handler: Handler;
  params: Record<string, string>;
  middlewares: EvaMiddleware[];
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
