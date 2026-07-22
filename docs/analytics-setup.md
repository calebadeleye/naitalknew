# Google Analytics 4 / Google Tag Manager Setup

The frontend pushes events into `window.dataLayer` (see [src/lib/analytics.ts](../src/lib/analytics.ts)). It never talks to Google directly and never needs an API key, OAuth secret, service-account file, or Measurement Protocol secret — all of that stays inside the GTM/GA4 dashboards below.

## 1. Create a GA4 property

1. Go to [Google Analytics](https://analytics.google.com) → **Admin** → **Create Property**.
2. Name it (e.g. "NAITALK") and fill in timezone/currency (NGN).
3. Finish the business-details wizard.

## 2. Create a GA4 web data stream

1. In the new property, go to **Data streams** → **Add stream** → **Web**.
2. Website URL: `https://www.naitalk.com`.
3. Name the stream and create it.

## 3. Locate the GA4 Measurement ID

On the stream's detail page, the **Measurement ID** starts with `G-`. Copy it — it's needed inside GTM in step 7, not in the frontend `.env`.

## 4. Create a GTM web container

1. Go to [Google Tag Manager](https://tagmanager.google.com) → **Create Account**.
2. Container name: `naitalk.com`, target platform: **Web**.

## 5. Locate the GTM container ID

Shown at the top of the GTM workspace and in the install snippet — starts with `GTM-`. This is the value that goes into `VITE_GTM_ID`.

## 6. Add `VITE_GTM_ID` to the production environment

In the server's `.env` (same file `server.js`/PM2 already reads):

```
VITE_GTM_ID=GTM-XXXXXXXX
```

Leave it blank (or omit it) to disable analytics entirely — the app detects this and skips loading GTM without errors (see "How the app behaves without a container ID" below).

## 7. Create a Google tag in GTM using the GA4 Measurement ID

1. In GTM: **Tags** → **New** → **Tag Configuration** → **Google Tag**.
2. Paste the `G-XXXXXXXXXX` Measurement ID from step 3.
3. Trigger: **Initialization – All Pages** (GTM's built-in trigger; fires on every `page_view` this app pushes).
4. Save as e.g. "GA4 Configuration".

## 8. Create Custom Event triggers for the React dataLayer events

For each event name the app pushes (see the full list in the project README/report — `page_view`, `contact_form_submit`, `hosting_plan_select`, `purchase`, etc.):

1. **Triggers** → **New** → **Custom Event**.
2. Event name: the exact event string (e.g. `contact_form_submit`). Use "Use regex matching" only if you want to match a family of events (e.g. `.*_click`).
3. Save.

Then create a matching **GA4 Event** tag (Tag Configuration → Google Analytics: GA4 Event → pick the Google tag from step 7 as the "Configuration Tag") for each trigger, forwarding the event and its parameters through.

Event parameters pushed by this app (map these as GA4 event parameters in each tag, or turn on "Send all parameters" style forwarding): `plan_name`, `plan_id`, `billing_cycle`, `currency`, `value`, `domain_extension`, `search_result_count`, `button_text`, `page_section`, `content_title`, `content_slug`, `payment_method`, `transaction_id`.

## 9. Mark important events as key events (GA4's renamed "conversions")

In GA4: **Admin** → **Events** → toggle "Mark as key event" for at least:

- `contact_form_submit`
- `sign_up`
- `checkout_begin`
- `payment_success`
- `purchase`

(GA4 only shows an event here once it's been received at least once — send a test event first via Preview mode below.)

## 10. Test with GTM Preview mode

1. In GTM, click **Preview**, enter `https://www.naitalk.com` (or your local dev URL).
2. Interact with the site — submit the contact form, search a domain, click WhatsApp, etc.
3. In the Tag Assistant panel, confirm each expected tag fires under the "Summary" for that interaction, and check the "Variables"/"Data Layer" tabs for the values pushed.

## 11. Test with GA4 DebugView

1. With GTM Preview connected (step 10) or the [GA Debugger extension](https://chrome.google.com/webstore) enabled, open GA4 → **Admin** → **DebugView**.
2. Events should appear in near-real-time as you interact with the site, with their parameters listed.

## 12. Publish the GTM container

Once tags/triggers are verified in Preview: **Submit** (top-right in GTM) → add a version name/description → **Publish**. Nothing fires in production GA4 until this step.

## 13. Rebuild after environment changes

`VITE_GTM_ID` is baked into `dist/index.html` at build time (Vite's `%VITE_GTM_ID%` HTML replacement), not read at runtime. Any time the env var is added or changed on the server:

```bash
npm run build
pm2 restart naitalk-react   # or whatever the process is named
```

## How the app behaves without a container ID

If `VITE_GTM_ID` is unset when the app is built, `%VITE_GTM_ID%` resolves to an empty string. `index.html`'s inline script initializes `window.dataLayer = []` regardless (so nothing else on the page can error trying to push to it) but returns before requesting `gtm.js`, so no network call is made and no container loads. `src/lib/analytics.ts` independently checks the same env var and no-ops every tracking call when it's missing — so local development without a `.env` entry works exactly as before, with zero analytics traffic and zero errors.

## Full event list

`page_view`, `contact_form_submit`, `contact_form_error`, `hosting_plan_view`, `hosting_plan_select`, `buy_hosting_click`, `domain_search`, `domain_search_result`, `domain_purchase_start`, `signup_start`, `sign_up`, `login`, `login_error`, `checkout_begin`, `payment_success`, `payment_failed`, `purchase`, `whatsapp_click`, `phone_click`, `email_click`, `knowledge_base_view`, `blog_post_view`, `cta_click`, `file_download`, `scroll_depth`.

## Duplicate-tracking audit checklist (dashboard access required)

`index.html` currently loads **two** independent Google tagging mechanisms side by side: the GTM container above (`GTM-...`), and a direct `gtag.js` include configuring `AW-18326410611` (Google Ads) — plus Cloudflare's first-party Tag Gateway proxy at `/ejpi/`, confirmed live in production. This is not necessarily wrong (GTM and a direct Ads `gtag.js` is a common, non-duplicated split — GTM owns GA4, the direct include owns Ads), but it can't be verified from the codebase alone. Whoever has GTM/Cloudflare dashboard access should check:

1. **GTM → Tags**: does any tag already configure `AW-18326410611` (a "Google Ads Conversion Tracking" tag, or a "Google tag" pointed at that ID)?
   - **If yes**: the direct `gtag.js` include in `index.html` (the `<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18326410611">` block and the `gtag('config', 'AW-18326410611')` call right below it) is redundant and doubling the "page viewed" signal sent to Google Ads (visible as a `googleads.g.doubleclick.net/.../viewthroughconversion/...` request firing on every page load). Removing it is a small, contained change — ask for it once confirmed.
   - **If no**: the current split is correct as-is. Nothing to change.
2. **Cloudflare → Tag Gateway / Zaraz settings**: confirm what `/ejpi/` is actually proxying (most likely `gtm.js`, made first-party so ad-blockers don't strip it) and that it isn't loading a *second* independent copy of anything alongside the direct requests already firing.
3. **GTM Preview mode**, run against the live quote form (`/get-a-website`): submit a real test quote and confirm the `AW-18326410611/aBJTCPvXntEcEPOq26JE` conversion tag fires **exactly once** in the Tag Assistant summary. The React-side guard (`src/pages/WebsiteQuotePages.tsx`, `localStorage` + in-memory dedup keyed on the quote's event reference) is already solid — this step is specifically to confirm GTM itself isn't firing a second, independent copy of the same conversion.
