# Green Mail on iPhone (GitHub Actions → TestFlight)

Workflow: [`.github/workflows/greenmail-ios.yml`](../.github/workflows/greenmail-ios.yml).
It works like the Luminary Radio iOS release: `expo prebuild` → `pod install` →
`xcodebuild archive` → export a signed `.ipa` → upload it to App Store Connect. A few
minutes after the upload, the build shows up in **TestFlight**. Install the TestFlight
app on the iPhone to try it.

An App Store build can't be installed straight from a download the way an Android APK
can. On iPhone it always goes through TestFlight, or later the App Store.

## One-time setup

The Apple Developer account, distribution certificate and App Store Connect API key
are the **same ones Luminary uses**. Only the app itself and its provisioning profile
are new.

1. **Register the App ID.** In developer.apple.com, go to Identifiers → **+** → App IDs →
   App → Explicit, and enter `com.naitalk.greenmail` (description: Green Mail). Under
   Capabilities, tick **Push Notifications**.
2. **Create the App Store Connect app record.** Go to Apps → **+** → New App → iOS. Use
   Name `Green Mail` (or `Green Mail by NAI TALK` if the name is taken), Bundle ID
   `com.naitalk.greenmail`, SKU `greenmail-ios`.
3. **Create the provisioning profile.** In developer.apple.com, go to Profiles → **+** →
   App Store Connect. Pick App ID `com.naitalk.greenmail` and the existing **Apple
   Distribution** certificate (the one Luminary uses). Name it `Green Mail App Store`,
   then Generate and Download.
4. **Add the secrets to the `calebadeleye/naitalknew` repository.** In Settings →
   Secrets and variables → Actions, add the secrets below. GitHub never shows a secret
   again after it is saved, so Luminary's can't be copied across. Use the same files
   and values you used there (see Luminary's `mobile/IOS-RELEASE.md`).

   | Secret | Value |
   | --- | --- |
   | `APPLE_TEAM_ID` | Team ID (10 characters) |
   | `ASC_KEY_ID` | App Store Connect API key ID |
   | `ASC_ISSUER_ID` | Issuer ID |
   | `ASC_KEY_P8_BASE64` | `base64 -i AuthKey_XXXX.p8 \| tr -d '\n'` |
   | `IOS_DIST_CERT_P12` | `base64 -i dist.p12 \| tr -d '\n'` |
   | `IOS_DIST_CERT_PASSWORD` | the .p12 password |
   | `GREENMAIL_IOS_PROVISION_PROFILE` | `base64 -i Green_Mail_App_Store.mobileprovision \| tr -d '\n'` |

   From the terminal (inside the repo) it is, for example:
   `gh secret set GREENMAIL_IOS_PROVISION_PROFILE < <(base64 -i Green_Mail_App_Store.mobileprovision | tr -d '\n')`

## Run it

- GitHub → Actions → **Green Mail iOS** → Run workflow (from `main`, once this is
  merged), or
- push a tag: `git tag greenmail-ios-v1.0.0 && git push origin greenmail-ios-v1.0.0`.

The build number defaults to the workflow run number. Each upload needs a higher one,
so if a rerun is rejected as a duplicate, give a bigger number when you start the
workflow.

## Then in App Store Connect

TestFlight → the build → **Internal Testing**: add yourself, and the build appears in
the TestFlight app on your iPhone. Store release is App Store → prepare a version →
pick the build → submit for review.
