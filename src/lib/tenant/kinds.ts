/**
 * Rubros del alta de tienda → preset del tema (espejo de `create_store()`
 * en la migración 0011).
 */

export const STORE_KINDS = [
  { id: "moda", label: "Moda y accesorios", hint: "Ropa, joyería, marroquinería", preset: "atelier" },
  { id: "artesanias", label: "Artesanías y deco", hint: "Cerámica, textiles, objetos", preset: "mercado" },
  { id: "tecnologia", label: "Tecnología y hogar", hint: "Electro, bazar, ferretería", preset: "nordico" },
  { id: "marca", label: "Marca con actitud", hint: "Indumentaria urbana, editoriales", preset: "editorial" },
  { id: "gaming", label: "Gaming", hint: "Periféricos, streetwear, coleccionables", preset: "neon" },
  { id: "otro", label: "Otro rubro", hint: "Arrancás con un estilo neutro", preset: "nordico" },
] as const;

export type StoreKind = (typeof STORE_KINDS)[number]["id"];

export function presetForKind(kind: string): (typeof STORE_KINDS)[number]["preset"] {
  return STORE_KINDS.find((k) => k.id === kind)?.preset ?? "nordico";
}
