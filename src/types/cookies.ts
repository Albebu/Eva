export interface Cookie {
  name: string;
  value: string;
  options?: CookieOptions;
}

interface CookieOptions {
  expires?: Date;
  path?: string;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
}
