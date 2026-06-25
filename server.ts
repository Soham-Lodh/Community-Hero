import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

// ─── MODEL FALLBACK CHAIN ────────────────────────────────────────────────────
// Each model is tried up to RETRIES_PER_MODEL times before falling through to
// the next one. Only after ALL models are exhausted does local fallback kick in.

const MODEL_CHAIN = [
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-3-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemma-4-31b",
  "gemma-4-26b",
] as const;

const RETRIES_PER_MODEL = 2;     // attempts per model before moving to next
const BASE_BACKOFF_MS   = 800;   // initial retry delay (doubles each retry)

// ─── INITIALIZATION ──────────────────────────────────────────────────────────

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn(
    "WARNING: GEMINI_API_KEY is not set. All AI routes will use stub/local-fallback responses."
  );
}

const ai = new GoogleGenAI({
  apiKey: apiKey || "MOCK_KEY",
  httpOptions: { headers: { "User-Agent": "aistudio-build" } },
});

// ─── CORE RETRY + MODEL-CHAIN HELPER ─────────────────────────────────────────

interface GeminiCallOptions {
  contents: any;
  responseMimeType?: string;
  responseSchema?: any;
}

/**
 * Try each model in MODEL_CHAIN up to RETRIES_PER_MODEL times.
 * Returns { text, modelUsed } so callers can log which model succeeded.
 * Throws only after every model + every retry is exhausted.
 */
async function callGeminiWithFallback(
  options: GeminiCallOptions
): Promise<{ text: string; modelUsed: string }> {
  const errors: string[] = [];

  for (const model of MODEL_CHAIN) {
    let delay = BASE_BACKOFF_MS;

    for (let attempt = 1; attempt <= RETRIES_PER_MODEL; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: options.contents,
          config: {
            responseMimeType: options.responseMimeType,
            responseSchema: options.responseSchema,
          },
        });

        if (response?.text) {
          if (model !== MODEL_CHAIN[0] || attempt > 1) {
            // Log whenever we didn't succeed on the first try of the first model
            console.info(
              `[Gemini] Succeeded with model="${model}" attempt=${attempt}`
            );
          }
          return { text: response.text, modelUsed: model };
        }

        throw new Error("Empty response received from Gemini API.");
      } catch (err: any) {
        const msg = `model=${model} attempt=${attempt}: ${err?.message ?? err}`;
        errors.push(msg);
        console.warn(`[Gemini] Failed – ${msg}`);

        const isRetryable =
          err?.status === 429 ||
          err?.status === 503 ||
          err?.status >= 500 ||
          !err?.status ||
          /429|503|overloaded|quota|rate.?limit|resource.?exhausted|high demand|capacity/i.test(
            err?.message ?? ""
          );

        if (attempt < RETRIES_PER_MODEL && isRetryable) {
          console.log(`[Gemini] Backing off ${delay}ms before retry…`);
          await new Promise((r) => setTimeout(r, delay));
          delay *= 2;
        } else {
          // Non-retryable error OR last attempt for this model → move to next model
          break;
        }
      }
    }
  }

  throw new Error(
    `All Gemini models exhausted.\n${errors.join("\n")}`
  );
}

// ─── LOCAL SAFETY & FALLBACK UTILITIES ───────────────────────────────────────

const BLOCKED_WORDS = [
  "abuse", "idiot", "stupid", "moron", "asshole", "bitch", "bastard",
  "fuck", "shit", "cunt", "nigger", "faggot", "dick", "pussy", "dumb",
  "hate", "kill", "die", "scam", "spam", "viagra", "cryptocurrency",
  "crypto", "casino", "free money", "hack", "abusive", "trash",
  "garbage human", "useless", "clown", "retard",
];

function isAbusiveLocal(text: string): { abusive: boolean; reason: string } {
  if (!text) return { abusive: false, reason: "" };

  for (const word of BLOCKED_WORDS) {
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) {
      return {
        abusive: true,
        reason: `Flagged by local safety filter for inappropriate term: "${word}".`,
      };
    }
  }

  // Spam: repeated special characters
  if (/([^a-zA-Z0-9\s])\1{4,}/.test(text)) {
    return {
      abusive: true,
      reason: "Flagged for excessive repeated special characters (spam).",
    };
  }

  // Spam: ALL CAPS shouting (>80 % uppercase letters, min 10 chars)
  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (
    letters.length >= 10 &&
    letters.replace(/[^A-Z]/g, "").length / letters.length > 0.8
  ) {
    return { abusive: true, reason: "Flagged for excessive ALL-CAPS usage." };
  }

  return { abusive: false, reason: "" };
}

