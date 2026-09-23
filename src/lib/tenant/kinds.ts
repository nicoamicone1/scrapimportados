/**
 * Rubros del alta de tienda → preset del tema (espejo del `case` de
 * `create_store()`; la versión vigente está en la migración 0013_presets.sql
 * y `presets.test.ts` verifica que coincidan).
 */

export const STORE_KINDS = [
  { id: "moda", label: "Moda y accesorios", hint: "Ropa, joyería, marroquinería", preset: "atelier" },
  { id: "artesanias", label: "Artesanías y deco", hint: "Cerámica, textiles, objetos", preset: "mercado" },
  { id: "tecnologia", label: "Tecnología y hogar", hint: "Electro, bazar, ferretería", preset: "nordico" },
  { id: "marca", label: "Marca con actitud", hint: "Indumentaria urbana, editoriales", preset: "editorial" },
  { id: "gaming", label: "Gaming y audio", hint: "Periféricos, audio, vinilos", preset: "neon" },
  { id: "farmacia", label: "Farmacia y perfumería", hint: "Dermocosmética, cuidado personal", preset: "botica" },
  { id: "libreria", label: "Librería y juguetería", hint: "Papelería, ropa infantil", preset: "recreo" },
  { id: "muebles", label: "Muebles e iluminación", hint: "Mueblería, objetos de diseño", preset: "lapacho" },
  { id: "mayorista", label: "Mayorista", hint: "Distribuidora, corralón, repuestos", preset: "galpon" },
  { id: "gourmet", label: "Vinos y gourmet", hint: "Vinoteca, almacén, café", preset: "bodega" },
  { id: "otro", label: "Otro rubro", hint: "Arrancás con un estilo neutro", preset: "nordico" },
] as const;

export type StoreKind = (typeof STORE_KINDS)[number]["id"];

export function presetForKind(kind: string): (typeof STORE_KINDS)[number]["preset"] {
  return STORE_KINDS.find((k) => k.id === kind)?.preset ?? "nordico";
}
