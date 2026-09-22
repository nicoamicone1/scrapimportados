import { describe, expect, it } from "vitest";

import {
  applyDrop,
  flattenTree,
  moveFlat,
  projectDepth,
  reparent,
  setDepth,
  toReorderItems,
  descendantsOf,
  categoryPath,
} from "./category-tree";
import { parseDecimal, parseInteger } from "@/components/admin/products/form-state";

import { cleanSpecs, parseSpecsJson, parseSpecsText } from "./specs";
import {
  buildVariantMatrix,
  cartesian,
  cleanOptions,
  countCombinations,
  optionKey,
  renameOptionKey,
  renameOptionValue,
  validateOptions,
  variantTitle,
  type OptionValues,
} from "./variant-matrix";

interface V {
  id: string | null;
  title: string;
  option_values: OptionValues;
  price: number;
  stock: number;
}

const make = (values: OptionValues, template: V | undefined): V => ({
  id: null,
  title: "",
  option_values: values,
  price: template?.price ?? 0,
  stock: 0,
});

describe("variant-matrix", () => {
  it("genera el producto cartesiano en orden", () => {
    const combos = cartesian([
      { name: "Color", values: ["Rojo", "Azul"] },
      { name: "Talle", values: ["S", "M"] },
    ]);
    expect(combos).toEqual([
      { Color: "Rojo", Talle: "S" },
      { Color: "Rojo", Talle: "M" },
      { Color: "Azul", Talle: "S" },
      { Color: "Azul", Talle: "M" },
    ]);
    expect(cartesian([])).toEqual([{}]);
    expect(countCombinations([{ name: "A", values: ["1", "2", "3"] }, { name: "B", values: ["x", "y"] }])).toBe(6);
  });

  it("optionKey no depende del orden de las keys", () => {
    expect(optionKey({ a: "1", b: "2" })).toBe(optionKey({ b: "2", a: "1" }));
  });

  it("titula variantes según el orden de las opciones", () => {
    const opts = [
      { name: "Color", values: ["Rojo"] },
      { name: "Talle", values: ["M"] },
    ];
    expect(variantTitle({ Talle: "M", Color: "Rojo" }, opts)).toBe("Rojo / M");
    expect(variantTitle({}, [])).toBe("Default");
  });

  it("limpia opciones vacías y duplicadas", () => {
    expect(
      cleanOptions([
        { name: " Color ", values: ["Rojo", "rojo", " ", "Azul"] },
        { name: "color", values: ["X"] },
        { name: "", values: ["Y"] },
        { name: "Talle", values: [] },
      ]),
    ).toEqual([{ name: "Color", values: ["Rojo", "Azul"] }]);
  });

  it("de producto simple a opciones: la Default hereda la primera combinación", () => {
    const def: V = { id: "v1", title: "Default", option_values: {}, price: 100, stock: 7 };
    const out = buildVariantMatrix([{ name: "Talle", values: ["S", "M"] }], [def], make);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ id: "v1", stock: 7, option_values: { Talle: "S" }, title: "S" });
    expect(out[1]).toMatchObject({ id: null, price: 100, stock: 0, title: "M" });
  });

  it("conserva variantes existentes por match exacto al agregar valores", () => {
    const existing: V[] = [
      { id: "a", title: "S", option_values: { Talle: "S" }, price: 10, stock: 1 },
      { id: "b", title: "M", option_values: { Talle: "M" }, price: 12, stock: 2 },
    ];
    const out = buildVariantMatrix([{ name: "Talle", values: ["XS", "S", "M"] }], existing, make);
    expect(out.map((v) => v.id)).toEqual([null, "a", "b"]);
    expect(out[0].price).toBe(10);
  });

  it("al agregar una segunda opción, cada variante pasa a su primera combinación compatible", () => {
    const existing: V[] = [
      { id: "r", title: "Rojo", option_values: { Color: "Rojo" }, price: 10, stock: 3 },
      { id: "a", title: "Azul", option_values: { Color: "Azul" }, price: 10, stock: 4 },
    ];
    const out = buildVariantMatrix(
      [
        { name: "Color", values: ["Rojo", "Azul"] },
        { name: "Talle", values: ["S", "M"] },
      ],
      existing,
      make,
    );
    expect(out.map((v) => v.id)).toEqual(["r", null, "a", null]);
    expect(out[0].title).toBe("Rojo / S");
  });

  it("al quitar una opción conserva una variante por combinación", () => {
    const existing: V[] = [
      { id: "1", title: "", option_values: { Color: "Rojo", Talle: "S" }, price: 1, stock: 1 },
      { id: "2", title: "", option_values: { Color: "Rojo", Talle: "M" }, price: 1, stock: 1 },
      { id: "3", title: "", option_values: { Color: "Azul", Talle: "S" }, price: 1, stock: 1 },
    ];
    const out = buildVariantMatrix([{ name: "Color", values: ["Rojo", "Azul"] }], existing, make);
    expect(out.map((v) => v.id)).toEqual(["1", "3"]);
  });

  it("sin opciones vuelve a una sola variante Default", () => {
    const existing: V[] = [{ id: "1", title: "S", option_values: { Talle: "S" }, price: 5, stock: 2 }];
    const out = buildVariantMatrix([], existing, make);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "1", title: "Default", option_values: {} });
  });

  it("renombra opciones y valores en las variantes", () => {
    const vs: V[] = [{ id: "1", title: "", option_values: { Color: "Rojo" }, price: 1, stock: 1 }];
    expect(renameOptionKey(vs, "Color", "Colour")[0].option_values).toEqual({ Colour: "Rojo" });
    expect(renameOptionValue(vs, "Color", "Rojo", "Bordó")[0].option_values).toEqual({ Color: "Bordó" });
  });

  it("valida opciones", () => {
    expect(validateOptions([{ name: "Color", values: ["Rojo"] }])).toEqual({});
    expect(validateOptions([{ name: "", values: ["x"] }])[0]).toMatch(/nombre/);
    expect(validateOptions([{ name: "A", values: ["x"] }, { name: "a", values: ["y"] }])[1]).toMatch(/Ya hay/);
    expect(validateOptions([{ name: "A", values: ["x", "X"] }])[0]).toMatch(/repetidos/);
    expect(validateOptions([{ name: "A", values: [] }])[0]).toMatch(/valor/);
  });
});