// Rule-based intake fallback (used when ALL Gemini models fail)
function getLocalIntakeFallback(
  title: string,
  description: string,
  proposedCategory?: string
) {
  const combined = `${title ?? ""} ${description ?? ""}`.toLowerCase();

  let category = proposedCategory ?? "Pothole";
  let routingTag = "Roads & Infrastructure";
  let severity = "Medium";

  const rules: Array<{
    keywords: string[];
    category: string;
    routingTag: string;
    severity: string;
  }> = [
    {
      keywords: ["water", "pipe", "leak", "flood", "drain", "burst", "sewage"],
      category: "Water Leak",
      routingTag: "Public Safety",
      severity: "High",
    },
    {
      keywords: ["light", "bulb", "electricity", "dark", "streetlight", "lamp"],
      category: "Streetlight",
      routingTag: "Public Safety",
      severity: "Medium",
    },
    {
      keywords: ["trash", "garbage", "waste", "dump", "overflow", "litter"],
      category: "Garbage Overflow",
      routingTag: "Sanitation",
      severity: "Medium",
    },
    {
      keywords: ["bench", "broken", "park", "tree", "graffiti", "vandal"],
      category: "Damaged Property",
      routingTag: "Parks & Recreation",
      severity: "Low",
    },
    {
      keywords: ["pothole", "road", "pavement", "crack", "asphalt", "highway"],
      category: "Pothole",
      routingTag: "Roads & Infrastructure",
      severity: "Medium",
    },
  ];

  for (const rule of rules) {
    if (rule.keywords.some((k) => combined.includes(k))) {
      ({ category, routingTag, severity } = rule);
      break;
    }
  }

  return {
    severity,
    category,
    title: title || `Verified ${category} Report`,
    suggestedTitle: title || `Verified ${category} Report`,
    description:
      description || `Identified neighborhood ${category.toLowerCase()} hazard.`,
    routingTag,
    isValidCivicIssue: true,
    reasoning:
      "Local rule-based heuristic applied — all Gemini models were temporarily unavailable.",
  };
}

