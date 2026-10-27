# Naitalk Call for businesses

Naitalk Call is the LiveKit media server on mail.naitalk.com (`naitalk-call.service`,
config `/etc/naitalk-call/livekit.yaml`, installed by `cradle/deploy/livekit/install.sh`).
This folder holds the tools for selling it to businesses. Cradle is the first customer.

## What is where

| Piece | Where |
|---|---|
| Public page with the plans | `/naitalk-call` (`src/pages/NaitalkCallPage.tsx`) |
| Plans | `backend/config/naitalk_call.php`: Free (testing, 5,000 participant-minutes), Starter $20 (50,000), Growth $49 (200,000), Business $99 (500,000) |
| Naira prices | Dollar price × the Central Bank of Nigeria official rate (US DOLLAR central rate from `cbn.gov.ng/api/GetAllExchangeRates`), whole naira. Fetched at 10:00 and 16:00 by `naitalk-call:fetch-cbn-rate`, or from the admin with **Refresh CBN rate**. A failed fetch keeps the last good rate. |
| Public address for apps | `wss://call.naitalk.com` (site web86, user `naitalk2call`; rules in `call.naitalk.com.htaccess`). Only `/rtc` is proxied; the room API (`/twirp`) is not. |
| Onboarding businesses (key and secret, plan, status, minutes) | Admin → **Naitalk Call → Call Businesses** (`src/admin/NaitalkCallPanel.tsx`) |
| Records | `naitalk_call_tenants` (secrets encrypted), `naitalk_call_usage_events` |
| Server pulls keys and routes | `GET /api/v1/internal/naitalk-call/config` (Bearer `NAITALK_CALL_SYNC_TOKEN`) |
| Key sync (root, every 5 min) | `sync.mjs` → `naitalk-call-sync.timer` |
| Webhook router | `router.mjs` → `naitalk-call-router.service` on 127.0.0.1:7890 |

### How a new key reaches livekit.yaml

The web app never writes root files. `sync.mjs` runs as root on the server. It pulls
active keys from the Naitalk API and rewrites only the block between
`# BEGIN/END naitalk-call managed keys` under `keys:`. Every other line stays
byte-for-byte, including Cradle's key. Keys that would clash with an unmanaged
key, or that contain anything other than letters, digits, `-` and `_`, are skipped.
LiveKit only reads keys at start, so the script restarts `naitalk-call`. A restart
drops live calls, so the script first asks LiveKit how many people are in calls.
If anyone is, it reports `deferred` and tries again on the next run. It backs up
the config before each change (`livekit.yaml.bak-*`, last 10 kept), and if the
service does not come back up it restores the backup. The admin page shows each
run's result under **Server sync**.

Suspending a business removes its key at the next sync, and its webhooks stop
at once. Cradle's key is kept on the server (`key_source = server`), so it
can't be rotated or removed from the admin page.

### Webhook isolation

LiveKit has a single global `webhook.urls`. The sync points it at the router,
which:

- checks LiveKit's signature (made with `webhook.api_key`, which is Cradle's key);
- sends each event only to the business whose **room prefix** matches (`acme-…` → Acme).
  The longest prefix wins, so `acme-labs-…` goes to Acme Labs;
- forwards Cradle's events (`cradle-call-…`) unchanged, with LiveKit's original
  signature, to `http://127.0.0.1:4300/v1/calls/webhook`, exactly as before.
  Cradle needs no change;
- re-signs every other business's events with **that business's own key**, so
  they verify them with the standard LiveKit `WebhookReceiver` and their own secret;
- drops events for rooms no business owns, and answers 502 when a delivery
  fails so LiveKit retries.

### Usage metering

The router passes every `participant_left` event to
`POST /api/v1/internal/naitalk-call/events`. That event carries `joinedAt` and the
time the participant left, so each one becomes participant-seconds for the
business whose prefix matches. Event ids are unique, so retries are not
counted twice. The admin page shows **minutes this month** per business. This
is best-effort: if Naitalk's API is down when someone leaves, that leave is
not counted.

## ⚠️ Read before onboarding a second business

