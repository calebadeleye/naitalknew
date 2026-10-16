import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BellRing,
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  EyeOff,
  FileText,
  Filter,
  Globe2,
  Inbox,
  Languages,
  ListTodo,
  LockKeyhole,
  Megaphone,
  MonitorSmartphone,
  Palmtree,
  Paperclip,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Trash2,
  Workflow,
} from "lucide-react";
import "@fontsource/pacifico/latin-400.css";
import { PublicPage, PublicBreadcrumbs, FaqAccordionGroup } from "../shared/marketingWidgets";
import { useJsonLd } from "../seo/useJsonLd";
import { trackCtaClick } from "../lib/analytics";
import { CountUp, GreenmailBrandStrip, useGreenmailStats } from "../shared/greenmailShowcase";

/*
 * Public product page for Green Mail — the webmail included free with every
 * NAI TALK hosting plan. The app itself lives at /greenmail (private); this
 * page is /green-mail. The product previews are drawn in HTML, not
 * screenshots, so they stay sharp and match the real app's colours.
 */

const GM = { green: "#22a04f", deep: "#15803d", navy: "#0f1a2b", mint: "#e3f4e9" };
/** The NAI TALK lime (--color-primary) — used for the page itself; the drawn app keeps Green Mail's own green. */
const LIME = { base: "#9bea16", deep: "#6ed414", ink: "#031006", glow: "155,234,22" };

const HOSTING_HREF = "/web-hosting";
const OPEN_HREF = "/greenmail";

function Wordmark({ size = 34 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-3">
      <img src="/greenmail-app/badge-128.webp" alt="" width={size + 14} height={size + 14} className="rounded-2xl shadow-[0_10px_30px_rgba(155,234,22,0.3)]" />
      <span className="whitespace-nowrap leading-none text-white" style={{ fontFamily: "Pacifico, cursive", fontSize: size }}>
        Green Mail
      </span>
    </span>
  );
}

function Cta({ href, label, section, secondary = false, icon: Icon = ArrowRight }: { href: string; label: string; section: string; secondary?: boolean; icon?: LucideIcon }) {
  return (
    <a
      href={href}
      onClick={() => trackCtaClick({ button_text: label, page_section: section, destination_url: href })}
      className={
        secondary
          ? "inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/20 px-6 py-3 text-sm font-black text-white transition hover:border-white/50 hover:bg-white/5"
          : "inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 py-3 text-sm font-black text-[#031006] shadow-[0_12px_32px_rgba(155,234,22,0.3)] transition hover:-translate-y-0.5"
      }
      style={secondary ? undefined : { background: `linear-gradient(135deg, ${LIME.base}, ${LIME.deep})` }}
    >
      {label} <Icon className="h-4 w-4" />
    </a>
  );
}

/* ---------- Product previews (drawn, not screenshots) ---------- */

const SAMPLE_MAIL = [
  { from: "Bolarinwa Oladimeji", subject: "Website update", snippet: "The new design looks great — can we…", time: "9:16 AM", colour: "#f08c28", unread: true, star: true },
  { from: "Paystack", subject: "Payment received ₦250,000", snippet: "You've received a payment from…", time: "8:02 AM", colour: "#3f8cff", unread: true },
  { from: "Amaka Bello", subject: "Quote for the new branch", snippet: "Please find the quote attached…", time: "Yesterday", colour: "#d6409f", clip: true },
  { from: "Tunde Ade", subject: "Meeting on Friday?", snippet: "Are you free at 2pm to go over…", time: "Yesterday", colour: "#7c6cf2" },
];

function Avatar({ name, colour, size = 28 }: { name: string; colour: string; size?: number }) {
  const initials = name.split(" ").map((part) => part[0]).slice(0, 2).join("");
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, background: colour, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}

function AppWindow({ children, url = "yourbusiness.com/greenmail" }: { children: React.ReactNode; url?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white shadow-[0_40px_90px_rgba(0,0,0,0.45)]">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 flex min-w-0 flex-1 items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-[11px] text-slate-500">
          <LockKeyhole className="h-3 w-3 shrink-0 text-[#15803d]" /> <span className="truncate">{url}</span>
        </span>
      </div>
      {children}
    </div>
  );
}

