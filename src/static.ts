import { resolve, sep } from 'path';
import { Handler } from './types/handler';

export function serveStatic(root: string): Handler {
  const rootDir = resolve(root);

  return async (ctx) => {
    let rel = ctx.params['*'] ?? '';
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';

    const target = resolve(rootDir, rel);

    // Que target no se salga de rootDir (path traversal).
    if (target !== rootDir && !target.startsWith(rootDir + sep)) {
      return ctx.notFound();
    }

    // Nada de dotfiles.
    if (target.split(sep).some((p) => p.startsWith('.'))) {
      return ctx.notFound();
    }

    const file = Bun.file(target);
    if (!(await file.exists())) return ctx.notFound();

    return new Response(file);
  };
}
