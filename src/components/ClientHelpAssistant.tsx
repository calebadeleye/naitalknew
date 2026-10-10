import React, { useEffect, useRef, useState } from "react";
import { BookOpen, Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { laravelApi } from "../shared/api";
import { whatsappUrl } from "../shared/siteDefaults";

type AssistantArticle = { title: string; slug: string; url: string };
type AssistantMessage = { role: "user" | "assistant"; content: string; articles?: AssistantArticle[] };

/** Dispatch this to open the assistant from anywhere in the client area (e.g. the "Help & Support" menu item). */
export const OPEN_HELP_ASSISTANT_EVENT = "naitalk:open-help-assistant";

const CLIENT_TOKEN_KEY = "naitalk_laravel_client_token";
const CONVERSATION_KEY = "naitalk_help_assistant_conversation";
// The server only accepts the most recent turns as context.
const HISTORY_TURNS_SENT = 8;

const SUGGESTED_QUESTIONS = [
  "How do I renew my domain?",
  "How do I create a business email account?",
  "How do I pay an invoice?",
  "Where can I download my receipt?",
];

function loadConversation(): AssistantMessage[] {
  try {
    const saved = sessionStorage.getItem(CONVERSATION_KEY);
    return saved ? (JSON.parse(saved) as AssistantMessage[]) : [];
  } catch {
    return [];
  }
}

/**
 * Floating "How do I…?" assistant for the client area. Answers come from the
 * published knowledge base (POST /client/help-assistant), each with links to
 * the articles it used; WhatsApp is always one tap away for anything it
 * can't answer. The conversation lives in sessionStorage, so it survives
 * moving between client-area pages but not closing the tab.
 */
export function ClientHelpAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>(loadConversation);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener(OPEN_HELP_ASSISTANT_EVENT, open);
    return () => window.removeEventListener(OPEN_HELP_ASSISTANT_EVENT, open);
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(CONVERSATION_KEY, JSON.stringify(messages.slice(-20)));
    } catch {
      // Storage unavailable (private mode) — the conversation just won't persist.
    }
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || isSending) return;

    const history = messages.slice(-HISTORY_TURNS_SENT).map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, { role: "user", content: text }]);
    setInput("");
    setIsSending(true);

    try {
      const response = await laravelApi<{ reply: string; articles: AssistantArticle[] }>(
        "/api/v1/client/help-assistant",
        sessionStorage.getItem(CLIENT_TOKEN_KEY) || undefined,
        { method: "POST", body: JSON.stringify({ message: text, history }) },
      );
      setMessages((current) => [...current, { role: "assistant", content: response.reply, articles: response.articles }]);
    } catch {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: "Sorry, I couldn't answer that just now. Please try again, or message our team on WhatsApp." },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-[60] inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-black text-black shadow-[0_12px_40px_rgba(155,234,22,0.35)] transition hover:brightness-110"
          aria-label="Open help assistant"
        >
          <Sparkles className="h-4 w-4" />
          Need help?
        </button>
      )}

      {isOpen && (
        <section
          role="dialog"
          aria-label="Help assistant"
          className="fixed inset-x-3 bottom-3 z-[60] flex max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#070c10] shadow-[0_24px_80px_rgba(0,0,0,0.6)] sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[390px]"
        >
          <header className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-black text-white">
                <Sparkles className="h-4 w-4 text-primary" /> Help assistant
              </p>
              <p className="mt-1 text-xs text-white/50">Ask how to do anything in your client area. Answers come from our help guides.</p>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-md p-1 text-white/60 hover:text-white" aria-label="Close help assistant">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {messages.length === 0 && (
              <div>
                <p className="text-sm text-white/70">Hi! What would you like to do? Try one of these:</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SUGGESTED_QUESTIONS.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => void ask(question)}
                      className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-left text-xs font-bold text-primary hover:bg-primary/20"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div key={index} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    message.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-black"
                      : "max-w-[90%] rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/85"
                  }
                >
                  <p className="whitespace-pre-line leading-6">{message.content}</p>
                  {message.articles && message.articles.length > 0 && (
                    <div className="mt-2 grid gap-1 border-t border-white/10 pt-2">
                      {message.articles.map((article) => (
                        <a
                          key={article.slug}
                          href={article.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-start gap-1.5 text-xs font-bold text-primary hover:underline"
                        >
                          <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {article.title}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isSending && (
              <div className="flex items-center gap-2 text-xs text-white/50">
                <Loader2 className="h-4 w-4 animate-spin" /> Looking that up…
              </div>
            )}
          </div>

          <form
            className="border-t border-white/10 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void ask(input);
            }}
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value.slice(0, 1000))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void ask(input);
                  }
                }}
                rows={1}
                placeholder="Type your question…"
                aria-label="Your question"
                className="max-h-28 min-h-[42px] flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-primary/50 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSending || !input.trim()}
                className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-primary text-black disabled:opacity-40"
                aria-label="Send question"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-white/55 hover:text-primary"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Prefer a person? Chat with our team on WhatsApp
            </a>
          </form>
        </section>
      )}
    </>
  );
}