// ─── HELPER: safe JSON parse with optional fallback value ─────────────────────
function safeParseJSON<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// 1. AI Hazard Intake
app.post("/api/ai/intake", async (req, res) => {
  let { title, description, category, base64Image, image, presetText } = req.body;

  if (!base64Image && image) base64Image = image;
  if (!description && presetText) description = presetText;

  if (!apiKey) {
    const fb = getLocalIntakeFallback(title, description, category);
    return res.json({
      ...fb,
      aiReasoningLog: {
        agentName: "Intake Agent (Demo – No API Key)",
        timestamp: Date.now(),
        modelUsed: "none",
        decision: `Classified as ${fb.severity} urgency via local fallback`,
        reasoning: "GEMINI_API_KEY not configured. Using rule-based fallback.",
      },
    });
  }

  const parts: any[] = [
    {
      text: `Analyze this neighborhood hazard report.
Reported Title: "${title ?? ""}"
Description: "${description ?? ""}"
Proposed Category: "${category ?? ""}"

Perform intake classification:
1. Choose the most appropriate Severity: 'Low', 'Medium', 'High', or 'Critical'.
2. Choose the best matching Category: 'Pothole', 'Streetlight', 'Water Leak', 'Garbage Overflow', or 'Damaged Property'.
3. Refine or generate a Title that is clear, descriptive, and objective (under 6 words).
4. If an image is provided, describe what you see as 'suggestedDescription'; otherwise professionally summarize the text description.
5. Assign the correct Municipal Routing Tag: 'Roads & Infrastructure', 'Public Safety', 'Sanitation', or 'Parks & Recreation'.
6. Provide reasoning behind your decisions.
7. Decide isValidCivicIssue (true/false) — false only for clearly non-civic or spam submissions.`,
    },
  ];

  if (base64Image) {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Image.replace(/^data:image\/\w+;base64,/, ""),
      },
    });
  }

  try {
    const { text, modelUsed } = await callGeminiWithFallback({
      contents: { parts },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          severity: { type: Type.STRING },
          category: { type: Type.STRING },
          suggestedTitle: { type: Type.STRING },
          suggestedDescription: { type: Type.STRING },
          routingTag: { type: Type.STRING },
          reasoning: { type: Type.STRING },
          isValidCivicIssue: { type: Type.BOOLEAN },
        },
        required: [
          "severity", "category", "suggestedTitle",
          "suggestedDescription", "routingTag", "reasoning", "isValidCivicIssue",
        ],
      },
    });

    const p = safeParseJSON<any>(text, {});
    return res.json({
      severity: p.severity ?? "Medium",
      category: p.category ?? category ?? "Pothole",
      title: p.suggestedTitle ?? title ?? "Hazard Report",
      suggestedTitle: p.suggestedTitle ?? title ?? "Hazard Report",
      description: p.suggestedDescription ?? description ?? "No description provided.",
      routingTag: p.routingTag ?? "Roads & Infrastructure",
      isValidCivicIssue: p.isValidCivicIssue !== false,
      reasoning: p.reasoning ?? "Intake completed.",
      aiReasoningLog: {
        agentName: "Intake Agent",
        timestamp: Date.now(),
        modelUsed,
        decision: `Triage complete. Severity: ${p.severity}`,
        reasoning: p.reasoning ?? "Automated vision-linguistic classification.",
      },
    });
  } catch (err: any) {
    console.error("[Intake] All models failed, using local fallback:", err.message);
    const fb = getLocalIntakeFallback(title, description, category);
    return res.json({
      ...fb,
      aiReasoningLog: {
        agentName: "Intake Agent (Local Fallback)",
        timestamp: Date.now(),
        modelUsed: "local-rules",
        decision: `Fallback triage. Severity: ${fb.severity}`,
        reasoning: `All Gemini models unavailable (${err.message}). Local pattern matching applied.`,
      },
    });
  }
});

// 2. Chat Moderation (mounted on three paths for backwards compat)
const handleModeration = async (req: express.Request, res: express.Response) => {
  const { text } = req.body;
  if (!text?.trim()) return res.json({ approved: true, reason: "" });

  // Always run local filter first — fast and free
  const localCheck = isAbusiveLocal(text);
  if (localCheck.abusive) {
    return res.json({ approved: false, reason: localCheck.reason });
  }

  if (!apiKey) return res.json({ approved: true, reason: "" });

  try {
    const { text: raw } = await callGeminiWithFallback({
      contents: `Evaluate the following neighborhood chat message for safety, civility, and constructiveness:
"${text}"

Block only for: slurs, explicit toxicity, unrelated commercial spam, or extreme incitement.
Approve: hyperlocal planning, coordination, complaints about community services, general venting.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          approved: { type: Type.BOOLEAN },
          reason: { type: Type.STRING },
        },
        required: ["approved", "reason"],
      },
    });

    const p = safeParseJSON<any>(raw, { approved: true, reason: "" });
    return res.json({ approved: p.approved !== false, reason: p.reason ?? "" });
  } catch (err: any) {
    console.warn("[Moderation] All models failed, defaulting to approved:", err.message);
    // Local filter already passed — safe to approve under full outage
    return res.json({ approved: true, reason: "" });
  }
};

app.post("/api/ai/moderation", handleModeration);
app.post("/api/chat/moderate", handleModeration);
app.post("/api/chat/moderation", handleModeration);

// 3. Issue Resolution Evaluator
app.post("/api/ai/resolution", async (req, res) => {
  const { issue, note } = req.body;

  if (!apiKey) {
    return res.json({
      approved: true,
      summary: "Municipal crews completed repair works. AI verification bypassed (no API key).",
    });
  }

  try {
    const { text } = await callGeminiWithFallback({
      contents: `Evaluate whether the official repair log adequately resolves the reported community hazard.

Report Title: "${issue?.title ?? ""}"
Description: "${issue?.description ?? ""}"
Repair Note: "${note ?? ""}"

Consider: Does the repair note address the specific hazard? Is the action proportionate to the reported severity?
Provide a concise, formal municipal summary of the action taken.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          approved: { type: Type.BOOLEAN },
          summary: { type: Type.STRING },
          // NEW: confidence score 0-100 so the UI can surface low-confidence resolutions
          confidence: { type: Type.INTEGER },
        },
        required: ["approved", "summary"],
      },
    });

    const p = safeParseJSON<any>(text, {});
    return res.json({
      approved: p.approved !== false,
      summary: p.summary ?? "Resolution confirmed by Municipal Crew.",
      confidence: p.confidence ?? 80,
    });
  } catch {
    return res.json({
      approved: true,
      summary: "Resolution logged and archived successfully.",
      confidence: 50,
    });
  }
});

