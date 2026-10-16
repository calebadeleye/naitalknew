import { useEffect, useState } from "react";

/*
 * Green Mail as an installable app (PWA), and which website it belongs to.
 *
 * Someone arriving from calebadeleye.com/greenmail gets ?domain=calebadeleye.com.
 * That domain (and, after signing in, their address) is remembered on the
 * device, and the install manifest is requested for it — so the installed app
 * always opens to calebadeleye.com's sign-in, not a generic one.
 */
const DOMAIN_KEY = "greenmail_domain";
const EMAIL_KEY = "greenmail_last_email";

const cleanDomain = (value: string | null | undefined) =>
  (value || "").toLowerCase().replace(/^www\./, "").replace(/[^a-z0-9.-]/g, "").slice(0, 100);

const read = (key: string) => {
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
};

const write = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the app still works, it just won't remember.
  }
};

/** The website this Green Mail belongs to: from the link, else remembered on this device. */
export function currentDomain(): string {
  const fromLink = cleanDomain(new URLSearchParams(window.location.search).get("domain"));
  if (fromLink) {
    write(DOMAIN_KEY, fromLink);
    return fromLink;
  }
  return cleanDomain(read(DOMAIN_KEY));
}

export function rememberSignIn(email: string): void {
  const address = email.trim().toLowerCase();
  write(EMAIL_KEY, address);
  const domain = cleanDomain(address.split("@")[1]);
  if (domain) write(DOMAIN_KEY, domain);
}

/** The last address signed in on this device, if it belongs to this website. */
export function rememberedEmail(domain: string): string {
  const email = read(EMAIL_KEY);
  return email && (!domain || email.endsWith(`@${domain}`)) ? email : "";
}

/** Adds the manifest, theme colour and Apple icons for Green Mail, and registers the service worker. */
export function useGreenmailAppShell(domain: string): void {
  useEffect(() => {
    const added: HTMLElement[] = [];
    const add = (tag: "link" | "meta", attributes: Record<string, string>) => {
      const element = document.createElement(tag);
      Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
      document.head.appendChild(element);
      added.push(element);
    };

    // Only Green Mail's manifest may be on the page, or "Install" would install
    // the main NAI TALK site instead (the server already swaps it in production).
    // Phones: shrink the page when the keyboard opens (Android), so the
    // composer's Send button isn't left hidden behind it.
    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    const originalViewport = viewport?.content ?? null;
    // maximum-scale=1 stops iPhone Safari zooming in when a text box is tapped
    // (pinch-to-zoom still works), which otherwise pushes Send off screen.
    if (viewport && !/interactive-widget/.test(viewport.content)) viewport.content = `${viewport.content}, maximum-scale=1, interactive-widget=resizes-content, viewport-fit=cover`;

    const siteManifests = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="manifest"]'));
    siteManifests.forEach((link) => link.remove());
    add("link", { rel: "manifest", href: `/greenmail/manifest.webmanifest${domain ? `?domain=${encodeURIComponent(domain)}` : ""}` });
    add("meta", { name: "theme-color", content: "#15803d" });
    add("link", { rel: "apple-touch-icon", href: "/greenmail-app/apple-touch-icon.png" });
    add("meta", { name: "apple-mobile-web-app-capable", content: "yes" });
    add("meta", { name: "apple-mobile-web-app-title", content: "Green Mail" });
    add("meta", { name: "apple-mobile-web-app-status-bar-style", content: "default" });

    // Green Mail's own tab icon while it's open.
    const icons = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
    const previous = icons.map((icon) => icon.href);
    icons.forEach((icon) => (icon.href = "/greenmail-app/favicon-32.png"));

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/greenmail-sw.js", { scope: "/greenmail" }).catch(() => undefined);
    }

    return () => {
      added.forEach((element) => element.remove());
      siteManifests.forEach((link) => document.head.appendChild(link));
      icons.forEach((icon, index) => (icon.href = previous[index]));
      if (viewport && originalViewport !== null) viewport.content = originalViewport;
    };
  }, [domain]);
}

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/**
 * Whether "Install app" can be offered. Chrome/Edge/Android hand us their own
 * install prompt; iPhone/iPad Safari has none, so we show instructions instead.
 */
export function useInstall() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(
    () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
  );
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const done = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", done);
    };
  }, []);

  const install = async (): Promise<"prompted" | "ios"> => {
    if (prompt) {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setPrompt(null);
      return "prompted";
    }
    return "ios";
  };

  return { canInstall: !installed && (prompt !== null || isIos), isIos, install };
}