**A LiveKit key is not limited to one business's rooms.** Anyone holding a valid
key can mint tokens for *any* room name and can call the room API (list rooms,
remove participants, close rooms) on every room on the server. That includes
Cradle's. Room prefixes keep webhooks and billing apart, but they do not stop a
business with its own key from reaching another business's calls.

This is fine for businesses Naitalk trusts. Before selling to the public, pick one of these:

1. **Token gateway (recommended).** Businesses get a Naitalk API key, not a LiveKit
   one. Their server asks Naitalk for a join token; Naitalk checks that the room
   starts with their prefix and signs the token with a key only Naitalk holds.
   Room admin calls go through the gateway the same way.
2. **One LiveKit process per business.** Separate configs, ports and keys. This is
   full isolation, but it costs more memory and firewall ports on a 3-vCPU box.

## Server steps (not done yet; run them when you're ready)

1. **Deploy naitalknew** as usual (`deploy.sh`). It runs the migration, which also
   records Cradle as the first business.
2. **Make a sync token** and add it to the Laravel `.env` on the web host:
   ```bash
   openssl rand -hex 32
   ```
   ```
   NAITALK_CALL_SYNC_TOKEN=<that value>
   NAITALK_CALL_PUBLIC_URL=wss://call.naitalk.com
   ```
   then `php artisan config:cache`.
3. **Set the USD→NGN rate** under Admin → Domain Pricing → settings if it is not set.
   The Naira price on `/naitalk-call` stays hidden until a rate is set.
4. **Install the tools on mail.naitalk.com:**
   ```bash
   scp -r deploy/naitalk-call root@mail.naitalk.com:/root/naitalk-call/tools
   ```
   ```bash
   ssh root@mail.naitalk.com
   cd /root/naitalk-call/tools && bash install.sh          # creates /etc/naitalk-call/sync.env
   nano /etc/naitalk-call/sync.env                        # paste the same token
   node /opt/naitalk-call/sync.mjs --dry-run              # shows the change, secrets masked
   bash install.sh                                        # starts the router, first sync, timer
   ```
   The first real sync adds the (still empty) managed block, points `webhook.urls`
   at the router and restarts `naitalk-call`, waiting until no one is in a call.
5. **Check it:**
   ```bash
   journalctl -u naitalk-call-sync -n 20 --no-pager
   journalctl -u naitalk-call-router -f                   # make a Cradle call: expect "… → cradle: 200"
   ```
   The admin page should show Server sync: **applied**, then **unchanged** every 5 minutes.
6. **Public address for other businesses** (done 2026-10-27). `call.naitalk.com` is an
   ISPConfig site with Let's Encrypt; `call.naitalk.com.htaccess` is its `.htaccess`:
   ```bash
   scp deploy/naitalk-call/call.naitalk.com.htaccess naitalk2call@mail.naitalk.com:/var/www/clients/client4/web86/web/.htaccess
   ```
   A real token validates through `https://call.naitalk.com/rtc/validate`.
7. **Naira prices.** After a deploy, fetch the CBN rate once instead of waiting for the schedule
   (as the site user, in `web9/web/backend`): `php artisan naitalk-call:fetch-cbn-rate`.

**Undo:** `systemctl disable --now naitalk-call-sync.timer naitalk-call-router`, copy the
newest `/etc/naitalk-call/livekit.yaml.bak-*` over `livekit.yaml`, then `systemctl restart naitalk-call`.

## Onboarding a business

Admin → Naitalk Call → Call Businesses → **Onboard a business**: enter the name,
contact email, room prefix (filled in from the name) and, optionally, their
webhook URL. The secret is shown **once**. Send the business:

- `LIVEKIT_URL=wss://call.naitalk.com`, plus the key and secret (**Copy as .env**);
- that every room name must start with `<prefix>-`;
- that webhooks arrive signed with their own key.

New businesses start on Starter; pick another plan in the form or later in the
table, where each business's minutes this month show against its plan's
allowance (yellow from 80%, red from 100%). Going over doesn't cut calls off.

The key works within 5 minutes, or once current calls end. There is no payment
integration yet: invoice the plan price (or its Naira amount) from Admin → Invoices.
