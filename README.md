<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Kurodot (Black-Dot) 3D 策展平台 & AI 策展助手 🎨🤖

本儲存庫包含了 Kurodot.io 平台的前端應用程式（React + Three.js）、Vercel Serverless APIs，以及為參加 **Gemini Live Agent Challenge** 所開發的獨立 AI 策展助手後端。

## 📁 1. 專案核心架構與資源

- **前端 3D 引擎**: 基於 React (`@react-three/fiber`) 開發，負責渲染數位孿生的虛擬 3D 展覽空間。
- **展場編輯器 (`components/editor/`)**: 也就是 FloorPlan Editor，提供創作者在線上即時調整燈光 (Lighting)、佈局 (Layout)、視野 (Scene) 與設定藝術品細節的介面。
- **資料庫與檔案存儲 (`firebase.ts`)**: 結合 Firebase Firestore (儲存展覽 `exhibitions`、區域 `zones`、藝術品 `artworks` 資料)、Storage（存放 3D 與貼圖資產）與 Auth（身分驗證）。
- **無伺服器 API (`api/`)**: 可直接部署於 Vercel 的 Node.js 函式。包含能抓取乾淨展場小冊資料、並整合 Umami 成效追蹤與流量的對外 API（如 `api/exhibit.js`）。

---

## 🤖 2. 關於 AI 策展助手 (Gemini Live Agent Challenge)

為參與黑客松比賽 (Creative Storyteller 類別)，專案在 `ai-agent-challenge/` 目錄中導入了 **Google Gemini 1.5 Pro** 驅動的 **Kurodot Phygital Chronicler (KPC)** 代理。

### ✨ 運作流程與功能亮點
- **多模態輸入與交錯輸出 (Interleaved Multimodal)**: 使用者在前端編輯器點擊 **「AI Report」** 時，前端會擷取 **3D 畫布目前的截圖影像**，連同展覽名稱與資料，封裝後送往 Agent 伺服器。
- **生成專業展覽 PDF**: Gemini 接到多模態內容後，會辨識畫面中的視覺構圖、解讀作品細節，產生結構化的「展場評論」與建議。後台收到結果會直接將其寫入 **PDF 報告**，回傳給網頁端觸發下載。
- **遙測與監控技術展示 (Telemetry Support)**: 為了證明 Agent 具備商業架構穩定度，伺服器內建了 `@google-cloud/logging` 與 Google Cloud Storage 的串接邏輯。每次呼叫都會將生成耗時 (Latency)、錯誤與多模態標記即時送往 GCP 儀表板，完美契合 Hackathon 對於 Agent Architecture 的要求。

### 🛠️ 如何啟動這支 AI Agent？
這是一支獨立的 Node.js 伺服器（不依賴 Vite）。
1. 進入目錄：`cd ai-agent-challenge`
2. 安裝套件：`npm install`
3. 準備金鑰：在該目錄下建立 `.env` 檔案，填入：`GEMINI_API_KEY=你的Gemini金鑰`
4. 啟動伺服器：`npm start` (啟動後會運行在 `localhost:8080`)
5. 前端測試：在主要 Vite 前端運行時，開啟畫面上的 `EXHIBIT EDITOR`，點擊右上角藍色的「**AI Report**」按鈕，即可觸發截圖並經歷自動生成 PDF 的完整流程！

---

## 🚀 3. 如何在本機端運行主要前端 (Run Locally)

**開發環境必備:** Node.js

1. 於儲存庫根目錄安裝依賴：
   `npm install`
2. 設定專案環境變數 (`.env` 或 `.env.local`)：
   您需要填寫前端用的 Firebase 環境變數來使畫面正常顯示。
3. 執行開發模式：
   `npm run dev`

---

## 🌐 4. 關於 Serverless API (exhibit.js)

在專案 `/api` 資料夾內的指令碼支援了 Vercel API 路由：
- **提取展覽包 API (`api/exhibit.js`)**：只需呼叫 `/api/exhibit?id=<展覽ID>`，就能無須前端龐大物件，直接取得「展覽資訊」、「所有參與的藝術品細節(包含簡歷、媒材)」。
- **結合 Umami 數據追蹤**：此 API 也整合了向 Umami Cloud 撈取數據的邏輯（撈取展場過去一年的總流量 `stats`），並將它與作品資料合併回傳。

---

## 🏖️ 5. Sandbox Mode

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
