# Offline Video Player

An offline-first, mobile-friendly HTML/CSS/JavaScript media player packaged for Android with Capacitor. The app keeps imported media and preferences in local browser storage; it does not require an account or send media to a server.

## Build an Android APK with GitHub Actions

1. Open the **Actions** tab in this repository and enable Actions if GitHub asks.
2. Select **Build Android APK** and click **Run workflow**, or push a commit to `main`.
3. Open the completed workflow run and find the **Artifacts** section.
4. Download `offline-video-player-debug-apk`, extract it, then install `app-debug.apk` on your Android device. This is a debug build for testing, not a Play Store release.

The workflow is located at `.github/workflows/build-apk.yml`.

## Included features

- Import local video and audio files, including multi-select and folder selection where supported
- Playback, seeking, previous/next, playback speed, repeat, shuffle, and saved progress
- Favorites, recent items, search, sorting, grid/list view, and playlists
- Dark/light theme, accent color, subtitle file loading, sleep timer, audio-only presentation, and touch gestures
- Local IndexedDB storage and no app account or analytics

## Limitations

- Codec support depends on Android WebView and the device's media decoders. File extensions alone do not guarantee playback.
- The app stores copies of imported files. Removing an item from the app does not delete the original file.
- Native background playback services, Android Picture-in-Picture, system-wide media indexing, native brightness/volume gestures, and other advanced native-player features are not fully implemented in this web baseline.
- Browser storage can be cleared by Android or by clearing app/site data. Keep original media files if they matter.

## Local development

Requires Node.js 20+ and Android Studio/Android SDK.

```sh
npm install
npx cap add android
npx cap sync android
npx cap open android
```