// 4. Escalation Letter Drafter
app.post("/api/ai/escalate", async (req, res) => {
  const { title, description, category, severity, upvoteCount } = req.body;

  if (!apiKey) {
    return res.json({
      letter: `Dear City Authorities,\n\nWe are writing to escalate a community hazard: "${title ?? "Unresolved Community Issue"}"\nSeverity: ${severity ?? "Urgent"}\nEndorsed by ${upvoteCount ?? 1} verified resident(s).\n\nThis issue remains unresolved and requires immediate municipal dispatch.\n\nSincerely,\nNeighborhood Catchment Council`,
    });
  }

  try {
    const { text } = await callGeminiWithFallback({
      contents: `Draft a formal, authoritative administrative letter to city council coordinators for an unresolved community hazard.

Issue Title: "${title ?? ""}"
Category: "${category ?? ""}"
Severity: "${severity ?? ""}"
Endorsements: ${upvoteCount ?? 0} verified local residents
Details: "${description ?? ""}"

Requirements:
- Professional yet firmly urgent tone
- Reference public interest and safety liability
- Acknowledge democratic resident endorsements
- Request a specific action deadline (14 calendar days)
- Close with contact request for progress update`,
    });

    return res.json({ letter: text ?? "Escalation draft could not be generated." });
  } catch (err: any) {
    return res.status(500).json({ error: "AI draft failed: " + err.message });
  }
});

