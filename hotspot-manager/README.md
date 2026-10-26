# Hotspot Manager (Android)

A lightweight Android app project for Android 8+; designed for a TCL Android 14 phone.

## Current features
- Local device list with editable labels, IP addresses, data limits, and manually entered usage.
- Best-effort read of the device's local ARP table to find IP/MAC entries.
- Shortcut to Android hotspot/network settings.
- Local-only storage; no account, server, analytics, or subscription.
- GitHub Actions workflow builds a debug APK.

## Important Android limitation
On stock Android 14, an ordinary third-party app is not granted privileged tethering APIs. The app cannot reliably enumerate every Wi-Fi hotspot client, identify its actual phone model, measure each client's true data usage, enforce per-client data caps, or force-disconnect a selected client. The ARP scan is best-effort and may return no clients. The data limits and usage fields in this version are local reminders only, not network-enforced limits. Use the phone's built-in Hotspot settings to inspect or block clients if the TCL firmware provides those controls.

## Build
Open the repository's Actions tab and run **Build Hotspot Manager APK**, or push a change under hotspot-manager/. Download the hotspot-manager-debug-apk artifact from a successful workflow run. This is a debug APK for personal testing, not a Play Store release.

## Package
com.amine.hotspotmanager
