# Green Mail — Android & iOS app

The phone app for **Green Mail**, NAI TALK's business webmail. React Native with
[Expo](https://docs.expo.dev) (SDK 58, TypeScript, Expo Router). It talks to the
same API as the web app (`/api/v1/greenmail`, see `src/greenmail/api.ts` in the
web app and `backend/routes/api.php`).

## What it does

- **Welcome / sign in** with a mailbox address and password (optional domain field fills in
  the part after `@`), show/hide password, **forgot password** (6-digit code to the recovery
  email), **several mailboxes** signed in at once with a switcher (drawer and Settings).
  Tokens are kept in the phone's keychain/keystore (`expo-secure-store`).
- **Mail**: folder list with unread counts (drawer), All / Unread / Flagged / Attachments tabs,
  search, pull to refresh, infinite scroll, star, long-press for read/unread, archive, spam,
  delete.
- **Reader**: sandboxed HTML (WebView with a Content-Security-Policy: no scripts, frames or
  forms; remote images blocked until you tap *Show*; links open in the browser),
  attachments (download and share), reply / reply all / forward / delete, and the AI
  assistant (summarise, draft reply, action items, translate to Yoruba — `POST /assistant`).
- **Compose**: From (any signed-in account), To with contact suggestions, Cc/Bcc, subject,
  rich text (bold, italic, underline, lists, links), templates, attach files and photos,
  **schedule send** (`POST /scheduled`), save draft. Drafts autosave on the phone as you type.
- **Calendar** (month + day's events, add/edit/delete), **Tasks** (All / Today / Upcoming /
  Completed, due dates, priority flags), **Notes**, **Templates** (starter templates + your
  own), **Campaigns** (progress; campaigns are created on the web), **Filters** and
  **Automation** (rules on/off, create/edit, out-of-office reply), **Scheduled** emails,
  **Settings** (name, signature, password, recovery email, accounts, notifications, theme).
- **Offline**:
  - Every folder page you load and every message you open is saved in SQLite
    (`greenmail.db`, up to 400 messages per folder per mailbox), so lists, opened
    messages and search work offline (search covers subject, people, preview and the
    text of messages you've opened).
  - Calendar, tasks, notes, templates and folder counts show the last copy when offline.
  - Read / unread, star, move and delete made offline are applied on the phone at once and
    queued.
  - **Outbox**: sending, scheduling or saving a draft while offline (or when the server
    can't be reached) puts it in the outbox with its attachments copied into app storage.
    It is sent when the connection comes back (also every 30 s and when the app returns
    to the front), with backoff. A banner above the mail list shows *Offline*, *Sending N*,
    *N could not be sent* or *signed out*; the Outbox screen lists each item with its error,
    **Try again** and **Discard**, plus drafts kept only on this phone.
- **Push notifications** for new mail (see below).

Not in the app (use the web): building campaigns and their recipient lists, contacts
management, folder management, signature images. Task priority is kept on the phone only
(the API has no priority field yet).

## Run it

```bash
cd mobile
npm install
npx expo start --go      # Expo Go: scan the QR code, or press a (Android) / i (iOS)
```

- `npx expo start` without `--go` opens the **development build** instead (see below);
  press `s` in the terminal to switch between Expo Go and the development build.
- Android emulator: start one from Android Studio (or `emulator -avd <name>`), then press `a`.
- iOS simulator: needs Xcode on a Mac; press `i`.
- Point the app at another server (e.g. a local backend) with
  `EXPO_PUBLIC_GREENMAIL_API=http://10.0.2.2:8000/api/v1/greenmail npx expo start --go`
  (`10.0.2.2` is the host machine from the Android emulator). The default is
  `https://www.naitalk.com/api/v1/greenmail` (`app.json` → `extra.apiBaseUrl`).

Expo Go is enough for everything except push notifications (Expo Go on Android can't
receive them since SDK 53).

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm test            # Jest: API client and offline outbox (src/lib/__tests__)
npx expo-doctor
```

## Builds on GitHub (what we use)

- **Android APK**: `.github/workflows/greenmail-android.yml` runs on every push that
  touches `mobile/` (on `main` and `greenmail-mobile`), or by hand from the Actions tab.
  It type-checks, runs the tests, builds a release APK signed with the Green Mail key, and
  publishes it as a **GitHub Release**. To install, open
  <https://github.com/calebadeleye/naitalknew/releases> on the phone, tap the `.apk` in the
  newest "Green Mail for Android" release, and allow installs from the browser. Later builds
  install over it.
  The signing key is `mobile/keystores/greenmail-release.p12`, with its password in
  `mobile/keystores/release.env`. Both are gitignored, and CI gets them from the repo
  secrets `GREENMAIL_ANDROID_KEYSTORE_BASE64` and `GREENMAIL_RELEASE_STORE_PASSWORD`.
  **Back the key up**: if it is lost, phones can't update the app and must reinstall it,
  and the Play Store would need the same key.
- **Google Play**: `.github/workflows/greenmail-play.yml` (signed `.aab` uploaded to Play);
  see [PLAY-STORE-RELEASE.md](PLAY-STORE-RELEASE.md). Listing texts and privacy answers:
  [STORE-LISTING.md](STORE-LISTING.md).
- **iPhone (TestFlight)**: `.github/workflows/greenmail-ios.yml`; one-time setup in
  [IOS-RELEASE.md](IOS-RELEASE.md).

## Builds (EAS, alternative)

One-time setup (an Expo account for NAI TALK):

```bash
npm install -g eas-cli      # or use npx eas-cli@latest
eas login
eas init                    # creates the EAS project and writes extra.eas.projectId into app.json
```

Profiles in `eas.json`:

| Profile | Android | iOS | Use |
| --- | --- | --- | --- |
| `development` | APK with the dev client | simulator build | daily development, push testing |
| `preview` | APK | ad-hoc (registered devices) | testers |
| `production` | AAB for Play Store | App Store build | store release |

```bash
eas build --profile development --platform android
eas build --profile development --platform ios
eas build --profile preview --platform android
eas build --profile production --platform all
eas submit --platform android   # / ios — needs Play Console / App Store Connect access
```

App ids: `com.naitalk.greenmail` on both platforms. iOS builds need an Apple Developer
account; EAS creates the certificates and the push key when asked.

## Push notifications

1. `eas init` (so `extra.eas.projectId` is set — without it the app quietly skips push).
2. Android: add Firebase (FCM v1) credentials to the EAS project
   (`eas credentials` → Android → Google Service Account for FCM v1), and put the
   `google-services.json` path in `app.json` (`android.googleServicesFile`).
   iOS: let EAS create the APNs key during `eas build`.
3. Install a development or production build, sign in, and allow notifications. The app
   registers its Expo push token for each signed-in mailbox (`POST /push/expo`); Settings →
   Notifications has a **Test** button (`POST /push/expo/test`). Signing out removes it
   (`DELETE /push/expo`).
4. Server side: `greenmail:expo-push-check` runs every minute from the scheduler and sends
   new unread Inbox mail through Expo's push API (`App\Services\Greenmail\ExpoPushNotifications`,
   table `greenmail_expo_push_tokens` — run the migration when deploying).

Tapping a notification switches to that mailbox and opens the message.

`assets/notification-icon.png` is currently the app icon; Android shows notification icons
as a white silhouette, so replace it with a white-on-transparent envelope (96×96) before
release.

## Layout

```
src/app/            screens (Expo Router): (tabs)/ Mail, Calendar, Tasks, More; message, compose,
                    notes, templates, campaigns, rules, scheduled, outbox, settings, sign-in, welcome
src/components/     UI kit, drawer, message row, HTML reader, rich-text editor, toasts, status banner
src/lib/api.ts      API client (errors: SessionExpired / NetworkError / ApiError)
src/lib/outbox.ts   offline queue logic (storage-free; tested)
src/lib/db.ts       SQLite cache: messages, outbox, local drafts, key/value
src/lib/push.ts     Expo push token registration
src/state/          session (accounts, folders, online state, outbox runner) and theme
```
