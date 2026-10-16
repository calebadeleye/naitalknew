import React, { useEffect, useRef } from "react";
import { Bold, Italic, Link2, List, ListOrdered, Underline } from "lucide-react";

/**
 * A small rich-text editor (bold, italic, underline, lists, links) for
 * templates and campaigns. Uncontrolled: it starts from `initialHtml` and
 * reports every change; remount it (key) to load different content.
 */
export function RichText({
  initialHtml,
  onChange,
  label,
  minHeight = 220,
  toolbarExtra,
}: {
  initialHtml: string;
  onChange: (html: string) => void;
  label: string;
  minHeight?: number;
  toolbarExtra?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml;
    // Only on mount — the editor owns its content afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const command = (name: string, value?: string) => {
    ref.current?.focus();
    document.execCommand(name, false, value);
    onChange(ref.current?.innerHTML ?? "");
  };

  const button = (title: string, icon: React.ReactNode, action: () => void) => (
    <button type="button" title={title} aria-label={title} className="rounded p-1.5 text-slate-600 hover:bg-slate-100" onMouseDown={(event) => event.preventDefault()} onClick={action}>
      {icon}
    </button>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 focus-within:border-[#1f9d4c]">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-2 py-1">
        {button("Bold", <Bold className="h-4 w-4" />, () => command("bold"))}
        {button("Italic", <Italic className="h-4 w-4" />, () => command("italic"))}
        {button("Underline", <Underline className="h-4 w-4" />, () => command("underline"))}
        {button("Bulleted list", <List className="h-4 w-4" />, () => command("insertUnorderedList"))}
        {button("Numbered list", <ListOrdered className="h-4 w-4" />, () => command("insertOrderedList"))}
        {button("Link", <Link2 className="h-4 w-4" />, () => {
          const url = window.prompt("Link address (https://…)");
          if (url && /^(https?:|mailto:)/i.test(url.trim())) command("createLink", url.trim());
        })}
        {toolbarExtra && <span className="ml-auto flex items-center gap-1">{toolbarExtra}</span>}
      </div>
      <div
        ref={ref}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML ?? "")}
        className="greenmail-editor overflow-y-auto px-4 py-3 text-sm leading-6 text-slate-800 outline-none"
        style={{ minHeight }}
      />
    </div>
  );
}

/** Plain text from HTML (for previews and auto-replies). */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  const box = document.createElement("div");
  box.innerHTML = html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h[1-6])>/gi, "\n");
  return (box.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}
