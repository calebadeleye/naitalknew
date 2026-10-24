# Green Mail on Google Play (GitHub Actions)

Workflow: [`.github/workflows/greenmail-play.yml`](../.github/workflows/greenmail-play.yml)
builds a signed Android App Bundle (`.aab`) and uploads it to Google Play. The bundle is also
kept as a downloadable artifact on the run. (The APK workflow, `greenmail-android.yml`, is
separate: it publishes an installable APK as a GitHub Release for direct testing.)

## What the app already meets

- Package `com.naitalk.greenmail`, target SDK 36 (Expo SDK 58), 64-bit, App Bundle, release
  signed (never debug-signed; the workflow fails if it would be).
- Only the permissions it uses: internet, notifications and vibrate. Camera, microphone,
  storage, biometrics, overlay, boot and badge permissions are blocked in `app.json`
  (photos are picked with the system photo picker).
- `allowBackup` is off, so tokens are never copied to cloud backups. The app only talks to
  `https://www.naitalk.com` over TLS.
- Adaptive icon, notification icon, dark mode, portrait, accessibility labels on controls.
- Privacy policy link inside the app (Settings → About).
- No ads, no tracking SDKs, no in-app purchases, no account creation inside the app (the
  "Create Account" button opens the website), so Play's account-deletion rule does not apply.

## One-time setup (Play Console)

1. **Create the app**: Play Console → Create app → name `Green Mail`, default language
   English, App, Free. Accept the declarations.
2. **App signing**: the first upload enrols the app in Play App Signing. The key in
   `mobile/keystores/greenmail-release.p12` (same one as the APK) becomes the *upload key*.
   Keep it backed up: losing it means asking Google to reset the upload key.
3. **Complete the store listing and policy forms**, using [STORE-LISTING.md](STORE-LISTING.md):
   description, screenshots (at least 2 phone screenshots, 16:9–9:16), the 512×512 icon, a
   1024×500 feature graphic, privacy policy URL, App access (give Google the test mailbox),
   Content rating, Target audience (18+ / not for children), Data safety, Ads: none.
4. **First release by hand**: Release → Testing → Internal testing → Create release → upload
   the `.aab` from a workflow run (Actions → Green Mail Play Store → Run workflow with
   *Upload* unticked → download the artifact `greenmail-play-bundle`). Google's API cannot
   create a brand-new app, so this first upload must be manual.
5. **Service account for GitHub**: Play Console → Setup → API access → create (or link) a
   Google Cloud project → Create service account → in Cloud Console give it a JSON key →
   back in Play Console, *Invite user* with that service account's email and the permission
   **Release to production, exclude devices, and use Play App Signing** (or *Release manager*).
6. **Add the secret**: GitHub repo → Settings → Secrets → `PLAY_SERVICE_ACCOUNT_JSON` = the
   whole JSON file. From a terminal:
   `gh secret set PLAY_SERVICE_ACCOUNT_JSON -R calebadeleye/naitalknew < service-account.json`

The Android signing secrets (`GREENMAIL_ANDROID_KEYSTORE_BASE64`, `GREENMAIL_RELEASE_STORE_PASSWORD`)
are already in the repo.

## Releasing

- Actions → **Green Mail Play Store** → Run workflow: pick the track (`internal` first), status
  (`completed`, or `draft` while the listing is unfinished) and leave *Upload* ticked; or
- `git tag greenmail-play-v1.0.0 && git push origin greenmail-play-v1.0.0`.

Each build gets `versionCode = 1000 + run number`, so it always goes up. Raise the
marketing version in `app.json` (`expo.version`) for user-visible releases. Move a build from
internal testing to production in Play Console (Promote release) or run the workflow with
track `production`. A new personal developer account must first run a closed test with 12
testers for 14 days before production access; an organisation account does not.
