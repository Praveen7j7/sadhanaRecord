# Play Store shell (Trusted Web Activity)

Built 16 October 2026. **The AAB carries no copy of the app.** It is a shell that opens the live site full
screen, so every web release reaches every phone with no Play Store upload.

## The file to upload

    tools/store/twa/build/outputs/bundle/release/twa-release.aab      (578 KB)

| | |
|---|---|
| Package name | `org.iyfdelhi.sadhana` |
| Version | 1.0.0 (versionCode 2) — Play Console release name: `1.0.0 (2)` |
| Opens | `https://sadhana-record.iyfdelhi-sadhana.workers.dev/` |
| Min / target Android | 7.0 (API 24) / Android 16 (API 36) |

## THE KEYSTORE — read this before anything else

    tools/store/sadhana-release.jks          the signing key
    tools/store/keystore-password.txt        its password

**Both are gitignored and exist in exactly one place: this Mac.**

- **Lose them and the app can never be updated again.** Google rejects an upload signed with a different
  key. The only way back is a new listing under a new package name, and every devotee reinstalling.
- **Leak them and someone else can publish as you.**

Copy both files somewhere safe today — a password manager, or an encrypted backup that is not this laptop.
Do it before you upload, not after.

RSA 4096, valid to 2053. Fingerprint:

    SHA256: 9F:A5:CE:53:28:1D:38:3A:6D:DA:D0:AF:87:29:5C:F9:80:67:8A:84:3D:3B:F3:82:E9:76:72:5D:F7:7E:63:F7

## What needs a NEW upload, and what does not

**Does not** — any screen, wording, fix, new feature, server change, migration, the whole of phases 7–10.
The shell loads the live site; it checks hourly and whenever it comes back on screen, and swaps over without
interrupting anyone mid-save.

**Does** — the app's name, icon, permissions, the target SDK (Google raises the minimum roughly yearly),
**or the URL**. See the warning below.

## Minimum Android 7.0, not 5.0

Google refuses an upload below API 24: "Play automatic protection requires a minimum SDK version of 24 or
higher." The first build used 21 and was rejected at the upload box. Do not lower it again.

Phones older than Android 7 cannot install the app. That is a small and shrinking share, and there is no
alternative — the requirement is Google's.

## The two things Play said at upload

**Error, and it blocks you:** "Your app currently targets API level 34 and must target at least API level
36." Fixed — `compileSdk` and `targetSdk` are 36. Google raises this roughly every year, so expect to raise
it again: install the new platform with `sdkmanager`, change the two numbers, rebuild. NOTE: the bundled
`cmdline-tools` (version 20) is too old to SEE API 36 in its catalogue; a current one was used. If a future
level is missing from `--list`, that is why.

**Warning, and it does not block you:** "There is no deobfuscation file associated with this App Bundle."
That warning is for apps that obfuscate their code and then cannot read their own crash reports. This shell
does not obfuscate (`minifyEnabled false`) — it is a small amount of our own code plus the Android Browser
Helper library, with nothing to shrink and nothing to make unreadable. There is no mapping file to upload.
Ignore it.

## The domain, and why it matters

The shell is locked to `sadhana-record.iyfdelhi-sadhana.workers.dev`. Moving to IYF's own domain later means:

1. a new Play Store upload (the URL is compiled in), **and**
2. **every devotee signed out, with unsaved drafts lost** — sessions and drafts live in browser storage
   belonging to the origin, and a new origin is a different box.

`workers.dev` is also shared infrastructure, so Digital Asset Links verification may not hold. If it does
not, the app still works but shows a thin address bar at the top. That is cosmetic, not broken.

The head chose to ship on this address rather than wait. The cost of changing later is above.

## Asset links

`frontend/public/.well-known/assetlinks.json` is live and serving (HTTP 200, `application/json`). It carries
the fingerprint above. **If you ever regenerate the keystore, this file must be updated to match** or the
app will show the address bar.

## Rebuilding

    cd tools/store
    export JAVA_HOME=../devices/jdk/Contents/Home
    export ANDROID_HOME=../devices/android-sdk
    export SR_KEYSTORE="$PWD/sadhana-release.jks"
    export SR_STORE_PASS=$(cat keystore-password.txt)
    export SR_KEY_PASS="$SR_STORE_PASS" SR_KEY_ALIAS=sadhana
    ./gradle-8.7/bin/gradle :twa:bundleRelease --no-daemon

Raise `versionCode` in `twa/build.gradle` AND in `twa/src/main/AndroidManifest.xml` for every upload —
the two must agree, and Google rejects a repeat.

**A fix that seems not to work is usually this.** Play reports problems against the bundle it is HOLDING, not
the file you last built. Re-uploading with the same `versionCode` does not replace the bundle already attached
to a draft release, so the old complaint stays on screen — the console says which one it means, in small
capitals: "1 MESSAGE FOR VERSION CODE 1". Before concluding the build is wrong, read that line, then check the
file itself:

    java -jar bundletool.jar dump manifest --bundle twa/build/outputs/bundle/release/twa-release.aab \
      | grep -oE 'android:(versionCode|targetSdkVersion|minSdkVersion)="[^"]*"'

If those numbers are right, the build is right: raise the version code, remove the old file from the draft
release, and upload again.

## iPhone

There is no TWA on iOS. The plan is a WKWebView shell, which also loads the live site, so updates still
flow. Expect more friction at review: Apple sometimes rejects apps that are only a website wrapper.
Notifications there need the app added to the Home Screen first, which the app already explains.
