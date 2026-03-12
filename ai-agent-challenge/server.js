import { GoogleGenAI } from '@google/genai';
import { Logging } from '@google-cloud/logging';
import { Storage } from '@google-cloud/storage';
import { jsPDF } from 'jspdf';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Support large image payloads

// 1. Initialize Google Cloud Telemetry (Logging)
// In production on Cloud Run, it auto-detects credentials.
const logging = new Logging();
const log = logging.log('kpc-agent-log');

// 2. Initialize Gemini SDK
// Requires GEMINI_API_KEY environment variable. 
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 3. Initialize Google Cloud Storage
// Used to store generated PDFs to prove GCP utilization.
const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME || 'kpc-reports-bucket';

/**
 * HELPER: Telemetry Logging
 */
async function recordTelemetry(event, data) {
  const metadata = {
    resource: { type: 'global' },
    severity: 'INFO',
  };
  const entry = log.entry(metadata, { event, timestamp: new Date().toISOString(), ...data });
  await log.write(entry);
  console.log(`[Telemetry] ${event}:`, data);
}

/**
 * CORE ENDPOINT: Generate Phygital Exhibition Report (Interleaved Output)
 */
app.post('/api/generate-report', async (req, res) => {
  const startTime = Date.now();
  const { exhibitInfo, userPrompt, imageBase64 } = req.body;

  await recordTelemetry('GenerateReport_Started', { exhibitId: exhibitInfo?.id || 'unknown' });

  try {
    // 1. Prepare Interleaved Prompt for Gemini
    // Combining text instruction with user intent and optional image data
    let contents = [
      `You are the Kurodot Phygital Chronicler, an expert AI art curator and analyst.`,
      `The user has provided the following exhibition context: ${JSON.stringify(exhibitInfo)}`,
      `User request: ${userPrompt}`,
      `Please output a structured JSON response (strictly format it as JSON) containing:`,
      `1. 'title': A catchy title for this report.`,
      `2. 'analysis': Deep curatorial analysis of the concept.`,
      `3. 'recommendation': Digital collection recommendations for visitors.`,
      `4. 'metadata': Extracted tags and keywords.`
    ];

    // If an image is provided from the 3D scene (Interleaved capability!)
    if (imageBase64) {
      // Remove data UI prefix if it exists
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      contents.push({
        inlineData: {
          data: base64Data,
          mimeType: 'image/png' // Assuming PNG from Three.js canvas
        }
      });
      contents.push(`Also, analyze the visual composition of the attached 3D exhibit snapshot and include a 'visual_critique' field in the JSON.`);
    }

    // 2. Call Gemini 1.5 Pro to handle the multimodal Interleaved request
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-pro',
      contents: contents,
      config: {
        responseMimeType: "application/json",
      }
    });

    const aiOutput = JSON.parse(response.text());
    
    // 3. Generate PDF Report using jsPDF
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(aiOutput.title || "Kurodot AI Exhibition Report", 20, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    
    let yPos = 40;
    const addText = (label, text) => {
        if (!text) return;
        doc.setFont("helvetica", "bold");
        doc.text(`${label}:`, 20, yPos);
        yPos += 7;
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(text, 170);
        doc.text(lines, 20, yPos);
        yPos += (lines.length * 7) + 10;
    };

    addText("Analysis", aiOutput.analysis);
    if (aiOutput.visual_critique) {
        addText("Visual Critique (From Snapshot)", aiOutput.visual_critique);
    }
    addText("Recommendation", aiOutput.recommendation);
    
    // 4. Save PDF to buffer, then to Google Cloud Storage
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    const fileName = `report_${Date.now()}.pdf`;
    
    let publicUrl = "Local Mode - GCS Upload Skipped";
    const pdfBase64 = doc.output('datauristring'); // <-- 新增直接回傳給前端下載的 Base64 格式
    
    // Attempt GCS upload if configured
    if (process.env.GCS_BUCKET_NAME) {
        const file = storage.bucket(bucketName).file(fileName);
        await file.save(pdfBuffer, { contentType: 'application/pdf' });
        await file.makePublic(); // Ensure bucket allows public read if doing this
        publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
    }

    const duration = Date.now() - startTime;
    await recordTelemetry('GenerateReport_Success', { durationMs: duration, fileName, publicUrl });

    // 5. Return success to frontend
    res.json({
      success: true,
      reportUrl: publicUrl,
      pdfBase64: pdfBase64,
      aiData: aiOutput,
      telemetry: {
          latencyMs: duration,
          model: 'gemini-1.5-pro',
          inputMultimodal: !!imageBase64
      }
    });

  } catch (error) {
    console.error("Agent Error:", error);
    await recordTelemetry('GenerateReport_Error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[Kurodot Phygital Chronicler] Agent running on port ${PORT}`);
});