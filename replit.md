# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## StarLight Mobile App (artifacts/starlight)

Expo ~54 / React Native 0.81.5 / expo-router ~6 BLE mesh communication platform.

### Features completed
- **Mesh tab** — BLE peer messaging, AES-256-CBC E2E encryption toggle, status bar with E2E badge
- **Radar tab** — GPS radar map (lat/lon → XY projection), animated sweep, node tap selection, Precision Finder card (RSSI log-distance → ft/m distance, bearing arrow, signal bars, accuracy bar)
- **Voice tab** — pattern-matched AI voice commands, expo-speech TTS, TURBO/LITE AI mode badge (reads `Device.totalMemory` via expo-device)
- **Settings (Node) tab** — encryption toggle, Secure Vault Sync card (WiFi-gated AES-256 blob upload, auto-sync toggle, last-sync time, bytes uploaded counter)

### Key files
- `context/BleContext.tsx` — BLE state, peers, messages, encryption
- `context/LocationContext.tsx` — GPS location
- `hooks/usePrecisionFinder.ts` — RSSI → distance/bearing
- `hooks/useCloudSync.ts` — WiFi-gated encrypted sync (simulated)
- `utils/crypto.ts` — AES-256-CBC via Web Crypto
- `utils/deviceAI.ts` — Device.totalMemory → TURBO/LITE mode
- `app/(tabs)/map.tsx` — Radar + Precision Finder
- `app/(tabs)/voice.tsx` — Voice + AI mode badge
- `app/(tabs)/settings.tsx` — Settings + Secure Vault Sync