function InboxPreview() {
  return (
    <AppWindow>
      <div className="flex h-[330px] text-left sm:h-[360px]">
        <div className="hidden w-[130px] shrink-0 flex-col gap-1 p-2.5 sm:flex" style={{ background: GM.navy }}>
          <span className="mb-2 flex items-center gap-1.5 px-1">
            <img src="/greenmail-app/badge-128.webp" alt="" className="h-5 w-5 rounded-md" />
            <span className="text-[13px] text-white" style={{ fontFamily: "Pacifico, cursive" }}>Green Mail</span>
          </span>
          <span className="mb-2 rounded-lg py-1.5 text-center text-[11px] font-bold text-white" style={{ background: GM.green }}>+ Compose</span>
          {[
            [Inbox, "Inbox", "2"],
            [Star, "Starred", "1"],
            [Send, "Sent", ""],
            [FileText, "Drafts", ""],
            [Trash2, "Trash", ""],
          ].map(([Icon, label, count], index) => (
            <span key={label as string} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] ${index === 0 ? "bg-white/10 font-bold text-white" : "text-white/70"}`}>
              {React.createElement(Icon as LucideIcon, { className: "h-3.5 w-3.5" })}
              <span className="flex-1">{label as string}</span>
              {count && <span className="rounded bg-white px-1 text-[9px] font-bold text-[#0f1a2b]">{count as string}</span>}
            </span>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col border-r border-slate-200 sm:max-w-[230px]">
          <div className="flex items-center gap-1.5 border-b border-slate-200 px-2.5 py-2 text-[10px] text-slate-400">
            <Search className="h-3 w-3" /> Search Inbox
          </div>
          {SAMPLE_MAIL.map((mail, index) => (
            <div key={mail.subject} className={`flex gap-2 border-b border-slate-100 px-2.5 py-2 ${index === 0 ? "bg-[#e9f6ee]" : mail.unread ? "bg-[#f7fbf8]" : "bg-white"}`}>
              <Avatar name={mail.from} colour={mail.colour} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-1">
                  <span className={`min-w-0 flex-1 truncate text-[11px] ${mail.unread ? "font-bold text-slate-900" : "text-slate-700"}`}>{mail.from}</span>
                  <span className="shrink-0 text-[9px] text-slate-400">{mail.time}</span>
                </span>
                <span className="flex items-center gap-1 truncate text-[10px] font-semibold text-slate-700">
                  <span className="truncate">{mail.subject}</span>
                  {mail.clip && <Paperclip className="h-2.5 w-2.5 shrink-0 text-slate-400" />}
                </span>
                <span className="block truncate text-[10px] text-slate-400">{mail.snippet}</span>
              </span>
              {mail.star && <Star className="h-3 w-3 shrink-0 self-end fill-amber-400 text-amber-400" />}
            </div>
          ))}
        </div>
        <div className="hidden min-w-0 flex-1 flex-col p-3 md:flex">
          <p className="text-[13px] font-black text-slate-900">Website update</p>
          <span className="mt-2 flex items-center gap-2">
            <Avatar name="Bolarinwa Oladimeji" colour="#f08c28" size={24} />
            <span className="text-[10px] text-slate-500"><b className="text-slate-800">Bolarinwa Oladimeji</b><br />to you</span>
          </span>
          <p className="mt-3 text-[11px] leading-5 text-slate-600">Hi, the new design looks great. I especially like the layout and the colours. Can we add the gallery page before launch?</p>
          <div className="mt-auto rounded-lg border border-slate-200 p-2">
            <p className="text-[10px] text-slate-400">Replying to <b className="text-slate-700">Bolarinwa Oladimeji</b></p>
            <p className="mt-1 border-l-2 pl-1.5 text-[10px] text-slate-400" style={{ borderColor: GM.green }}>Type your reply here…</p>
          </div>
        </div>
      </div>
    </AppWindow>
  );
}

function FloatingCard({ children, className, delay = 0 }: { children: React.ReactNode; className: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: [0, -6, 0] }}
      transition={{ opacity: { delay, duration: 0.5 }, y: { delay, duration: 5, repeat: Infinity, ease: "easeInOut" } }}
      className={`absolute z-10 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-[0_20px_50px_rgba(0,0,0,0.35)] ${className}`}
    >
      {children}
    </motion.div>
  );
}

/* ---------- The feature tour ---------- */

type Tour = { id: string; icon: LucideIcon; label: string; title: string; body: string; points: string[]; preview: React.ReactNode };

function MiniCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 text-left text-slate-800 shadow-[0_30px_70px_rgba(0,0,0,0.35)]">{children}</div>;
}

const TOUR: Tour[] = [
  {
    id: "inbox",
    icon: Inbox,
    label: "A calm inbox",
    title: "An inbox that feels effortless",
    body: "Everything you expect from a modern email app, on your own domain. Fast search, stars, folders, attachments and one-click clean-up of Spam and Trash.",
    points: ["Select many emails and delete, archive or mark them in one go", "A toast confirms every action, and deletes always ask first", "New email pops up while you work, with an Open button"],
    preview: (
      <MiniCard>
        <p className="flex items-center gap-2 text-xs font-bold text-slate-500"><Inbox className="h-4 w-4" style={{ color: GM.green }} /> Inbox · 2 unread</p>
        <div className="mt-3 grid gap-2">
          {SAMPLE_MAIL.slice(0, 3).map((mail) => (
            <div key={mail.subject} className="flex items-center gap-2.5 rounded-xl border border-slate-100 p-2">
              <Avatar name={mail.from} colour={mail.colour} size={30} />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm ${mail.unread ? "font-bold" : ""}`}>{mail.from}</span>
                <span className="block truncate text-xs text-slate-500">{mail.subject}</span>
              </span>
              <span className="text-[10px] text-slate-400">{mail.time}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white" style={{ background: GM.navy }}>
          <BellRing className="h-4 w-4" style={{ color: "#4ade80" }} /> New email from Tunde Ade: Meeting on Friday?
          <span className="ml-auto rounded bg-white/15 px-2 py-0.5 text-[10px]">Open</span>
        </div>
      </MiniCard>
    ),
  },
  {
    id: "ai",
    icon: Bot,
    label: "AI assistant",
    title: "An assistant that reads with you",
    body: "Open any email and ask for a summary, a professional reply, the action items or a translation. It drafts; you decide what gets sent.",
    points: ["Summarise long threads in seconds", "Draft a polished reply, then edit it before sending", "Translate to Yoruba, or ask anything about the email"],
    preview: (
      <MiniCard>
        <p className="flex items-center gap-2 text-sm font-black"><Bot className="h-5 w-5" style={{ color: GM.green }} /> AI Assistant</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {["Summarise this email", "Draft a professional reply", "Extract action items", "Translate to Yoruba"].map((chip) => (
            <span key={chip} className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600">{chip}</span>
          ))}
        </div>
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-700">
          <b className="text-slate-900">Summary:</b> Bolarinwa likes the new design and wants a gallery page added before launch, and needs an answer this week.
        </div>
        <p className="mt-2 text-[11px] font-bold" style={{ color: GM.deep }}>Use this reply →</p>
      </MiniCard>
    ),
  },
  {
    id: "plan",
    icon: CalendarDays,
    label: "Calendar, tasks & notes",
    title: "Your day, right next to your mail",
    body: "A calendar, a to-do list and colourful notes sit beside your inbox, so meetings and follow-ups never live in a separate app.",
    points: ["Month view with today's agenda in the side panel", "Tasks with due dates; tick them off as you go", "Pinned, colour-coded notes you can search"],
    preview: (
      <MiniCard>
        <p className="flex items-center gap-2 text-sm font-black"><CalendarDays className="h-5 w-5 text-slate-700" /> Today</p>
        <div className="mt-2 grid gap-2 text-xs">
          {[["10:00 AM", "Client call — Elinth Homes"], ["2:00 PM", "Review the new branch quote"]].map(([time, title]) => (
            <div key={title} className="flex gap-3"><span className="w-16 text-slate-400">{time}</span><span className="border-l-2 pl-2 font-semibold" style={{ borderColor: GM.green }}>{title}</span></div>
          ))}
        </div>
        <p className="mt-4 flex items-center gap-2 text-sm font-black"><ListTodo className="h-5 w-5 text-slate-700" /> Tasks</p>
        <div className="mt-2 grid gap-1.5 text-xs">
          <span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded border border-slate-300" /> Send the quote to Amaka <span className="ml-auto font-semibold text-[#c2410c]">Today</span></span>
          <span className="flex items-center gap-2 text-slate-400 line-through"><CheckCircle2 className="h-3.5 w-3.5" style={{ color: GM.green }} /> Renew the domain</span>
        </div>
        <div className="mt-4 rounded-xl border border-[#f5e3a3] bg-[#fff8db] p-2.5 text-xs"><b>Call Ada</b><br /><span className="text-slate-600">About the invoice on Friday</span></div>
      </MiniCard>
    ),
  },
  {
    id: "templates",
    icon: Megaphone,
    label: "Templates & campaigns",
    title: "Write once, send beautifully",
    body: "Save the emails you send often as templates. When you have news for everyone, a campaign sends each person their own personal copy, with their name.",
    points: ["Insert a template in one click; {{first_name}} fills itself in", "Campaigns to your contacts or a pasted list, with progress you can watch", "Unsubscribe links included, so you stay on the right side of spam rules"],
    preview: (
      <MiniCard>
        <p className="flex items-center gap-2 text-sm font-black"><Megaphone className="h-5 w-5" style={{ color: GM.green }} /> October newsletter <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: GM.mint, color: "#14632f" }}>Sending</span></p>
        <p className="mt-1 text-xs text-slate-500">Subject: News for {"{{first_name}}"}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-[68%]" style={{ background: GM.green }} /></div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          {[["Sent", "204"], ["Waiting", "96"], ["Unsubscribed", "2"]].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-slate-50 p-2"><b className="block text-base text-slate-900">{value}</b><span className="text-slate-500">{label}</span></div>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500"><FileText className="h-3.5 w-3.5" /> Template: “Invoice follow-up”</p>
      </MiniCard>
    ),
  },
  {
    id: "rules",
    icon: Workflow,
    label: "Filters & automation",
    title: "Let your mailbox do the busywork",
    body: "Sort mail as it arrives, reply automatically, forward copies and schedule emails for later. Rules run on our mail server, so they keep working when you're offline.",
    points: ["Filters: move, star, mark read or delete by sender or subject", "Vacation reply with start and end dates", "Send later: write tonight, deliver at 8 AM"],
    preview: (
      <MiniCard>
        <p className="flex items-center gap-2 text-sm font-black"><Filter className="h-5 w-5" style={{ color: GM.green }} /> Filters</p>
        {["From contains “paystack.com” → Move to Receipts", "Subject contains “invoice” → Star it"].map((rule) => (
          <div key={rule} className="mt-2 flex items-center gap-2 rounded-lg border border-slate-100 p-2 text-xs">
            <span className="relative h-4 w-7 shrink-0 rounded-full" style={{ background: GM.green }}><span className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full bg-white" /></span>
            {rule}
          </div>
        ))}
        <div className="mt-3 flex items-center gap-2 rounded-lg p-2 text-xs" style={{ background: "#f3fbf6", border: `1px solid ${GM.green}` }}>
          <Palmtree className="h-4 w-4" style={{ color: GM.green }} /> Vacation reply is on until Monday
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-100 p-2 text-xs"><Clock className="h-4 w-4" style={{ color: GM.green }} /> “Proposal” sends Mon 8:00 AM</div>
      </MiniCard>
    ),
  },
  {
    id: "app",
    icon: Smartphone,
    label: "Install as an app",
    title: "On your phone, like a real app",
    body: "Install Green Mail on Android, iPhone, Windows or Mac straight from the browser, with no app store. It opens on your own website's sign-in, every time.",
    points: ["Its own icon on your home screen", "Unread count on the icon where your device supports it", "Each website you run installs as its own app"],
    preview: (
      <div className="mx-auto w-[220px] rounded-[2rem] border-[6px] border-[#1f2937] bg-[#0f1a2b] p-4 shadow-[0_30px_70px_rgba(0,0,0,0.45)]">
        <div className="grid grid-cols-3 gap-4 pt-4">
          {["#3f8cff", "#f08c28", "#7c6cf2", "", "#d6409f", "#14a5b8"].map((colour, index) =>
            colour ? (
              <span key={index} className="mx-auto h-11 w-11 rounded-xl opacity-60" style={{ background: colour }} />
            ) : (
              <span key={index} className="relative mx-auto">
                <img src="/greenmail-app/icon-192.png" alt="" className="h-11 w-11 rounded-xl shadow-lg" />
                <span className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">3</span>
              </span>
            ),
          )}
        </div>
        <p className="mt-2 text-center text-[10px] text-white/70">Green Mail · yourbusiness.com</p>
        <div className="mt-6 h-1 w-16 rounded-full bg-white/40 mx-auto" />
      </div>
    ),
  },
];

