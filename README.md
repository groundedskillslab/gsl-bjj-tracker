# GSL BJJ Tracker — Expo Go Setup Guide

**Train. Measure. Improve. Repeat.**

---

## What you'll need

| Tool | Where to get it |
|---|---|
| Node.js 18+ | https://nodejs.org (download LTS) |
| Expo Go app | App Store (iOS) or Play Store (Android) |
| Your phone on the same Wi-Fi as your computer | — |

---

## Step 1 — Create the project folder

On your computer, open a terminal (Mac: Terminal / Spotlight → "Terminal", Windows: Command Prompt or PowerShell).

```bash
mkdir gsl-bjj-tracker
cd gsl-bjj-tracker
```

---

## Step 2 — Copy the project files

Place these four files inside the `gsl-bjj-tracker` folder:

```
gsl-bjj-tracker/
├── App.js
├── app.json
├── package.json
└── babel.config.js
```

You do **not** need an `assets/` folder to run in Expo Go. If Expo complains about a missing icon, create an empty `assets` folder and add any PNG as `icon.png`.

---

## Step 3 — Install Node.js dependencies

In your terminal (make sure you're inside the `gsl-bjj-tracker` folder):

```bash
npm install
```

This downloads all packages listed in `package.json`. It may take 1–3 minutes. You'll see a `node_modules` folder appear.

---

## Step 4 — Install the Expo CLI (if you haven't already)

```bash
npm install -g expo-cli
```

Or use npx (no install needed):

```bash
npx expo --version
```

If you see a version number, you're good.

---

## Step 5 — Start the development server

```bash
npx expo start
```

You'll see output like this in your terminal:

```
Starting Metro Bundler
────────────────────────────────────────────────
  › Metro waiting on exp://192.168.1.XX:8081
  › Scan the QR code above with Expo Go (Android)
    or the Camera app (iOS)

  › Press a │ open Android
  › Press i │ open iOS simulator
  › Press w │ open web

  › Press r │ reload app
  › Press m │ toggle menu
  › Press ? │ show all commands
```

A QR code will appear in the terminal.

---

## Step 6 — Open on your phone

### iPhone
1. Open the **Camera** app
2. Point it at the QR code in your terminal
3. Tap the banner that says **"Open in Expo Go"**

### Android
1. Open the **Expo Go** app
2. Tap **"Scan QR Code"**
3. Point it at the QR code in your terminal

The app will download and launch. First load takes ~20 seconds.

---

## Step 7 — Using the app

- **First launch** — you'll be prompted to create a profile (name, belt, stripes, gym)
- **Track tab** — tap "Start Session" to begin tracking a roll with live scoring
- **Rolls tab** — view all completed sessions with scores and event logs
- **Comps tab** — create competitions, add rounds, track live match scoring
- **Profiles tab** — switch between multiple athletes; all data is stored separately per profile

All data is saved locally on the device using AsyncStorage. No account or internet needed after install.

---

## Troubleshooting

### "Network request failed" / QR code won't connect
Your phone and computer must be on the **same Wi-Fi network**. If you're on a corporate or guest network that blocks device-to-device traffic, use a mobile hotspot from your phone and connect your computer to it instead.

Alternatively, try tunnel mode:
```bash
npx expo start --tunnel
```
This routes traffic through Expo's servers and works on any network.

### "Cannot find module 'expo'"
Run `npm install` again from inside the project folder.

### "Metro bundler failed to start"
Kill the terminal and run `npx expo start` again. If it persists:
```bash
npx expo start --clear
```
The `--clear` flag resets the bundler cache.

### Android: "Something went wrong"
Tap **"Reload"** in the Expo Go app. If the error persists, check the terminal for the specific error message.

### Fonts not loading (text appears as system font)
This is normal on first load while fonts download. Reload once and they'll be cached.

### "Unable to resolve module @react-native-async-storage/async-storage"
```bash
npx expo install @react-native-async-storage/async-storage
```

---

## Building a standalone app (optional, later)

When you're ready to install the app directly on your phone without Expo Go:

```bash
npx eas build --platform ios
# or
npx eas build --platform android
```

This requires an [Expo account](https://expo.dev) and (for iOS) an Apple Developer account. For now, Expo Go is all you need.

---

## Project structure

```
gsl-bjj-tracker/
├── App.js          ← All app code (components + logic)
├── app.json        ← App name, icon, version config
├── package.json    ← Dependencies
├── babel.config.js ← Transpiler config (required by Expo)
└── node_modules/   ← Installed packages (auto-generated)
```

---

*GSL BJJ Tracker — Built on principles. Trained in practice.*
