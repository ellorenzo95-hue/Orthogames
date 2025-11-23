// =============================
// File: server/syllatrisRoute.js
// Backend pour le jeu "Syllatris" (Tetris de syllabes)
// - Zéro IA
// - Génération infinie en fonction du score et du round
// =============================

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function choice(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// -----------------------
// Banque de mots / syllabes
// -----------------------

export const SYLLATRIS_WORDS = [
  { word: "maison", syllables: ["mai", "son"], level: "A2", skills: ["SYL.BASIQUE", "ORT.USAGE"] },
  { word: "table", syllables: ["ta", "ble"], level: "A2", skills: ["SYL.BASIQUE", "ORT.USAGE"] },
  { word: "voiture", syllables: ["voi", "tu", "re"], level: "A2", skills: ["SYL.BASIQUE", "ORT.USAGE"] },
  { word: "attention", syllables: ["at", "ten", "tion"], level: "B1", skills: ["SYL.NASAL", "MORP.SUFFIX_TION"] },
  { word: "commencer", syllables: ["com", "men", "cer"], level: "B1", skills: ["SYL.NASAL", "ORT.DOUBLE_CONS"] },
  { word: "terminer", syllables: ["ter", "mi", "ner"], level: "B1", skills: ["SYL.BASIQUE", "MORP.VERB"] },
  { word: "importance", syllables: ["im", "por", "tan", "ce"], level: "B2", skills: ["SYL.NASAL", "MORP.SUFFIX_ANCE"] },
  { word: "connaître", syllables: ["con", "naî", "tre"], level: "B2", skills: ["SYL.COMPLEXE", "ORT.ACCENT"] },
  { word: "information", syllables: ["in", "for", "ma", "tion"], level: "B2", skills: ["MORP.SUFFIX_TION"] },
  { word: "ordinateur", syllables: ["or", "di", "na", "teur"], level: "B2", skills: ["SYL.BASIQUE", "LEX.TECH"] },
  { word: "possibilité", syllables: ["pos", "si", "bi", "li", "té"], level: "C1", skills: ["SYL.COMPLEXE", "ORT.DOUBLE_CONS", "ORT.ACCENT"] },
  { word: "incompréhensible", syllables: ["in", "com", "pré", "hen", "si", "ble"], level: "C1", skills: ["SYL.COMPLEXE", "ORT.ACCENT"] },
  { word: "développement", syllables: ["dé", "ve", "lop", "pe", "ment"], level: "C1", skills: ["MORP.SUFFIX_MENT", "ORT.DOUBLE_CONS"] },
];

// Syllabes/pièges fréquents
const TRAP_SYLLABLES = [
  "an", "en", "on", "in", "un",
  "ai", "é", "er", "et",
  "tion", "sion", "ment", "age",
  "con", "com", "conna", "nais",
];

// -----------------------
// Gestion de la difficulté
// -----------------------

function computeTier(score = 0, round = 1) {
  const fromScore = Math.floor(score / 800); // +1 tier tous les ~800 pts
  const fromRound = Math.floor((round - 1) / 3); // +1 tier tous les 3 niveaux
  return fromScore + fromRound; // 0,1,2,3...
}

function tierToDifficulty(tier) {
  if (tier <= 1) return "A2";
  if (tier <= 3) return "B1";
  if (tier <= 5) return "B2";
  if (tier <= 7) return "C1";
  return "C2";
}

function allowedLevelsForTier(tier) {
  if (tier <= 1) return ["A2"];
  if (tier <= 3) return ["A2", "B1"];
  if (tier <= 5) return ["A2", "B1", "B2"];
  return ["A2", "B1", "B2", "C1"];
}

function maxSyllablesForTier(tier) {
  if (tier <= 1) return 3;     // mots très courts
  if (tier <= 3) return 4;
  if (tier <= 5) return 5;
  return 6;                    // mots plus longs
}

function targetWordCountForTier(tier) {
  if (tier <= 1) return 3;
  if (tier <= 3) return 4;
  return 5;
}

function trapCountForTier(tier) {
  if (tier <= 1) return 3;
  if (tier <= 3) return 5;
  if (tier <= 5) return 7;
  return 10;
}

function gridSizeForTier(_tier) {
  // Tetris classique ~ 10x16
  return { rows: 16, cols: 10 };
}

// -----------------------
// Génération d'un niveau
// -----------------------

function generateSyllatrisLevel(score = 0, round = 1) {
  const tier = computeTier(score, round);
  const difficulty = tierToDifficulty(tier);
  const allowedLevels = allowedLevelsForTier(tier);
  const maxSyllables = maxSyllablesForTier(tier);
  const { rows, cols } = gridSizeForTier(tier);

  // Filtrer les mots
  const candidates = SYLLATRIS_WORDS.filter(
    (w) => allowedLevels.includes(w.level) && w.syllables.length <= maxSyllables,
  );

  const shuffled = shuffle(candidates);
  const targetCount = Math.min(targetWordCountForTier(tier), shuffled.length);
  const targetWords = shuffled.slice(0, targetCount);

  // Construire le pool de syllabes
  const poolCore = new Set();
  for (const w of targetWords) {
    for (const syl of w.syllables) {
      poolCore.add(syl);
    }
  }

  const syllablePool = [];
  for (const syl of poolCore) {
    syllablePool.push({ value: syl, type: "core" });
  }

  // Ajouter des pièges
  const trapCount = trapCountForTier(tier);
  const trapCandidates = shuffle(TRAP_SYLLABLES);
  for (let i = 0; i < trapCount && i < trapCandidates.length; i++) {
    syllablePool.push({ value: trapCandidates[i], type: "trap" });
  }

  const item = {
    id: `SYLLATRIS-${difficulty}-${Date.now()}`,
    difficulty,
    grid: { rows, cols },
    targetWords: targetWords.map((w) => ({ word: w.word, syllables: w.syllables })),
    syllablePool,
  };

  return item;
}

export function handleSyllatrisNext(req, res) {
  try {
    const { score = 0, round = 1 } = req.body || {};
    const item = generateSyllatrisLevel(score, round);
    return res.json({ item });
  } catch (err) {
    console.error("syllatris-next error", err);
    return res.status(500).json({ error: "Failed to generate Syllatris level" });
  }
}

export function handleSyllatrisExplain(req, res) {
  const { word } = req.body || {};
  if (!word) {
    return res.status(400).json({ error: "Missing word" });
  }

  const entry = SYLLATRIS_WORDS.find((w) => w.word === word);
  if (!entry) {
    return res.json({ explanation: `Tu as complété le mot "${word}".` });
  }

  const explanation = `Tu as complété le mot "${entry.word}", découpé ici en syllabes : ${entry.syllables.join(
    " - ",
  )}.`;
  return res.json({ explanation });
}

export function handleSyllatrisValidate(req, res) {
  try {
    // On récupère candidates en étant ultra défensif
    const body = req.body || {};
    const rawCandidates = Array.isArray(body.candidates) ? body.candidates : [];

    console.log("[/syllatris-validate] candidates reçus:", rawCandidates.length);

    // Si le dictionnaire est cassé, on ne plante pas
    const dictReady =
      DICTIONARY_SET && typeof DICTIONARY_SET.has === "function";

    if (!dictReady) {
      console.error(
        "[/syllatris-validate] DICTIONARY_SET invalide ou non initialisé"
      );
      // On RENVOIE 200 quand même, avec zéro mot valide
      return res.json({ validWords: [] });
    }

    const validWords = [];
    const seen = new Set();

    for (const raw of rawCandidates) {
      if (typeof raw !== "string") continue;

      const lower = raw.toLowerCase();

      if (seen.has(lower)) continue;
      seen.add(lower);

      if (DICTIONARY_SET.has(lower)) {
        validWords.push(raw); // on renvoie la forme telle qu’on l’a reçue
      }
    }

    console.log(
      "[/syllatris-validate] mots valides trouvés:",
      validWords.length
    );

    // Réponse OK (jamais 500)
    return res.json({ validWords });
  } catch (err) {
    console.error("[/syllatris-validate] ERREUR inattendue:", err);
    // Même en cas d’exception, on renvoie 200 pour ne pas casser le front
    return res.json({ validWords: [] });
  }
}