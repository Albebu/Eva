/**
 * Archivo de ejemplo de como utilizar el framework Eva
 */

import { Eva } from "./src/eva";
import { EvaNotFoundError } from "./src/errors";
import type { EvaMiddleware } from "./src/types";
import { cors } from "./src/cors";

const eva = new Eva();

eva.use(cors({origin: "*"}))

eva.use(async (ctx, next) => {
  console.log(
    `[${new Date().toISOString()}] ${ctx.path} ${JSON.stringify(ctx.query)}`,
  );
  await next();
});

eva.get("/", (ctx) => {
  return ctx.toJson({ data: { message: "Página principal desde json" } });
});

const authMiddleware: EvaMiddleware = async (ctx, next) => {
  console.log("🔒 Auth middleware ejecutándose para", ctx.path);
  await next();
};

eva.get<{ Params: { id: string } }>(
  "/api/:id",
  [authMiddleware],
  (ctx) => {
    if (ctx.params.id === "0") {
      throw new EvaNotFoundError("ID no puede ser 0");
    }
    return ctx.toJson({ data: { id: ctx.params.id } });
  },
);

eva
  .route("/v2")
  .get((ctx) => ctx.toJson({ message: "hola" }))
  .post(async (ctx) => {
    const data = await ctx.json();
    console.log("Body: ", data);
    return ctx.toJson({ recieved: data });
  });

eva.serve();