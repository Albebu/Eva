export const t = {
  string: () => ({ kind: 'string' }) as unknown as TString,
  number: () => ({ kind: 'number' }) as unknown as TNumber,
  boolean: () => ({ kind: 'boolean' }) as unknown as TBoolean,
  object: <P>(props: P) => ({ kind: 'object', props }) as unknown as TObject<P>,
  array: <I>(item: I) => ({ kind: 'array', item }) as unknown as TArray<I>,
  optional: <T>(inner: T) =>
    ({ kind: 'optional', inner }) as unknown as TOptional<T>,
};

export type SchemaNode =
  | { kind: 'string' }
  | { kind: 'number' }
  | { kind: 'boolean' }
  | { kind: 'object'; props: Record<string, SchemaNode> }
  | { kind: 'array'; item: SchemaNode }
  | { kind: 'optional'; inner: SchemaNode };

type TString = { kind: 'string'; _type: string };
type TNumber = { kind: 'number'; _type: number };
type TBoolean = { kind: 'boolean'; _type: boolean };
type TObject<P> = {
  kind: 'object';
  props: P;
  _type: { [K in keyof P]: Static<P[K]> };
};
type TArray<I> = {
  kind: 'array';
  item: I;
  _type: Static<I>[];
};
type TOptional<T> = {
  kind: 'optional';
  inner: T;
  _type: Static<T> | undefined;
};

export type Static<T> = T extends { _type: infer U } ? U : never;

interface SchemaOptions {
  whitelist?: boolean;
  forbidden?: boolean;
}

export function validateSchema(
  schema: SchemaNode,
  data: any,
  options: SchemaOptions,
): boolean {
  switch (schema.kind) {
    case 'string':
      return typeof data === 'string';
    case 'number':
      return typeof data === 'number';
    case 'boolean':
      return typeof data === 'boolean';
    case 'object': {
      // Comparación básica de primer nivel
      if (typeof data !== 'object' || data === null) return false;

      // Comparación de las claves del esquema
      for (const key in schema.props) {
        const child = schema.props[key];
        // Existe la key en el objeto que nos llega?
        if (!(key in data)) {
          // Si es opcional entonces nos da igual
          if (child.kind === 'optional') continue;
          // Si no es opcional no concuerda con el esquema
          return false;
        }

        // Recursividad para comparar el siguiente nivel de depth de la clave del objeto por si son objetos anidados.
        if (!validateSchema(child, data[key], options)) return false;
      }

      // El resto de claves del data que no conocemos del esquema
      for (const key in data) {
        if (key in schema.props) continue;
        if (options.forbidden) return false;
        if (options.whitelist) delete data[key];
      }

      return true;
    }
    case 'array': {
      if (!Array.isArray(data)) return false;

      for (const item of data) {
        if (!validateSchema(schema.item, item, options)) return false;
      }
      return true;
    }
    case 'optional':
      return data === undefined
        ? true
        : validateSchema(schema.inner, data, options);
    default:
      return false;
  }
}

export function coerce(schema: SchemaNode, value: any) {
  switch (schema.kind) {
    case 'string':
      return value;
    case 'number': {
      if (typeof value !== 'string' || value.trim() === '') return value;
      const newValue = Number(value);
      return Number.isNaN(newValue) ? value : newValue;
    }
    case 'boolean': {
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    }
    case 'object': {
      for (const key in schema.props) {
        value[key] = coerce(schema.props[key], value[key]);
      }
      return value;
    }
    case 'array': {
      for (let i = 0; i < value?.length; i++) {
        value[i] = coerce(schema.item, value[i]);
      }
      return value;
    }
    case 'optional':
      if (value === undefined) return value;
      return coerce(schema.inner, value);

    default:
      return value;
  }
}

// const userSchema = t.object({
//   name: t.string(),
//   age: t.number(),
//   isYoung: t.boolean(),
//   legs: t.object({
//     left: t.boolean(),
//     right: t.boolean(),
//   }),
//   aliases: t.array(t.string()),
//   smokes: t.optional(t.boolean()),
// });

// const userData = {
//   name: 'Alex',
//   age: 21,
//   isYoung: false,
//   legs: {
//     right: true,
//     left: true,
//   },
//   aliases: ['Albebu', 'Roergt'],
//   smokess: false,
// };

// console.log(
//   validateSchema(userSchema, userData, { whitelist: true, forbidden: false }),
// );
// console.log(userData);
