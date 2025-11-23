// server/index.js
import express from "express";
import cors from "cors";
import { z } from "zod";
import OpenAI from "openai";
import { handleErrorScanNext, handleErrorScanExplain } from "./errorScanRoute.js";
import { handleConjRouteNext, handleConjRouteExplain } from "./conjRouteRoute.js";
import {
  handleSyllatrisNext,
  handleSyllatrisExplain,
  handleSyllatrisValidate, // ⬅️ ajoute ça
} from "./syllatrisRoute.js";


const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") || true }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PORT = process.env.PORT || 8787;
const MODEL = process.env.MODEL || "gpt-4o-mini";

// Micro-compétences autorisées
const SKILLS = [
  "SYN.AGR",
  "CONJ.PC",
  "CONJ.ACC",
  "ORT.HOM",
  "ORT.ACC",
  "ORT.PONC",
  "SYN.PRON",
  "SYN.PREP",
  "LEX.COLLO",
  "PE.COH",
];

// Payload attendu du client pour /grade
const GradeIn = z.object({
  item: z.object({
    item_id: z.string(),
    skill_id: z.string(),
    format: z
      .enum(["mcq", "fill_in", "short_write", "dictation_span", "image_write"])
      .optional(),
    prompt: z.string(),
    rubric_id: z.string().optional(),
  }),
  response: z.string().min(1),
});

// Réponse attendue du modèle pour /grade
const GradeOut = z.object({
  score: z.union([z.literal(0), z.literal(0.5), z.literal(1)]),
  errors: z
    .array(
      z.object({
        span: z.string(),
        fix: z.string(),
        skill_id: z.enum(SKILLS),
        rule: z.string(),
      })
    )
    .default([]),
  notes: z.string().default(""),
  skill_score_hint: z
    .record(z.enum(SKILLS), z.number().min(0).max(100))
    .optional(),
});

// Prompt système strict (JSON only)
const SYSTEM_PROMPT = `
Tu es un correcteur professionnel FLE pour un test adaptatif.
Rends STRICTEMENT un JSON:
{
  "score": 0|0.5|1,
  "errors": [{"span":"","fix":"","skill_id":"","rule":""}],
  "notes": "",
  "skill_score_hint": {"CONJ.PC":0-100, ...}
}
Contraintes:
- "score"=1 si consigne respectée sans faute majeure; 0.5 si mineure; 0 sinon.
- skill_id ∈ ${SKILLS.join(", ")}.
- Réponds uniquement en JSON valide, pas de texte hors JSON.
- image_write: objets clés attendus: femme/vélo/chien/banc/enfant (pénalise hallucinations).
- Rappels: CONJ.PC (participe -é avec avoir; accord avec être),
  SYN.AGR (pluriel -> -nt),
  ORT.HOM (a/à; et/est; son/sont),
  ORT.ACC (accents, cédille, trait d'union),
  SYN.PRON (y/en),
  SYN.PREP (sur/sous/devant/derrière/à côté de),
  ORT.PONC (virgules, points; espaces avant ; : ! ? selon usage français).
`;

const buildUserPrompt = (item, response) => ({
  role: "user",
  content: JSON.stringify({
    item_id: item.item_id,
    skill_id: item.skill_id,
    format: item.format,
    prompt: item.prompt,
    rubric_id: item.rubric_id || null,
    response,
  }),
});

// Healthcheck simple
app.get("/health", (req, res) => res.json({ ok: true }));

// --------- Route /grade (correction des productions écrites) ---------
app.post("/grade", async (req, res) => {
  try {
    const { item, response } = GradeIn.parse(req.body);

    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        buildUserPrompt(item, response),
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: "Bad JSON from model", raw });
    }

    const out = GradeOut.safeParse(parsed);
    if (!out.success) {
      return res.status(422).json({
        error: "Schema validation failed",
        issues: out.error.issues,
        raw: parsed,
      });
    }

    res.json(out.data);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err?.message || "Unknown error" });
  }
});

// --------- Route /error-scan-next (mini-jeu infini “phrase fautive”) ---------
app.post("/error-scan-next", handleErrorScanNext);
app.post("/error-scan-explain", handleErrorScanExplain);
app.post("/conjroute-next", handleConjRouteNext);
app.post("/conjroute-explain", handleConjRouteExplain);
app.post("/syllatris-next", handleSyllatrisNext);
app.post("/syllatris-explain", handleSyllatrisExplain);
app.post("/syllatris-validate", handleSyllatrisValidate);

// --------- Démarrage du serveur ---------
app.listen(PORT, () => console.log(`grader listening on :${PORT}`));