const cats = [
  { id: "a", parent_id: null, position: 1, name: "Audio" },
  { id: "b", parent_id: null, position: 0, name: "Bazar" },
  { id: "a1", parent_id: "a", position: 0, name: "Auriculares" },
  { id: "a2", parent_id: "a", position: 1, name: "Parlantes" },
  { id: "a1x", parent_id: "a1", position: 0, name: "In-ear" },
];

describe("category-tree", () => {
  it("aplana en orden de árbol con profundidad", () => {
    const flat = flattenTree(cats);
    expect(flat.map((f) => `${f.id}:${f.depth}`)).toEqual(["b:0", "a:0", "a1:1", "a1x:2", "a2:1"]);
  });

  it("descendientes y ruta", () => {
    expect([...descendantsOf(cats, "a")].sort()).toEqual(["a1", "a1x", "a2"]);
    expect(categoryPath(cats, "a1x")).toBe("Audio / Auriculares / In-ear");
  });

  it("mueve un bloque con su subárbol", () => {
    const flat = flattenTree(cats);
    const moved = moveFlat(flat, "a1", "a2");
    expect(moved.map((f) => f.id)).toEqual(["b", "a", "a2", "a1", "a1x"]);
    const up = moveFlat(flat, "a", "b");
    expect(up.map((f) => f.id)).toEqual(["a", "a1", "a1x", "a2", "b"]);
    // Soltar dentro del propio subárbol no hace nada.
    expect(moveFlat(flat, "a", "a1x")).toBe(flat);
  });

  it("proyecta profundidad válida", () => {
    const flat = flattenTree(cats); // b, a, a1, a1x, a2
    expect(projectDepth(flat, 0, 3)).toEqual({ depth: 0, parentId: null });
    // "a" bajo "b": su subárbol tiene altura 2, con máximo 3 niveles no entra.
    expect(projectDepth(flat, 1, 1)).toEqual({ depth: 0, parentId: null });
    // "a2" puede anidarse bajo "a1" (depth 2).
    expect(projectDepth(flat, 4, 2)).toEqual({ depth: 2, parentId: "a1" });
    expect(projectDepth(flat, 4, 0)).toEqual({ depth: 0, parentId: null });
  });

  it("proyecta sobre la lista sin el subárbol (como al arrastrar)", () => {
    // Árbol: T(0) > [N(1), O(1)], Q(0) > [H(1)]. Se arrastra Q (sin H visible) entre N y O.
    const tree = [
      { id: "T", parent_id: null, position: 0, name: "T" },
      { id: "N", parent_id: "T", position: 0, name: "N" },
      { id: "O", parent_id: "T", position: 1, name: "O" },
      { id: "Q", parent_id: null, position: 1, name: "Q" },
      { id: "H", parent_id: "Q", position: 0, name: "H" },
    ];
    const visible = flattenTree(tree).filter((f) => f.id !== "H"); // T, N, O, Q
    const moved = [visible[0], visible[1], visible[3], visible[2]]; // T, N, Q, O
    // Q tiene una hija (altura 1): con 3 niveles, Q puede quedar como mucho en depth 1.
    // Soltar con depth deseada 0 antes de O (depth 1) obliga a depth 1 dentro de T:
    // O no queda adoptada por Q.
    expect(projectDepth(moved, 2, 0, 1, false)).toEqual({ depth: 1, parentId: "T" });
    const next = applyDrop(flattenTree(tree), "Q", "O", 1);
    expect(next.map((f) => `${f.id}:${f.parentId}`)).toEqual(["T:null", "N:T", "Q:T", "H:Q", "O:T"]);
  });

  it("setDepth arrastra el subárbol y recalcula padres", () => {
    const flat = flattenTree(cats);
    const next = setDepth(flat, "a1", 0);
    expect(next.map((f) => `${f.id}:${f.depth}:${f.parentId}`)).toEqual([
      "b:0:null",
      "a:0:null",
      "a1:0:null",
      "a1x:1:a1",
      // En la lista plana, "a2" queda debajo del subárbol de "a1".
      "a2:1:a1",
    ]);
  });

  it("reparent normaliza saltos de profundidad", () => {
    const flat = flattenTree(cats).map((f) => (f.id === "a2" ? { ...f, depth: 5 } : f));
    expect(reparent(flat).find((f) => f.id === "a2")).toMatchObject({ depth: 3, parentId: "a1x" });
  });

  it("applyDrop mueve hacia abajo, a la raíz y sin moverse", () => {
    const flat = flattenTree(cats); // b, a, a1, a1x, a2
    expect(applyDrop(flat, "b", "a2", 0).map((f) => `${f.id}:${f.parentId}`)).toEqual([
      "a:null",
      "a1:a",
      "a1x:a1",
      "a2:a",
      "b:null",
    ]);
    // Sólo cambia la profundidad (arrastre horizontal sobre sí misma).
    expect(applyDrop(flat, "a2", "a2", 2).find((f) => f.id === "a2")).toMatchObject({ parentId: "a1", depth: 2 });
    // No se puede soltar dentro de su propio subárbol.
    expect(applyDrop(flat, "a", "a1x", 0)).toBe(flat);
  });

  it("toReorderItems numera por hermanos", () => {
    expect(toReorderItems(flattenTree(cats))).toEqual([
      { id: "b", parent_id: null, position: 0 },
      { id: "a", parent_id: null, position: 1 },
      { id: "a1", parent_id: "a", position: 0 },
      { id: "a1x", parent_id: "a1", position: 0 },
      { id: "a2", parent_id: "a", position: 1 },
    ]);
  });
});