function FeatureTour() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const tour = TOUR[active];

  // Gently cycles until the visitor picks a feature themselves.
  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % TOUR.length), 6500);
    return () => window.clearInterval(timer);
  }, [paused]);

  // On phones the tabs scroll sideways: keep the active one in view (the strip only, never the page).
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const strip = stripRef.current;
    const tab = strip?.children[active] as HTMLElement | undefined;
    if (!strip || !tab || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollTo({ left: tab.offsetLeft - strip.clientWidth / 2 + tab.clientWidth / 2, behavior: "smooth" });
  }, [active]);

  const pick = (index: number) => {
    setPaused(true);
    setActive(index);
  };

  return (
    <div className="mt-12 grid gap-8 lg:grid-cols-[320px_1fr] lg:items-start">
      <div ref={stripRef} role="tablist" aria-label="Green Mail features" className="relative flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        {TOUR.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`gm-tab-${item.id}`}
            aria-selected={index === active}
            aria-controls="gm-tour-panel"
            onClick={() => pick(index)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowRight") pick((index + 1) % TOUR.length);
              if (event.key === "ArrowUp" || event.key === "ArrowLeft") pick((index - 1 + TOUR.length) % TOUR.length);
            }}
            className={`relative flex shrink-0 items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 text-left transition ${index === active ? "border-primary/60 bg-primary/10 text-white" : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/25 hover:text-white"}`}
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${index === active ? "bg-primary text-[#031006]" : "bg-white/5 text-white/70"}`}>
              <item.icon className="h-[18px] w-[18px]" />
            </span>
            <span className="whitespace-nowrap text-sm font-black">{item.label}</span>
            {index === active && !paused && (
              <motion.span key={`bar-${active}`} className="absolute bottom-0 left-0 h-0.5 bg-primary" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 6.5, ease: "linear" }} />
            )}
          </button>
        ))}
      </div>

      <div id="gm-tour-panel" role="tabpanel" aria-labelledby={`gm-tab-${tour.id}`} className="relative overflow-hidden rounded-3xl border border-white/10 p-6 sm:p-8" style={{ background: "radial-gradient(circle at 85% 10%, rgba(155,234,22,0.18), transparent 45%), linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))" }}>
        <AnimatePresence mode="wait">
          <motion.div key={tour.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }} className="grid gap-8 md:grid-cols-[1fr_minmax(0,300px)] md:items-center">
            <div>
              <h3 className="text-2xl font-black text-white sm:text-3xl">{tour.title}</h3>
              <p className="mt-3 text-base leading-7 text-white/65">{tour.body}</p>
              <ul className="mt-5 grid gap-3">
                {tour.points.map((point) => (
                  <li key={point} className="flex gap-3 text-sm leading-6 text-white/80">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> {point}
                  </li>
                ))}
              </ul>
            </div>
            <div>{tour.preview}</div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ---------- Page content ---------- */

/** Every feature, grouped — the "all the cool features" section. */
const FEATURE_GROUPS: Array<{ icon: LucideIcon; title: string; features: string[] }> = [
  {
    icon: Inbox,
    title: "Inbox & reading",
    features: [
      "Unread counts on Inbox and Starred",
      "Search, plus All / Unread / Flagged / Attachments views",
      "Select many emails: delete, archive, spam, read or unread",
      "Empty Spam and Trash in one click",
      "Download attachments; inline pictures shown in place",
      "Internet images blocked until you allow them",
      "\u201cNew email\u201d alerts with an Open button",
      "Unread count in the browser tab and on the app icon",
    ],
  },
  {
    icon: Send,
    title: "Writing & sending",
    features: [
      "Rich text: bold, lists, quotes and links",
      "Cc and Bcc, with contact suggestions as you type",
      "Up to 10 attachments per email",
      "Forward with the original attachments",
      "Replies open with the cursor ready to type",
      "Signatures with your logo or photo",
      "Drafts saved to finish later",
      "Send later: tomorrow morning, Monday or any time",
    ],
  },
  {
    icon: Bot,
    title: "AI assistant",
    features: ["Summarise any email", "Draft a professional reply", "Pull out the action items", "Translate to Yoruba", "Ask anything about the email you're reading"],
  },
  {
    icon: CalendarDays,
    title: "Organise your day",
    features: ["Calendar with today's agenda beside your mail", "Tasks with due dates", "Colourful, pinnable notes", "Contacts saved automatically", "Folders and Archive"],
  },
  {
    icon: Workflow,
    title: "Automate & reach out",
    features: [
      "Filters: move, star, mark read or delete",
      "Vacation reply with start and end dates",
      "Automatic replies to chosen emails",
      "Forward a copy to a colleague",
      "Templates with {{first_name}} placeholders",
      "Campaigns with progress, test sends and unsubscribe links",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Access & peace of mind",
    features: [
      "Open it at yourbusiness.com/greenmail",
      "Installs as an app on Android, iPhone, Windows and Mac",
      "Works beautifully on phones",
      "Same mailbox in Outlook and phone mail apps",
      "Encrypted, private sign-in",
      "Confirmation before anything is deleted",
    ],
  },
];

const FEATURE_COUNT = FEATURE_GROUPS.reduce((sum, group) => sum + group.features.length, 0);

const SECURITY: Array<[LucideIcon, string, string]> = [
  [EyeOff, "Tracking pixels blocked", "Images from the internet stay hidden until you choose to show them, so senders can't secretly see when you open their email."],
  [ShieldCheck, "Emails shown safely", "Every message is cleaned and displayed in a locked-down frame, so scripts and booby-trapped links in an email can't run."],
  [LockKeyhole, "Private sign-in", "Your browser only holds a temporary key. Your password stays encrypted on our server and sessions end after inactivity."],
  [Sparkles, "Spam stays out", "Spam is filtered before it reaches you. Filters and automatic replies never act on spam."],
];

const STEPS: Array<[string, string]> = [
  ["Get NAI TALK hosting", "Every web hosting and Website Care plan includes business email, and Green Mail comes with it at no extra cost."],
  ["Create your mailbox", "In the client area, open your hosting service, go to Email Accounts and create info@ or any address you like."],
  ["Open Green Mail", "Visit yourbusiness.com/greenmail, or click Open mail in the client area. Sign in with the email address and its password."],
];

const FAQ_ITEMS = [
  { question: "Is Green Mail really free?", answer: "Yes. Green Mail is included with every NAI TALK web hosting and Website Care plan at no extra cost. You only pay for your hosting plan; there is no per-user fee for Green Mail." },
  { question: "How do I open Green Mail?", answer: "Go to yourdomain.com/greenmail (for example yourbusiness.com/greenmail) or click Open mail next to a mailbox in the NAI TALK client area. Sign in with your full email address and its password." },
  { question: "Can I use Green Mail on my phone?", answer: "Yes. It works in any modern phone browser, and you can install it like an app. On Android or a computer, use the Install app button; on iPhone, tap Share, then Add to Home Screen." },
  { question: "Can I still use Outlook, Apple Mail or my phone's mail app?", answer: "Yes. Green Mail works alongside them because it uses the same mailbox. Anything you send, read, move or delete shows the same everywhere, and filters and vacation replies apply to all of them." },
  { question: "Do I need my own domain name?", answer: "Yes. Green Mail is for business email on your own domain (like info@yourbusiness.com). You can register a domain with NAI TALK in minutes, or use one you already own." },
  { question: "How many email accounts can I have?", answer: "That depends on your hosting plan. Every account you create can use Green Mail; the client area shows how many accounts your plan includes." },
  { question: "Is the AI assistant safe to use?", answer: "The assistant only reads an email when you ask it to, and it never sends anything by itself. It drafts; you review and decide what to send." },
  { question: "Are there limits on campaigns?", answer: "To protect your domain's reputation, campaigns send up to 20 emails a minute and 500 a day per mailbox, to at most 1,000 people per campaign. Every campaign email includes an unsubscribe link." },
  { question: "What happens to my email if I stop using Green Mail?", answer: "Nothing. Your email lives in your mailbox, not in Green Mail, so it stays available in any other mail app, and in classic webmail too." },
];

const GUIDES: Array<[string, string]> = [
  ["How to sign in to Green Mail", "how-to-sign-in-to-green-mail"],
  ["How to check (pick up) your emails", "how-to-check-your-emails-in-green-mail"],
  ["How to send an email", "how-to-send-an-email-in-green-mail"],
  ["How to reply to and forward emails", "how-to-reply-to-and-forward-emails"],
  ["How to set up filters and a vacation reply", "how-to-set-up-email-filters-and-a-vacation-reply"],
  ["How to set up your email on your phone or Outlook", "how-to-set-up-your-email-on-your-phone-or-outlook"],
];

/** Fades content in just before it scrolls into view (skipped when the visitor prefers less motion). */
const Reveal: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({ children, delay = 0, className = "" }) => {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <div className={className}>{children}</div>;
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "0px 0px 160px 0px" }} transition={{ duration: 0.35, delay }} className={className}>
      {children}
    </motion.div>
  );
};

function TypedDomain() {
  const domains = ["yourbusiness.com", "elinthhomes.com", "adeolabakery.ng", "yourschool.edu.ng"];
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % domains.length), 2600);
    return () => window.clearInterval(timer);
  }, [domains.length]);
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 font-mono text-sm text-white sm:text-base">
      <LockKeyhole className="h-4 w-4 text-primary" />
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={domains[index]} className="inline-block min-w-[17ch] text-right" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
          {domains[index]}
        </motion.span>
      </AnimatePresence>
      <span className="text-primary">/greenmail</span>
    </span>
  );
}

export function GreenMailPage() {
  const stats = useGreenmailStats();
  const faqJsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ_ITEMS.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })),
    }),
    [],
  );
  const productJsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Green Mail",
      applicationCategory: "CommunicationApplication",
      operatingSystem: "Web, Android, iOS, Windows, macOS",
      description: "Webmail for business email on your own domain — with an AI assistant, calendar, tasks, notes, templates, campaigns, filters and automation. Included free with NAI TALK web hosting.",
      url: "https://www.naitalk.com/green-mail",
      offers: { "@type": "Offer", price: "0", priceCurrency: "NGN", description: "Included with every NAI TALK hosting plan" },
      publisher: { "@type": "Organization", name: "NAI TALK", url: "https://www.naitalk.com" },
    }),
    [],
  );
  useJsonLd("jsonld-greenmail-faq", faqJsonLd);
  useJsonLd("jsonld-greenmail-product", productJsonLd);

  return (
    <PublicPage>
      <PublicBreadcrumbs items={[{ label: "Web Hosting", href: "/web-hosting" }, { label: "Green Mail" }]} dark />

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: `radial-gradient(circle at 78% 20%, rgba(155,234,22,0.2), transparent 42%), radial-gradient(circle at 10% 90%, rgba(155,234,22,0.08), transparent 40%)` }}>
        <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:px-8 lg:pt-14">
          <div>
            <motion.span initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-[11px] font-black uppercase tracking-wide text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Free with every NAI TALK hosting plan
            </motion.span>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mt-6">
              <Wordmark />
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-6 text-4xl font-black leading-[1.08] text-white sm:text-5xl lg:text-[56px]">
              Business email that works as hard as you do.
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-5 max-w-xl text-lg leading-8 text-white/68">
              Green Mail is the beautiful, fast webmail for your own domain. It has an AI assistant, calendar, tasks, templates, campaigns and automation built in, and it's included at no extra cost when you host with NAI TALK.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Cta href={HOSTING_HREF} label="Get hosting with Green Mail" section="greenmail_hero" />
              <Cta href={OPEN_HREF} label="Open Green Mail" section="greenmail_hero" secondary icon={Inbox} />
            </motion.div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/65">
              {["No extra fee", "Phone & desktop", "Installs like an app", "Your own domain"].map((item) => (
                <li key={item} className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> {item}</li>
              ))}
            </ul>
          </div>

          <motion.div initial={{ opacity: 0, y: 24, rotate: -1 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: 0.15, duration: 0.6 }} className="relative mx-auto w-full max-w-[620px] lg:mr-0">
            <InboxPreview />
            <FloatingCard className="-left-3 bottom-10 hidden w-[230px] sm:block" delay={0.6}>
              <p className="flex items-center gap-1.5 text-[11px] font-black text-slate-900"><Bot className="h-4 w-4" style={{ color: GM.green }} /> AI summary</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-600">Bolarinwa approves the design and wants a gallery page before launch.</p>
            </FloatingCard>
            <FloatingCard className="-right-2 -top-5 hidden items-center gap-2 !py-2.5 sm:flex" delay={1}>
              <BellRing className="h-4 w-4" style={{ color: GM.green }} />
              <span className="text-[11px] font-bold text-slate-800">New email from Paystack</span>
            </FloatingCard>
            <FloatingCard className="-bottom-5 left-[38%] hidden items-center gap-2 !py-2.5 md:flex" delay={1.4}>
              <Languages className="h-4 w-4" style={{ color: GM.green }} />
              <span className="text-[11px] font-bold text-slate-800">Translated to Yoruba</span>
            </FloatingCard>
          </motion.div>
        </div>
      </section>

      {/* Live counters */}
      <section className="border-y border-white/8 bg-white/[0.02]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 md:grid-cols-4 lg:px-8">
          {([
            [<CountUp value={stats?.businesses ?? null} suffix="+" />, "businesses use Green Mail"],
            [<CountUp value={stats?.mailboxes ?? null} suffix="+" />, "mailboxes on Green Mail"],
            [<CountUp value={FEATURE_COUNT} suffix="+" />, "features built in"],
            ["₦0", "extra on any hosting plan"],
          ] as Array<[React.ReactNode, string]>).map(([value, label]) => (
            <Reveal key={label} className="text-center">
              <p className="text-4xl font-black text-primary sm:text-5xl">{value}</p>
              <p className="mt-1.5 text-xs font-bold uppercase tracking-wide text-white/55">{label}</p>
            </Reveal>
          ))}
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
          <p className="mb-4 text-center text-xs font-bold uppercase tracking-wide text-white/45">Trusted by growing brands</p>
          <GreenmailBrandStrip />
        </div>
      </section>

      {/* Feature tour */}
      <section className="pub-section-dark">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">Take the tour</span>
            <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">More than an inbox</h2>
            <p className="mt-3 text-base leading-7 text-white/62">Green Mail brings your email, your schedule and your busywork together. Click through to see what's inside.</p>
          </Reveal>
          <FeatureTour />
        </div>
      </section>

      {/* Your domain */}
      <section className="pub-section-tint-dark border-y border-white/8">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-3xl text-center">
            <span className="eyebrow">Your brand, front and centre</span>
            <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">Your email lives at your own address</h2>
            <p className="mt-3 text-base leading-7 text-white/62">
              No generic login page. Your team opens Green Mail on your own website, and the installed app always goes back to it.
            </p>
            <div className="mt-8"><TypedDomain /></div>
          </Reveal>
          <ol className="mt-14 grid gap-4 md:grid-cols-3">
            {STEPS.map(([title, description], index) => (
              <Reveal key={title} delay={index * 0.08}>
                <li className="pub-card-dark h-full list-none">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-base font-black text-[#031006]">{index + 1}</span>
                  <h3 className="mt-4 text-lg font-black text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/62">{description}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Every feature */}
      <section className="pub-section-dark">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">Every feature</span>
            <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">{FEATURE_COUNT} features. One app. No extra cost.</h2>
            <p className="mt-3 text-base leading-7 text-white/62">Everything Green Mail does, at a glance.</p>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURE_GROUPS.map((group, index) => (
              <Reveal key={group.title} delay={(index % 3) * 0.06}>
                <div className="group h-full rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:-translate-y-1 hover:border-primary/40 hover:bg-primary/[0.04]">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/35 bg-primary/10 text-primary transition group-hover:scale-105">
                      <group.icon className="h-5 w-5" />
                    </span>
                    <h3 className="text-lg font-black text-white">{group.title}</h3>
                    <span className="ml-auto rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-bold text-white/55">{group.features.length}</span>
                  </div>
                  <ul className="mt-5 grid gap-2.5">
                    {group.features.map((feature) => (
                      <li key={feature} className="flex gap-2.5 text-sm leading-6 text-white/72">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="relative overflow-hidden border-y border-white/8" style={{ background: `linear-gradient(160deg, ${GM.navy}, #07111f)` }}>
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8">
          <Reveal>
            <span className="eyebrow">Private by design</span>
            <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">Safe from the things that make email risky</h2>
            <p className="mt-4 text-base leading-7 text-white/62">
              Business email is a target. Green Mail is built to quietly protect you from trackers, harmful messages and stolen sessions, without you changing a setting.
            </p>
            <div className="mt-8 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <MonitorSmartphone className="h-8 w-8 shrink-0 text-primary" />
              <p className="text-sm leading-6 text-white/70">Works with Outlook, Apple Mail and phone mail apps too, using the same mailbox, the same folders and the same rules.</p>
            </div>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            {SECURITY.map(([Icon, title, description], index) => (
              <Reveal key={title} delay={index * 0.06}>
                <div className="h-full rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                  <Icon className="h-6 w-6 text-primary" />
                  <h3 className="mt-3 text-base font-black text-white">{title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-white/60">{description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ + guides */}
      <section className="pub-section-dark">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.4fr_0.9fr] lg:px-8">
          <div>
            <span className="eyebrow">FAQ</span>
            <h2 className="mt-4 text-3xl font-black text-white">Green Mail questions, answered</h2>
            <div className="mt-8">
              <FaqAccordionGroup dark items={FAQ_ITEMS} />
            </div>
          </div>
          <aside className="lg:pt-16">
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
              <h3 className="flex items-center gap-2 text-lg font-black text-white"><FileText className="h-5 w-5 text-primary" /> Step-by-step guides</h3>
              <p className="mt-1 text-sm text-white/55">From our knowledge base</p>
              <ul className="mt-5 grid gap-1">
                {GUIDES.map(([title, slug]) => (
                  <li key={slug}>
                    <a href={`/knowledge-base/${slug}`} className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-white/80 transition hover:bg-white/5 hover:text-white">
                      {title} <ArrowRight className="h-4 w-4 shrink-0 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                    </a>
                  </li>
                ))}
              </ul>
              <a href="/knowledge-base" className="mt-4 inline-block px-3 text-xs font-bold text-primary hover:underline">Browse the knowledge base →</a>
            </div>
          </aside>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <Reveal className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-[2rem] p-8 text-center sm:p-14">
          <div className="absolute inset-0 -z-10" style={{ background: `radial-gradient(circle at 20% 0%, rgba(${LIME.glow},0.35), transparent 50%), radial-gradient(circle at 90% 100%, rgba(${LIME.glow},0.18), transparent 45%), linear-gradient(135deg, #142406, #050b03)` }} />
          <img src="/greenmail-app/badge-128.webp" alt="" width={64} height={64} className="mx-auto rounded-2xl shadow-xl" />
          <h2 className="mt-6 text-3xl font-black text-white sm:text-4xl">Give your business the email it deserves</h2>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-white/75">Host your website with NAI TALK and Green Mail comes with it: your domain, your brand, and a smarter inbox, at no extra cost.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Cta href={HOSTING_HREF} label="See hosting plans" section="greenmail_footer_cta" />
            <Cta href="/domain-registration" label="Register a domain" section="greenmail_footer_cta" secondary icon={Globe2} />
          </div>
        </Reveal>
      </section>
    </PublicPage>
  );
}
