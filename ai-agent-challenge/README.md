# Kurodot Phygital Chronicler (KPC) 
*An entry for the Gemini Live Agent Challenge 2026*

**Category:** Creative Storyteller ✍️

## Summary
The **Kurodot Phygital Chronicler (KPC)** is an AI-powered curatorial agent that bridges the gap between physical exhibitions and digital storytelling. Built on top of the Kurodot.io 3D exhibition engine, the KPC observes the digital twin of an art exhibition alongside real-time user prompts. 

By leveraging the **Gemini 1.5 Pro Interleaved Output**, the agent takes in visual snapshots of the 3D space, user intent, and live exhibition metadata to seamlessly weave together a comprehensive, multimodal PDF report. This report includes a curated visual critique, historical data analysis, and digital recommendation—generated on the fly and persisted securely in Google Cloud Storage.

Furthermore, KPC implements complete **Telemetry Support** using Google Cloud Logging. Every generative action, latency metric, and multimodality flag is piped seamlessly into a dashboard, proving robust Agent Architecture.

## Architecture & Tech Stack

1. **Model Intelligence:** Google GenAI SDK (`@google/genai`) utilizing `gemini-1.5-pro` for interleaved image-text reasoning.
2. **Backend Engine:** Node.js / Express hosted on **Google Cloud Run**.
3. **Telemetry & Observability:** Google Cloud Logging (`@google-cloud/logging`) captures Agent thought-processes, duration metrics, and error states.
4. **Storage:** Google Cloud Storage (`@google-cloud/storage`) for persisting the dynamically generated AI exhibition PDF reports.

## Spin-up Instructions

### Prerequisites
- Node.js > 18.x
- A Google Cloud Project with Billing Enabled.
- A valid `GEMINI_API_KEY`.

### Local Development
1. Clone this repository and navigate to the `ai-agent-challenge` folder.
2. Run `npm install`
3. Create a `.env` file in the root with the following:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   # Optional for local test:
   # GCS_BUCKET_NAME=your_gcs_bucket_name
   # GOOGLE_APPLICATION_CREDENTIALS=path/to/service/account.json
   ```
4. Run `npm start`.
5. Send a POST request to `http://localhost:8080/api/generate-report` containing the payload required by the agent.