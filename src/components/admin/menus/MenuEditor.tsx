"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, CornerDownRight, ExternalLink, GripVertical, IndentDecrease, IndentIncrease, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { nanoid } from "nanoid";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { saveMenu } from "@/app/admin/(panel)/menus/actions";
import { searchProducts } from "@/app/admin/(panel)/paginas/actions";
import { Button } from "@/components/ui/Button";
import { Card, CardFooter, CardHeader } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { toast } from "@/components/ui";
import type { CategoryOption, PageOption, ProductOption } from "@/lib/admin/pages";
import { cn } from "@/lib/cn";
import { LINK_KIND_LABELS, LINK_KINDS, MAX_MENU_ITEMS, MENU_LABELS, menuHrefError, type LinkKind, type MenuHandle, type MenuItemInput } from "@/lib/schemas/menu";

/*
 * Editor de menús (agente E): árbol de 2 niveles con drag & drop por nivel,
 * sangría para anidar y un picker de destino por ítem.
 */

interface EditorItem extends Omit<MenuItemInput, "children"> {
  key: string;
  children: EditorItem[];
}

const toEditor = (items: MenuItemInput[]): EditorItem[] =>
  items.map((i) => ({ ...i, key: nanoid(8), children: toEditor(i.children ?? []) }));

const fromEditor = (items: EditorItem[]): MenuItemInput[] =>
  items.map((item) => {
    const { children, ...rest } = item;
    delete (rest as Partial<EditorItem>).key;
    return { ...rest, children: fromEditor(children) };
  });

export interface MenuLinkOptions {
  categories: CategoryOption[];
  pages: PageOption[];
}

const INTERNAL_ROUTES = [
  { href: "/", label: "Inicio" },
  { href: "/productos", label: "Todos los productos" },
  { href: "/carrito", label: "Carrito" },
  { href: "/arrepentimiento", label: "Botón de arrepentimiento" },
];

function itemError(item: EditorItem, isGroup: boolean): string | null {
  if (!item.label.trim()) return "Poné una etiqueta.";
  if (isGroup && !item.href.trim()) return null;
  return menuHrefError(item.href, item.link?.kind ?? "internal");
}

// ---------------------------------------------------------------------------
// Picker de destino
// ---------------------------------------------------------------------------

