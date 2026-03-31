# Operate1 Mobile Agent — Roadmap

## Purpose
A lightweight monitoring agent for iOS and Android devices (phones, tablets) that reports device health to the Operate1 dashboard, mirroring what the desktop `Operate1.exe` agent does for PCs and servers.

## Core Features
- Device registration with Supabase backend
- Periodic heartbeats (battery, storage, network status, OS version)
- Push notification support for alerts
- Background execution (respecting OS battery/background limits)
- MDM-compatible deployment (Apple DEP, Android Enterprise)

## Recommended Stack
- **React Native** (single codebase for iOS + Android)
- **Expo** for simplified build/deploy pipeline
- **@supabase/supabase-js** for backend communication (same API as desktop agent)
- **expo-device** / **expo-battery** / **expo-network** for device metrics
- **expo-notifications** for push alerts
- **expo-task-manager** + **expo-background-fetch** for background heartbeats

## Architecture
```
┌─────────────────────┐
│   Mobile Agent App   │
│  (React Native/Expo) │
├─────────────────────┤
│  Registration        │  → POST to worker-register edge function
│  Heartbeat (bg)      │  → POST to worker-heartbeat edge function
│  Device metrics      │  → battery, storage, network, OS version
│  Push notifications  │  → Supabase Realtime or FCM/APNs
└────────┬────────────┘
         │ HTTPS
         ▼
┌─────────────────────┐
│   Supabase Backend   │
│  (same as desktop)   │
└─────────────────────┘
```

## Data Points (mobile-specific)
| Metric | Source | Notes |
|---|---|---|
| Battery level | expo-battery | % and charging state |
| Storage free | expo-file-system | Available vs total |
| Network type | expo-network | wifi / cellular / none |
| OS version | expo-device | e.g. iOS 18.2, Android 15 |
| Device model | expo-device | e.g. iPhone 16, Pixel 9 |
| App version | expo-constants | Agent version tracking |

## Background Execution Constraints
- **iOS**: Background fetch is limited to ~15 min intervals (OS-controlled). Use silent push notifications for more frequent updates.
- **Android**: WorkManager for reliable background tasks. Minimum interval ~15 min. Foreground service possible for real-time monitoring.
- Both platforms aggressively kill background apps to save battery. Design for infrequent heartbeats (every 15-30 min) rather than the 30s desktop interval.

## Deployment
- **iOS**: TestFlight for internal testing → App Store or enterprise distribution (Apple Business Manager)
- **Android**: Internal testing track on Google Play → Production or managed Google Play for enterprise
- **MDM**: Both platforms support managed app config (AppConfig) to pre-fill Supabase URL and registration key during deployment

## Estimated Scope
| Phase | Work | Timeline |
|---|---|---|
| 1. Scaffold | Expo project, Supabase client, registration flow | 1-2 days |
| 2. Heartbeat | Background fetch, device metrics collection | 2-3 days |
| 3. UI | Status screen, registration wizard, settings | 1-2 days |
| 4. Push | Notification setup (FCM/APNs via Supabase) | 1 day |
| 5. Testing | Device testing, battery impact assessment | 2-3 days |
| 6. Distribution | App Store / Play Store submission | 1-2 days |

## Prerequisites
- Apple Developer account ($99/year) for iOS distribution
- Google Play Developer account ($25 one-time) for Android distribution
- Supabase project already configured (same backend as desktop agent)

## Database Changes Required
- Add `platform` column to `devices` table: `'windows' | 'macos' | 'linux' | 'ios' | 'android'`
- Add `battery_level` and `network_type` columns to `device_heartbeats` table
- Dashboard UI update to show mobile-specific metrics
