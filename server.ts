/**
 * Archivo de ejemplo para mostrar como funciona EVA, lo uso también para testear que
 * el framework funciona correctamente en las fases tempranas de desarrollo.
 */

import { Eva } from './src/eva';

const users = new Eva();

users.get('/users', (ctx) => {
  return ctx.toJson({ data: ['alice', 'bob', 'carol'] });
});

users.get('/users/:id', (ctx) => {
  return ctx.toJson({ data: { id: ctx.params.id, name: 'user' } });
});

users.post('/users', async (ctx) => {
  const body = await ctx.json();
  console.log(`POST body:`, body);
  return ctx.toJson({ created: body }, { status: 201 });
});

const products = new Eva();

products.get('/products', (ctx) => {
  return ctx.toJson({ data: ['widget', 'gadget'] });
});

products.get('/products/:id', (ctx) => {
  return ctx.toJson({ data: { id: ctx.params.id, name: 'product' } });
});

const app = new Eva();

app.use((ctx, next) => {
  console.log(`[${new Date().toISOString()}] ${ctx.req.method} ${ctx.path}`);
  return next();
});

users.toParent(app, '/api/v1');

products.toParent(app, '/api/v2');

app.get('/', (ctx) => {
  return ctx.toJson({ message: 'Eva funcionando' });
});

app.serve(undefined, () => {
  console.log('Server is running on port 9999');
});
