<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1Uqc_LDgzoFJilBq--qzBfHFoVFW9_79_

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

---

## Sandbox Mode

Sandbox mode allows visitors to experiment with scene overrides (theme, gravity, lighting) that are stored locally in `localStorage` and never written back to Firebase.

### Activation Rules

`effectiveSandboxMode` is `true` when **any** of the following conditions is met:

| # | Condition | Where defined |
|---|-----------|---------------|
| 1 | URL contains `?sandbox=true` | `App.tsx` → `isSandboxMode` |
| 2 | Viewer is a **guest** (not the owner) **AND** the exhibition `status` is `"past"` | `useMuseumState.ts` → `effectiveSandbox` |
| 3 | The **Firestore exhibition doc ID** (`activeExhibition.id`) is in `SANDBOX_EMBED_EXHIBITION_IDS` **AND** the page is in **embed mode** | `useMuseumState` → `embedSandboxExhibitionIds` param |

> Rule 3 is matched against the real Firestore document ID — **not** any URL parameter. This is stable across deploys and domain changes. The check happens inside `useMuseumState` so the internal localStorage overrides (theme/gravity/lighting) are also correctly applied.

### Embed Whitelist (`SANDBOX_EMBED_EXHIBITION_IDS`)

The following exhibitions activate sandbox mode whenever they are rendered inside an embed (`embedMode === true`), regardless of the viewer's identity or the exhibition status:

| Exhibition ID | URL |
|---------------|-----|
| `bauhaus-blueprint-qevdv` | https://www.fu-design.com/exhibition/bauhaus-blueprint-qevdv |

> To add a new entry, append the exhibition ID to the `SANDBOX_EMBED_EXHIBITION_IDS` array near the top of `App.tsx`.

### localStorage Keys

Sandbox overrides are keyed per exhibition + zone:

| Key pattern | Content |
|-------------|---------|
| `sandbox_theme_{exhibitionId}_{zoneId}` | `{ zone_theme: string }` |
| `sandbox_gravity_{exhibitionId}_{zoneId}` | `{ zone_gravity: number }` |
| `sandbox_lighting_{exhibitionId}_{zoneId}` | `SimplifiedLightingConfig` partial |