function ProductLink({ value, onPick }: { value: string; onPick: (p: ProductOption) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProductOption[]>([]);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <div className="space-y-1.5">
      <Input
        size="sm"
        leading={pending ? <Loader2 className="animate-spin" /> : <Search />}
        value={q}
        placeholder={value ? `Actual: ${value}` : "Buscar producto…"}
        aria-label="Buscar producto"
        onChange={(e) => {
          const term = e.target.value;
          setQ(term);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => start(async () => {
            const r = await searchProducts(term);
            if (r.ok) setResults(r.data.slice(0, 8));
          }), 250);
        }}
      />
      {results.length ? (
        <ul className="divide-y divide-adm-border rounded-adm border border-adm-border">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex h-9 w-full items-center gap-2 px-2 text-left text-[13px] hover:bg-adm-hover"
                onClick={() => {
                  onPick(p);
                  setResults([]);
                  setQ("");
                }}
              >
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="font-mono text-[11px] text-adm-fg-muted">/producto/{p.slug}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DestinationPicker({ item, onChange, options, isGroup }: { item: EditorItem; onChange: (patch: Partial<EditorItem>) => void; options: MenuLinkOptions; isGroup: boolean }) {
  const kind: LinkKind = item.link?.kind ?? "internal";
  const error = itemError(item, isGroup);
  const setKind = (k: LinkKind) => {
    if (k === "category" && options.categories[0]) {
      const c = options.categories[0];
      return onChange({ link: { kind: k, id: c.id }, href: `/categoria/${c.slug}` });
    }
    if (k === "page" && options.pages[0]) {
      const p = options.pages[0];
      return onChange({ link: { kind: k, id: p.id }, href: p.slug === "home" ? "/" : `/${p.slug}` });
    }
    onChange({ link: { kind: k }, href: k === "external" ? "https://" : k === "internal" ? "/productos" : item.href });
  };
  return (
    <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
      <Field label="Destino">
        <Select value={kind} onChange={(e) => setKind(e.target.value as LinkKind)} options={LINK_KINDS.map((k) => ({ value: k, label: LINK_KIND_LABELS[k] }))} />
      </Field>
      <div className="min-w-0">
        {kind === "category" ? (
          <Field label="Categoría" error={error}>
            <Select
              value={item.link?.id ?? ""}
              placeholder="Elegí una categoría"
              onChange={(e) => {
                const c = options.categories.find((x) => x.id === e.target.value);
                if (c) onChange({ link: { kind, id: c.id }, href: `/categoria/${c.slug}` });
              }}
              options={options.categories.map((c) => ({ value: c.id, label: `${"  ".repeat(c.depth)}${c.name}` }))}
            />
          </Field>
        ) : kind === "page" ? (
          <Field label="Página" error={error} hint={options.pages.find((p) => p.id === item.link?.id)?.status === "draft" ? "Esa página es un borrador: el link va a dar error hasta que la publiques." : undefined}>
            <Select
              value={item.link?.id ?? ""}
              placeholder="Elegí una página"
              onChange={(e) => {
                const p = options.pages.find((x) => x.id === e.target.value);
                if (p) onChange({ link: { kind, id: p.id }, href: p.slug === "home" ? "/" : `/${p.slug}` });
              }}
              options={options.pages.map((p) => ({ value: p.id, label: `${p.slug === "home" ? "Portada" : p.title}${p.status === "draft" ? " (borrador)" : ""}` }))}
            />
          </Field>
        ) : kind === "product" ? (
          <Field label="Producto" error={error}>
            <ProductLink value={item.href} onPick={(p) => onChange({ link: { kind, id: p.id }, href: `/producto/${p.slug}` })} />
          </Field>
        ) : (
          <Field label={kind === "external" ? "URL" : "Ruta"} error={error} hint={kind === "internal" ? "Por ejemplo /productos?orden=nuevos o /#como-comprar" : undefined}>
            <Input
              value={item.href}
              list={kind === "internal" ? "menu-routes" : undefined}
              className="font-mono text-[13px]"
              placeholder={kind === "external" ? "https://instagram.com/tutienda" : "/productos"}
              onChange={(e) => onChange({ href: e.target.value.trim() })}
              spellCheck={false}
            />
          </Field>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filas
// ---------------------------------------------------------------------------

function ItemRow({
  item,
  depth,
  options,
  open,
  onToggle,
  onChange,
  onRemove,
  onIndent,
  onOutdent,
  canIndent,
}: {
  item: EditorItem;
  depth: 0 | 1;
  options: MenuLinkOptions;
  open: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<EditorItem>) => void;
  onRemove: () => void;
  onIndent?: () => void;
  onOutdent?: () => void;
  canIndent: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.key });
  const isGroup = depth === 0 && item.children.length > 0;
  const error = itemError(item, isGroup);
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(isDragging && "relative z-10")}>
      <div className={cn("rounded-adm border bg-adm-surface", error ? "border-adm-danger" : "border-adm-border", isDragging && "shadow-[var(--adm-shadow)]")}>
        <div className="flex items-center gap-1 pr-1">
          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label={`Mover ${item.label || "ítem"}`}
            className="flex h-10 w-7 shrink-0 cursor-grab items-center justify-center text-adm-fg-muted active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
          {depth === 1 ? <CornerDownRight className="size-3.5 shrink-0 text-adm-fg-muted" aria-hidden /> : null}
          <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left text-[13px]">
            <span className="truncate font-medium text-adm-fg">{item.label || "Sin etiqueta"}</span>
            <span className="truncate font-mono text-xs text-adm-fg-muted">{isGroup && (!item.href || item.href === "#") ? "Grupo" : item.href}</span>
            {item.newTab ? <ExternalLink className="size-3 shrink-0 text-adm-fg-muted" aria-label="Abre en otra pestaña" /> : null}
            <ChevronDown className={cn("ml-auto size-4 shrink-0 text-adm-fg-muted transition-transform", !open && "-rotate-90")} aria-hidden />
          </button>
          {depth === 0 && onIndent ? (
            <Button size="icon-sm" variant="ghost" aria-label="Meter dentro del ítem de arriba" title="Meter dentro del de arriba" disabled={!canIndent} onClick={onIndent}>
              <IndentIncrease />
            </Button>
          ) : null}
          {depth === 1 && onOutdent ? (
            <Button size="icon-sm" variant="ghost" aria-label="Sacar al primer nivel" title="Sacar al primer nivel" onClick={onOutdent}>
              <IndentDecrease />
            </Button>
          ) : null}
          <Button size="icon-sm" variant="ghost" aria-label={`Quitar ${item.label || "ítem"}`} onClick={onRemove}>
            <Trash2 />
          </Button>
        </div>
        {open ? (
          <div className="space-y-3 border-t border-adm-border p-3">
            <Field label="Etiqueta" error={!item.label.trim() ? "Poné una etiqueta." : null}>
              <Input value={item.label} maxLength={60} onChange={(e) => onChange({ label: e.target.value })} />
            </Field>
            <DestinationPicker item={item} onChange={onChange} options={options} isGroup={isGroup} />
            {isGroup ? <p className="text-xs text-adm-fg-muted">Tiene subítems: podés dejar la ruta vacía y funciona como título del grupo.</p> : null}
            <Switch label="Abrir en otra pestaña" checked={Boolean(item.newTab)} onCheckedChange={(newTab) => onChange({ newTab: newTab || undefined })} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SortableLevel({ items, onReorder, children }: { items: EditorItem[]; onReorder: (items: EditorItem[]) => void; children: React.ReactNode }) {
  const dndId = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.key === active.id);
    const to = items.findIndex((i) => i.key === over.id);
    if (from >= 0 && to >= 0) onReorder(arrayMove(items, from, to));
  };
  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

export function MenuEditor({ handle, initialItems, options }: { handle: MenuHandle; initialItems: MenuItemInput[]; options: MenuLinkOptions }) {
  const [items, setItems] = useState<EditorItem[]>(() => toEditor(initialItems));
  const [saved, setSaved] = useState(() => JSON.stringify(fromEditor(toEditor(initialItems))));
  const [open, setOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(fromEditor(items)) !== saved;
  const total = items.reduce((n, i) => n + 1 + i.children.length, 0);
  const hasErrors = items.some((i) => itemError(i, i.children.length > 0) || i.children.some((c) => itemError(c, false)));

  useEffect(() => {
    if (!dirty) return;
    const fn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [dirty]);

  const updateTop = (key: string, patch: Partial<EditorItem>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const updateChild = (parent: string, key: string, patch: Partial<EditorItem>) =>
    setItems((xs) => xs.map((x) => (x.key === parent ? { ...x, children: x.children.map((c) => (c.key === key ? { ...c, ...patch } : c)) } : x)));

  const indent = (index: number) =>
    setItems((xs) => {
      if (index === 0) return xs;
      const item = xs[index];
      const target = xs[index - 1];
      // Un ítem con hijos no puede pasar a segundo nivel (máximo 2 niveles): los hijos suben con él.
      const moved = [{ ...item, children: [] }, ...item.children];
      return xs.filter((_, i) => i !== index).map((x) => (x.key === target.key ? { ...x, children: [...x.children, ...moved] } : x));
    });

  const outdent = (parentKey: string, childKey: string) =>
    setItems((xs) => {
      const pIndex = xs.findIndex((x) => x.key === parentKey);
      const parent = xs[pIndex];
      const child = parent.children.find((c) => c.key === childKey)!;
      const next = xs.map((x) => (x.key === parentKey ? { ...x, children: x.children.filter((c) => c.key !== childKey) } : x));
      next.splice(pIndex + 1, 0, { ...child, children: [] });
      return next;
    });

  const add = () => {
    const item: EditorItem = { key: nanoid(8), label: "", href: "/productos", link: { kind: "internal" }, children: [] };
    setItems((xs) => [...xs, item]);
    setOpen(item.key);
  };

  const save = async () => {
    setSaving(true);
    const payload = fromEditor(items);
    const r = await saveMenu({ handle, items: payload });
    setSaving(false);
    if (!r.ok) return void toast.error(r.error);
    setSaved(JSON.stringify(payload));
    toast.success(`${MENU_LABELS[handle].title} guardado`);
  };

  return (
    <Card>
      <CardHeader title={MENU_LABELS[handle].title} description={MENU_LABELS[handle].description} />
      <div className="space-y-2 p-4">
        {items.length === 0 ? <p className="text-[13px] text-adm-fg-muted">El menú está vacío. Agregá el primer link.</p> : null}
        <SortableLevel items={items} onReorder={setItems}>
          {items.map((item, i) => (
            <div key={item.key} className="space-y-2">
              <ItemRow
                item={item}
                depth={0}
                options={options}
                open={open === item.key}
                onToggle={() => setOpen((o) => (o === item.key ? null : item.key))}
                onChange={(patch) => updateTop(item.key, patch)}
                onRemove={() => setItems((xs) => xs.filter((x) => x.key !== item.key))}
                onIndent={() => indent(i)}
                canIndent={i > 0}
              />
              {item.children.length ? (
                <div className="ml-7 space-y-2 border-l border-adm-border pl-3">
                  <SortableLevel items={item.children} onReorder={(children) => updateTop(item.key, { children })}>
                    {item.children.map((child) => (
                      <ItemRow
                        key={child.key}
                        item={child}
                        depth={1}
                        options={options}
                        open={open === child.key}
                        onToggle={() => setOpen((o) => (o === child.key ? null : child.key))}
                        onChange={(patch) => updateChild(item.key, child.key, patch)}
                        onRemove={() => updateTop(item.key, { children: item.children.filter((c) => c.key !== child.key) })}
                        onOutdent={() => outdent(item.key, child.key)}
                        canIndent={false}
                      />
                    ))}
                  </SortableLevel>
                </div>
              ) : null}
            </div>
          ))}
        </SortableLevel>
        {total < MAX_MENU_ITEMS ? (
          <Button size="sm" icon={<Plus />} onClick={add}>
            Agregar link
          </Button>
        ) : null}
        <datalist id="menu-routes">
          {INTERNAL_ROUTES.map((r) => (
            <option key={r.href} value={r.href}>
              {r.label}
            </option>
          ))}
        </datalist>
      </div>
      <CardFooter>
        {dirty ? <span className="mr-auto text-xs font-medium text-adm-warning">Cambios sin guardar</span> : null}
        <Button disabled={!dirty || saving} onClick={() => setItems(toEditor(JSON.parse(saved) as MenuItemInput[]))}>
          Descartar
        </Button>
        <Button variant="primary" disabled={!dirty || hasErrors} loading={saving} onClick={() => void save()} title={hasErrors ? "Hay ítems con errores" : undefined}>
          Guardar
        </Button>
      </CardFooter>
    </Card>
  );
}
