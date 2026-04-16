import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bold, Italic, Strikethrough, Code, List, ListOrdered, Quote, Heading1, Heading2, Heading3, Link as LinkIcon, Image as ImageIcon, ListChecks, Undo, Redo } from "lucide-react";

interface RichEditorProps {
  value: unknown;
  onChange: (json: unknown, html: string) => void;
  placeholder?: string;
  editable?: boolean;
}

export function RichEditor({ value, onChange, placeholder = "Comece a escrever...", editable = true }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline" } }),
      Image,
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: value as Record<string, unknown> | undefined,
    editable,
    onUpdate: ({ editor }) => onChange(editor.getJSON(), editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-invert max-w-none focus:outline-none min-h-[300px] px-4 py-3 text-foreground",
      },
    },
  });

  useEffect(() => {
    if (editor && value && JSON.stringify(editor.getJSON()) !== JSON.stringify(value)) {
      editor.commands.setContent(value as Record<string, unknown>);
    }
  }, [value, editor]);

  if (!editor) return null;

  const btn = (active: boolean) => `h-8 w-8 p-0 ${active ? "bg-accent text-accent-foreground" : ""}`;

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {editable && (
        <div className="flex flex-wrap items-center gap-1 p-2 border-b border-border bg-secondary/30">
          <Button variant="ghost" size="sm" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" className={btn(editor.isActive("strike"))} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" className={btn(editor.isActive("code"))} onClick={() => editor.chain().focus().toggleCode().run()}><Code className="h-4 w-4" /></Button>
          <div className="w-px h-6 bg-border mx-1" />
          <Button variant="ghost" size="sm" className={btn(editor.isActive("heading", { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" className={btn(editor.isActive("heading", { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></Button>
          <div className="w-px h-6 bg-border mx-1" />
          <Button variant="ghost" size="sm" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" className={btn(editor.isActive("taskList"))} onClick={() => editor.chain().focus().toggleTaskList().run()}><ListChecks className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" className={btn(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></Button>
          <div className="w-px h-6 bg-border mx-1" />
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => {
            const url = window.prompt("URL do link:");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}><LinkIcon className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => {
            const url = window.prompt("URL da imagem:");
            if (url) editor.chain().focus().setImage({ src: url }).run();
          }}><ImageIcon className="h-4 w-4" /></Button>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => editor.chain().focus().undo().run()}><Undo className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => editor.chain().focus().redo().run()}><Redo className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
