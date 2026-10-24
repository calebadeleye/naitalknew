#!/usr/bin/env bash
# Stores the Apple signing material as GitHub Actions secrets for the Green Mail
# iOS workflow, so nobody has to base64-encode and paste each one by hand.
#
#   scripts/set-ios-secrets.sh <folder>
#
# <folder> must contain: AuthKey_XXXX.p8 (App Store Connect API key), a .p12
# (Apple Distribution certificate) and a .mobileprovision (App Store profile for
# com.naitalk.greenmail). It asks for the Team ID, Key ID, Issuer ID and the .p12
# password; nothing is printed or written anywhere except the GitHub secrets.
# Delete the folder afterwards (see IOS-RELEASE.md).
set -euo pipefail
REPO="${GREENMAIL_REPO:-calebadeleye/naitalknew}"
DIR="${1:?usage: set-ios-secrets.sh <folder with the .p8, .p12 and .mobileprovision>}"

one() { local f; f=$(ls "$DIR"/$1 2>/dev/null | head -1); [ -n "$f" ] || { echo "No $1 in $DIR" >&2; exit 1; }; echo "$f"; }
P8=$(one 'AuthKey_*.p8'); P12=$(one '*.p12'); PROFILE=$(one '*.mobileprovision')

read -r -p "Apple Team ID (10 characters): " TEAM
read -r -p "App Store Connect API Key ID (from the AuthKey_XXXX name): " KEYID
read -r -p "App Store Connect Issuer ID (UUID): " ISSUER
read -r -s -p "Password of the .p12: " P12PW; echo

gh secret set APPLE_TEAM_ID -R "$REPO" --body "$TEAM"
gh secret set ASC_KEY_ID -R "$REPO" --body "$KEYID"
gh secret set ASC_ISSUER_ID -R "$REPO" --body "$ISSUER"
base64 -i "$P8" | tr -d '\n' | gh secret set ASC_KEY_P8_BASE64 -R "$REPO"
base64 -i "$P12" | tr -d '\n' | gh secret set IOS_DIST_CERT_P12 -R "$REPO"
printf '%s' "$P12PW" | gh secret set IOS_DIST_CERT_PASSWORD -R "$REPO"
base64 -i "$PROFILE" | tr -d '\n' | gh secret set GREENMAIL_IOS_PROVISION_PROFILE -R "$REPO"
echo "Done. Secrets now in $REPO:"; gh secret list -R "$REPO"
