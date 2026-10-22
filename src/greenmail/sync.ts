import { useEffect, useRef } from "react";

/**
 * Keeps every view of the same data current without a reload: whatever
 * changes tasks (the Tasks page, the side-panel card, …) announces it, and
 * everything showing tasks reloads. Same for events, contacts, notes,
 * templates, rules and campaigns.
 */
export type DataKind = "tasks" | "events" | "contacts" | "notes" | "templates" | "rules" | "scheduled" | "campaigns" | "followups" | "outbox";

const EVENT = "greenmail:changed";

export function announceChange(kind: DataKind): void {
  window.dispatchEvent(new CustomEvent<DataKind>(EVENT, { detail: kind }));
}

/** Calls `reload` whenever `kind` changes anywhere in the app. */
export function useOnChange(kind: DataKind, reload: () => void): void {
  const latest = useRef(reload);
  latest.current = reload;

  useEffect(() => {
    const handler = (event: Event) => {
      if ((event as CustomEvent<DataKind>).detail === kind) latest.current();
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, [kind]);
}
