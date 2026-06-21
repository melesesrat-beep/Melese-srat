import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    geminiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return geminiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse incoming JSON payloads with higher limit for base64 ID photos
  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ limit: "20mb", extended: true }));

  // API router for status check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // AI-powered ID Card Scanner and OCR Parser
  app.post("/api/scan-id", async (req, res) => {
    const { frontImage, backImage } = req.body;

    if (!frontImage) {
      return res.status(400).json({ success: false, error: "የመታወቂያው የፊት ፎቶ ያስፈልጋል! (Front ID image is required)" });
    }

    console.log("[Scan-ID] Processing incoming ID scan request...");

    try {
      const ai = getGeminiClient();
      const contents: any[] = [];

      // Helper to strip data URL prefix if exists
      const cleanBase64 = (str: string) => {
        if (str.includes(",")) {
          return str.split(",")[1];
        }
        return str;
      };

      contents.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: cleanBase64(frontImage)
        }
      });

      if (backImage) {
        contents.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: cleanBase64(backImage)
          }
        });
      }

      contents.push({
        text: `You are an expert Amharic document parser and OCR processor for Ethiopian Resident ID Cards (Woreda Resident ID Cards). 
Analyze the provided ID card image(s) (front and optionally back). 
Extract the following information inside the ID:
1. Resident Name (የነዋሪው ሙሉ ስም / ስም): Search for words following 'ስም' or 'ሙሉ ስም'. It must be in Amharic. Look carefully at Amharic handwriting or print text.
2. House Number (የቤት ቁጥር): Search for 'የቤት ቁጥር' or 'ቤት ቁጥር'. Extract it as a string (can be numbers or letters like 'አዲስ', 'የለም', etc.).
3. Phone Number (የስልክ ቁጥር / ስልክ): Search for 'ስልክ' or 'ስልክ ቁጥር' or 'phone'. Ensure it's returned as a clean digital phone format (e.g. 09xxxxxxxx or +2519xxxxxxxx). If none found, write "".
4. Resident Registration Number or ID number (የነዋሪነት የምዝገባ ቁጥር / የመለያ ቁጥር / ተ.ቁ / የመታወቂያ ቁጥር): Look for 'የምዝገባ ቁጥር', 'የመለያ ቁጥር', 'መለያ ቁጥር', 'ተ.ቁ', 'ID No', 'መታወቂያ ቁጥር' or any unique reference numbers on the ID card. Extract it.

CRITICAL INSTRUCTIONS:
- You MUST extract the name and other textual values ONLY in Amharic (አማርኛ) characters if they are written in Amharic on the card.
- Write numbers using standard Arabic digits (0-9).
- Return empty string "" for any field you absolutely cannot locate or read. Do not invent fake data.
- Be careful with Amharic handwriting (የእጅ ጽሑፍ). Process it with ultra-high precision.`
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: contents },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "የነዋሪው ሙሉ ስም በፊደል (e.g. ካሳሁን በቀለ)" },
              houseNumber: { type: Type.STRING, description: "የቤት ቁጥር (e.g. 450/B, 108, or 'አዲስ')" },
              phone: { type: Type.STRING, description: "የስልክ ቁጥር (e.g. 0911223344 or '')" },
              idNumber: { type: Type.STRING, description: "የነዋሪነት የምዝገባ ወይም የመታወቂያ ቁጥር (e.g. W05-0071408 or 12450)" },
            },
            required: ["name", "houseNumber", "phone", "idNumber"],
          },
        }
      });

      const resultText = response.text;
      console.log("[Scan-ID] Gemini API parser JSON reply:", resultText);

      if (!resultText) {
        return res.status(500).json({ success: false, error: "ኤይአይ መልስ መስጠት አልቻለም (Empty translation reply)" });
      }

      const parsedData = JSON.parse(resultText.trim());
      return res.json({
        success: true,
        data: parsedData
      });

    } catch (err: any) {
      console.error("[Scan-ID] Error in processing Gemini scan:", err);
      
      // Check if GEMINI_API_KEY is unset or invalid
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
          success: false,
          error: "የጌሚኒ ኤይአይ የይለፍ ቁልፍ (GEMINI_API_KEY) አልተዋቀረም! እባክዎ በቅንብሮች (Settings > Secrets) ውስጥ 'GEMINI_API_KEY' ያስገቡ።"
        });
      }

      return res.status(500).json({
        success: false,
        error: `የመታወቂያው OCR ምዝገባ አልተሳካም (AI Scanner Error): ${err.message || err}`
      });
    }
  });

  // Secure Proxy API for dispatching SMS bypasses browser CORS locks
  app.post("/api/send-sms", async (req, res) => {
    const { url, apiKey, sender, to, message } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: "የኤስኤምኤስ ጌትዌይ URL አልተገለጸም! (SMS Gateway URL is required)" });
    }
    if (!to || !message) {
      return res.status(450).json({ success: false, error: "የስልክ ቁጥር ወይም የጽሑፍ መልዕክቱ ይዘት ባዶ ነው! (Fields 'to' & 'message' are required)" });
    }

    console.log(`[SMS-Proxy] Dispatching SMS to ${to} via gateway ${url}`);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // Add appropriate authorization API headers if key is provided
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['X-API-Key'] = apiKey;
        headers['api_key'] = apiKey;
        headers['apikey'] = apiKey;
      }

      // Perform the server-to-server request
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          to: to,
          phone: to,
          number: to,
          recipient: to,
          phoneNumber: to,
          message: message,
          msg: message,
          text: message,
          from: sender || "BOLE-W05", // AfroMessage brand refers to sender ID as 'from'
          sender: sender || "BOLE-W05" // Fallback for other providers that use 'sender'
        })
      });

      const responseStatus = response.status;
      const responseText = await response.text().catch(() => '');

      console.log(`[SMS-Proxy] Gateway returned status ${responseStatus}: ${responseText}`);

      if (!response.ok) {
        return res.status(responseStatus >= 200 && responseStatus < 300 ? 500 : responseStatus).json({
          success: false,
          status: responseStatus,
          error: `ጌትዌዩ ስራውን አልተቀበለም: Status Code ${responseStatus}`,
          detail: responseText
        });
      }

      return res.json({
        success: true,
        status: responseStatus,
        detail: responseText
      });

    } catch (err: any) {
      console.error(`[SMS-Proxy] Network crash during gateway fetch:`, err);
      return res.status(500).json({
        success: false,
        error: `ከጌትዌዩ አገልጋይ ጋር መገናኘት አልተቻለም (Network Crash):\n${err.message || err}`
      });
    }
  });

  // Vite middleware for rendering and serving SPA assets in dev module
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server starting smoothly and running on port ${PORT}`);
  });
}

startServer();
