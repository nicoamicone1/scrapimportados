"use client";

import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Redo2, Undo2, Unlink } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { isSafeUrl } from "@/lib/html";

/*
 * Editor de texto enriquecido liviano (TipTap + StarterKit): negrita, cursiva,
 * títulos H2/H3, listas, link y deshacer. Devuelve HTML; el server SIEMPRE lo
 * pasa por `sanitizeHtml` antes de guardar.
 */

const contentClass = cn(
  "min-h-40 px-3 py-2.5 text-sm leading-relaxed text-adm-fg outline-none",
  "[&_p]:my-2 [&_p:first-child]:mt-0 [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold",
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li_p]:my-0.5",
  "[&_a]:text-adm-accent [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-adm-border [&_blockquote]:pl-3 [&_blockquote]:text-adm-fg-muted",
  "[&_.is-editor-empty:first-child]:before:pointer-events-none [&_.is-editor-empty:first-child]:before:float-left [&_.is-editor-empty:first-child]:before:h-0 [&_.is-editor-empty:first-child]:before:text-adm-fg-muted/70 [&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]",
);

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-[4px] text-adm-fg-muted hover:bg-adm-surface-2 hover:text-adm-fg disabled:opacity-40 [&_svg]:size-4",
        active && "bg-adm-surface-2 text-adm-fg",
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor, onLink }: { editor: Editor; onLink: () => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      link: e.isActive("link"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();
  return (
    <div role="toolbar" aria-label="Formato" className="flex flex-wrap items-center gap-0.5 border-b border-adm-border px-1.5 py-1">
      <ToolButton label="Negrita (Ctrl+B)" active={state.bold} onClick={() => chain().toggleBold().run()}>
        <Bold />
      </ToolButton>
      <ToolButton label="Cursiva (Ctrl+I)" active={state.italic} onClick={() => chain().toggleItalic().run()}>
        <Italic />
      </ToolButton>
      <span aria-hidden className="mx-1 h-4 w-px bg-adm-border" />
      <ToolButton label="Título" active={state.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
        <Heading2 />
      </ToolButton>
      <ToolButton label="Subtítulo" active={state.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
        <Heading3 />
      </ToolButton>
      <span aria-hidden className="mx-1 h-4 w-px bg-adm-border" />
      <ToolButton label="Lista con viñetas" active={state.bullet} onClick={() => chain().toggleBulletList().run()}>
        <List />
      </ToolButton>
      <ToolButton label="Lista numerada" active={state.ordered} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered />
      </ToolButton>
      <span aria-hidden className="mx-1 h-4 w-px bg-adm-border" />
      <ToolButton label={state.link ? "Editar link" : "Agregar link"} active={state.link} onClick={onLink}>
        <Link2 />
      </ToolButton>
      {state.link ? (
        <ToolButton label="Quitar link" onClick={() => chain().extendMarkRange("link").unsetLink().run()}>
          <Unlink />
        </ToolButton>
      ) : null}
      <span className="flex-1" />
      <ToolButton label="Deshacer (Ctrl+Z)" disabled={!state.canUndo} onClick={() => chain().undo().run()}>
        <Undo2 />
      </ToolButton>
      <ToolButton label="Rehacer (Ctrl+Shift+Z)" disabled={!state.canRedo} onClick={() => chain().redo().run()}>
        <Redo2 />
      </ToolButton>
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Contá qué es, para quién es y por qué conviene.",
  id,
  invalid,
  "aria-describedby": describedBy,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  id?: string;
  invalid?: boolean;
  "aria-describedby"?: string;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        horizontalRule: false,
        underline: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", HTMLAttributes: { rel: "noopener noreferrer" } },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: contentClass,
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Descripción",
        ...(id ? { id } : {}),
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
      },
    },
    onUpdate: ({ editor: e }) => {
      const html = e.isEmpty ? "" : e.getHTML();
      onChange(html);
    },
  });

  // Si el valor cambia desde afuera (restaurar borrador, descartar), se sincroniza.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (current !== value) editor.commands.setContent(value || "", { emitUpdate: false });
  }, [editor, value]);

  const openLink = () => {
    if (!editor) return;
    setLinkUrl((editor.getAttributes("link").href as string | undefined) ?? "");
    setLinkError(null);
    setLinkOpen(true);
  };

  const applyLink = () => {
    if (!editor) return;
    const url = linkUrl.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkOpen(false);
      return;
    }
    const href = /^(https?:|mailto:|tel:|\/)/i.test(url) ? url : `https://${url}`;
    if (!isSafeUrl(href)) {
      setLinkError("Ese link no es válido.");
      return;
    }
    if (editor.state.selection.empty && !editor.isActive("link")) {
      editor.chain().focus().insertContent({ type: "text", text: url, marks: [{ type: "link", attrs: { href } }] }).run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    setLinkOpen(false);
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-adm border border-adm-input-border bg-adm-surface focus-within:shadow-[var(--adm-focus)]",
        invalid && "border-adm-danger",
      )}
    >
      {editor ? <Toolbar editor={editor} onLink={openLink} /> : <div className="h-9 border-b border-adm-border" />}
      <EditorContent editor={editor} className="adm-scroll max-h-[480px] overflow-y-auto" />
      <Dialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        size="sm"
        title="Link"
        footer={
          <>
            <Button onClick={() => setLinkOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={applyLink}>
              Aplicar
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
        >
          <Field label="Dirección" hint="Dejalo vacío para quitar el link." error={linkError}>
            <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" autoFocus inputMode="url" />
          </Field>
        </form>
      </Dialog>
    </div>
  );
}