describe("specs", () => {
  it("parsea texto pegado", () => {
    expect(
      parseSpecsText("Material: Algodón\n• Origen:Argentina\nPeso\t200 g\nsin separador\nCuidado - Lavar a 30°"),
    ).toEqual([
      { label: "Material", value: "Algodón" },
      { label: "Origen", value: "Argentina" },
      { label: "Peso", value: "200 g" },
      { label: "Cuidado", value: "Lavar a 30°" },
    ]);
  });

  it("lee jsonb tolerante y limpia filas vacías", () => {
    expect(parseSpecsJson([{ label: "A", value: 3 }, "x", null, { label: " ", value: "" }])).toEqual([{ label: "A", value: "3" }]);
    expect(parseSpecsJson(null)).toEqual([]);
    expect(cleanSpecs([{ label: " A ", value: " b " }, { label: "", value: "x" }])).toEqual([{ label: "A", value: "b" }]);
  });
});

describe("números del form de producto", () => {
  it("parseDecimal acepta formato es-AR y rechaza basura", () => {
    expect(parseDecimal("25.000")).toBe(25000);
    expect(parseDecimal("$ 1.234,50")).toBe(1234.5);
    expect(parseDecimal("19990")).toBe(19990);
    expect(parseDecimal("12,5")).toBe(12.5);
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("abc")).toBeNaN();
    expect(parseDecimal("12abc")).toBeNaN();
    expect(parseDecimal("1,2,3")).toBeNaN();
  });

  it("parseInteger", () => {
    expect(parseInteger("7")).toBe(7);
    expect(parseInteger("-2")).toBe(-2);
    expect(parseInteger(" ")).toBeNull();
    expect(parseInteger("2.5")).toBeNaN();
  });
});
