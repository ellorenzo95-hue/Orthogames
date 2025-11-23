// server/errorScanRoute.js
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// compétences que tu veux entraîner dans ce jeu
const SKILLS = ["ORT.HOM", "SYN.AGR", "CONJ.PC", "ORT.ACC", "CONJ.ACC"];

// choisit le nombre de phrases selon le score / round / streak
function chooseNumSentences(score, round, streak) {
  if (score > 2200 || round > 15 || streak >= 6) return 6;
  if (score > 800 || round > 5 || streak >= 3) return 5;
  return 4; // départ : 4 phrases
}

// choisit la compétence ciblée pour cette manche
function chooseTargetSkill(lastSkillId, lastWasCorrect) {
  if (!lastSkillId) return SKILLS[0];

  // si le joueur vient de se tromper sur cette compétence, on insiste dessus
  if (lastWasCorrect === false) return lastSkillId;

  const idx = SKILLS.indexOf(lastSkillId);
  if (idx === -1) return SKILLS[0];
  return SKILLS[(idx + 1) % SKILLS.length];
}

// niveau approximatif selon score / round (tu pourras affiner)
function chooseTargetLevel(round, score) {
  if (score < 300 && round <= 3) return "A2";
  if (score < 1200) return "B1";
  if (score < 2500) return "B2";
  return "C1";
}

// ---------- Route: générer un nouvel item pour le jeu infini ----------
export async function handleErrorScanNext(req, res) {
  const {
    round = 1,
    score = 0,
    lives = 3,
    streak = 0,
    lastSkillId = null,
    lastWasCorrect = null,
  } = req.body || {};

  if (lives <= 0) {
    return res.status(400).json({ error: "No lives left" });
  }

  const numSentences = chooseNumSentences(score, round, streak);
  const targetSkill = chooseTargetSkill(lastSkillId, lastWasCorrect);
  const targetLevel = chooseTargetLevel(round, score);

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Tu es un générateur d'exercices d'orthographe/conjugaison en français " +
            "pour un jeu sérieux destiné à des adolescents et adultes. " +
            "Tu produis UNIQUEMENT du JSON valide, sans explication autour.",
        },
        {
          role: "user",
          content: `
Génère UN seul item pour un mini-jeu où le joueur doit trouver la SEULE phrase fautive.

Paramètres :
- langue : français
- niveau CECR : ${targetLevel}
- compétence ciblée (skill_id) : ${targetSkill}
- nombre de phrases : ${numSentences}

Contraintes :
- Tu dois générer exactement ${numSentences} phrases courtes en français, naturelles et adaptées à des adolescents / adultes (pas de ton enfantin).
- UNE SEULE phrase doit contenir une faute d'écrit, principalement liée à la compétence ${targetSkill}.
- Toutes les autres phrases doivent être correctes à l'écrit.
- La phrase fautive doit être plausible mais clairement incorrecte du point de vue d'un enseignant.
- Les phrases doivent être autonomes (pas de numérotation ou de marqueurs comme "1.", "2." dans le texte).
- Varie les contextes (vie quotidienne, travail, études...) pour éviter la répétition.

Tu dois répondre UNIQUEMENT avec un objet JSON ayant ce format précis :

{
  "id": "ERR-${targetSkill}-${round}",
  "skill_id": "${targetSkill}",
  "level": "${targetLevel}",
  "sentences": [
    "phrase correcte ou fautive 1",
    "phrase correcte ou fautive 2",
    "..."
  ],
  "wrongIndex": 0
}

Notes :
- "wrongIndex" est l'indice (0-based) de la phrase fautive dans le tableau "sentences".
- Il doit y avoir exactement ${numSentences} éléments dans "sentences".
- Il doit y avoir exactement UNE phrase fautive.
`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    let item;
    try {
      item = JSON.parse(content);
    } catch (e) {
      console.error("JSON parse error from OpenAI:", e, content);
      return res.status(500).json({ error: "Invalid JSON from model" });
    }

    if (
      !item ||
      !Array.isArray(item.sentences) ||
      typeof item.wrongIndex !== "number" ||
      item.sentences.length !== numSentences
    ) {
      return res
        .status(500)
        .json({ error: "Invalid item structure from model", raw: item });
    }

    return res.json({ item });
  } catch (err) {
    console.error("error-scan-next route error:", err);
    return res.status(500).json({ error: "Failed to generate item" });
  }
}

// ---------- Route: explication détaillée après une manche ----------
export async function handleErrorScanExplain(req, res) {
  const { item } = req.body || {};

  if (
    !item ||
    !Array.isArray(item.sentences) ||
    typeof item.wrongIndex !== "number" ||
    typeof item.skill_id !== "string"
  ) {
    return res.status(400).json({ error: "Invalid item payload" });
  }

  const wrongSentence = item.sentences[item.wrongIndex];
  const skillId = item.skill_id;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Tu es un professeur de FLE qui explique les fautes d'orthographe / conjugaison " +
            "à des adolescents et adultes. Tu réponds UNIQUEMENT en JSON valide.",
        },
        {
          role: "user",
          content: `
On vient de faire un mini-jeu où l'apprenant doit trouver la phrase fautive.

Données de l'item :
- skill_id (compétence ciblée) : ${skillId}
- phrase fautive : "${wrongSentence}"

Rôle :
Explique précisément :
1) pourquoi cette phrase est FAUTE (où est l'erreur, quel mot pose problème),
2) quelle serait la phrase CORRECTE,
3) la règle simple à retenir pour ne plus refaire la même erreur.

Style :
- Français simple, niveau B1.
- 3 ou 4 phrases maximum.
- Adressé directement à l'apprenant ("tu").
- Pas de ton enfantin.

Format :
Réponds UNIQUEMENT avec ce JSON :

{
  "explanation": "texte en français"
}
`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    let obj;
    try {
      obj = JSON.parse(content);
    } catch (e) {
      console.error("JSON parse error (explain):", e, content);
      return res.status(500).json({ error: "Invalid JSON from model" });
    }

    if (!obj || typeof obj.explanation !== "string") {
      return res
        .status(500)
        .json({ error: "Invalid explanation structure from model", raw: obj });
    }

    return res.json({ explanation: obj.explanation });
  } catch (err) {
    console.error("error-scan-explain route error:", err);
    return res.status(500).json({ error: "Failed to generate explanation" });
  }
}
