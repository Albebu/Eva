import { resolve, sep } from 'path';
import { Handler } from './types/handler';

export function serveStatic(root: string): Handler {
  const rootDir = resolve(root);

  return async (ctx) => {
    let rel = ctx.params['*'] ?? '';
    if (rel === '' || rel.endsWith('/')) rel += 'index.html'; // dir -> index

    const target = resolve(rootDir, rel);

    // Validation that target is within rootDir
    if (target !== rootDir && !target.startsWith(rootDir + sep)) {
      return ctx.notFound();
    }

    // Deny dotfiles
    if (target.split(sep).some((p) => p.startsWith('.'))) {
      return ctx.notFound();
    }

    const file = Bun.file(target);
    if (!(await file.exists())) return ctx.notFound();

    return new Response(file);
  };
}