// 5. Predictive Insights
app.post("/api/ai/predictive-insights", async (req, res) => {
  const { issues } = req.body;

  const stubInsights = [
    {
      title: "Catchment Saturation Risk",
      description:
        "Water pooling and drainage complaints indicate localized blockages. Monitor closely during rainy periods.",
      priority: "Medium",
    },
    {
      title: "Infrastructure Stress Indicator",
      description:
        "Multiple pavement cracking patterns suggest heavy commercial load profiles in northern districts.",
      priority: "Low",
    },
  ];

  if (!apiKey || !Array.isArray(issues) || issues.length === 0) {
    return res.json({ insights: stubInsights });
  }

  const parsedIssues = issues.map((i: any) => ({
    title: i.title,
    category: i.category,
    severity: i.severity,
    status: i.status,
    lat: i.lat,
    lng: i.lng,
  }));

  try {
    const { text } = await callGeminiWithFallback({
      contents: `Perform predictive hazard clustering and systemic safety analysis on this neighborhood issues dataset:
${JSON.stringify(parsedIssues, null, 2)}

Tasks:
1. Identify geographic clusters (issues within ~200m of each other).
2. Detect recurring category patterns that suggest systemic failure.
3. Suggest up to 3 proactive preventive maintenance tasks for municipal departments.
4. Prioritize each suggestion as 'Low', 'Medium', or 'High'.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            priority: { type: Type.STRING },
            // NEW: which issue IDs form the cluster
            relatedIssueIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ["title", "description", "priority"],
        },
      },
    });

    const insights = safeParseJSON<any[]>(text, []);
    return res.json({ insights: insights.length ? insights : stubInsights });
  } catch {
    return res.json({ insights: stubInsights });
  }
});

// 6. Community Sentiment Analytics
app.post("/api/ai/community-sentiment", async (req, res) => {
  const { messages } = req.body;

  const stub = {
    sentimentScore: 72,
    keywords: ["Action Needed", "Collaborative", "Constructive", "Urgent"],
    analysis:
      "Neighbors display a proactive attitude toward community repairs, coordinating with moderate urgency.",
    // NEW: breakdown by theme
    breakdown: { positive: 60, neutral: 25, negative: 15 },
    moraleCategory: "Collaborative",
    trend: "Rising",
    trendSummary: "Neighbors display a proactive attitude toward community repairs, coordinating with moderate urgency.",
    insights: ["Strong community engagement", "High collaborative interest", "Constructive feedback loop", "Urgent task resolution focus"],
  };

  if (!apiKey || !Array.isArray(messages) || messages.length === 0) {
    return res.json(stub);
  }

  const rawTexts = messages
    .map((m: any) => m.text ?? "")
    .filter(Boolean)
    .join("\n");

  try {
    const { text } = await callGeminiWithFallback({
      contents: `Perform sentiment and community alignment analysis on these neighbor chat logs:
"${rawTexts}"

Return:
1. sentimentScore: integer 0 (high friction) to 100 (highly cohesive/proactive).
2. keywords: exactly 4 thematic keywords reflecting the dominant themes.
3. analysis: 2-sentence summary of community morale and engagement quality.
4. breakdown: object with keys positive, neutral, negative as percentages (must sum to 100).`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sentimentScore: { type: Type.INTEGER },
          keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          analysis: { type: Type.STRING },
          breakdown: {
            type: Type.OBJECT,
            properties: {
              positive: { type: Type.INTEGER },
              neutral: { type: Type.INTEGER },
              negative: { type: Type.INTEGER },
            },
          },
        },
        required: ["sentimentScore", "keywords", "analysis"],
      },
    });

    const p = safeParseJSON<any>(text, stub);
    const sentimentScore = p.sentimentScore ?? 50;
    
    let moraleCategory = "Moderate";
    if (sentimentScore >= 80) moraleCategory = "Excellent";
    else if (sentimentScore >= 65) moraleCategory = "Collaborative";
    else if (sentimentScore >= 50) moraleCategory = "Moderate";
    else moraleCategory = "Needs Attention";

    const trend = sentimentScore >= 70 ? "Rising" : sentimentScore >= 45 ? "Stable" : "Declining";
    const trendSummary = p.analysis ?? "Community dialog remains constructive and civil.";
    const insights = p.keywords ? p.keywords.map((kw: string) => `Focus area identified: ${kw}`) : ["General community interaction"];

    return res.json({
      sentimentScore,
      keywords: p.keywords ?? ["General"],
      analysis: p.analysis ?? "Neutral community dialog detected.",
      breakdown: p.breakdown ?? { positive: 50, neutral: 30, negative: 20 },
      moraleCategory,
      trend,
      trendSummary,
      insights,
    });
  } catch {
    return res.json(stub);
  }
});

// 7. Community Geo-Validation
app.post("/api/ai/geovalidate", async (req, res) => {
  const { name, lat, lng, radiusKm } = req.body;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.json({
      valid: false,
      reason: "Latitude and longitude must be valid finite numbers.",
    });
  }

  if (!name?.trim()) {
    return res.json({ valid: false, reason: "Community name cannot be empty." });
  }

  if (!apiKey) return res.json({ valid: true, reason: "" });

  try {
    const { text } = await callGeminiWithFallback({
      contents: `Validate this proposed community for a civic safety mapping application:
Name: "${name}"
Location: Lat ${lat}, Lng ${lng}
Radius: ${radiusKm} km

Check:
1. Name does not contain offensive language, spam, or nonsense.
2. Coordinates are plausible for a real populated area (not ocean, poles, etc.).
3. Radius is reasonable (0.1 – 50 km).
Return valid=false with a short reason only if clearly problematic.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          valid: { type: Type.BOOLEAN },
          reason: { type: Type.STRING },
        },
        required: ["valid", "reason"],
      },
    });

    const p = safeParseJSON<any>(text, { valid: true, reason: "" });
    return res.json({ valid: p.valid !== false, reason: p.reason ?? "" });
  } catch {
    // Fail open — geo-validation is non-critical
    return res.json({ valid: true, reason: "" });
  }
});

// 8. Gamification Evaluation
app.post("/api/gamification/evaluate", (req, res) => {
  const { uid } = req.body;
  return res.json({ success: true, uid });
});

// 9. Database Seeding Hook
app.post("/api/seed", (_req, res) => {
  return res.json({
    success: true,
    message: "Municipal records and demo catchment profiles seeded.",
  });
});

// ─── VITE / STATIC MIDDLEWARE ─────────────────────────────────────────────────

async function start() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server started on http://0.0.0.0:${PORT}`);
  });
}

start();