// server/conjRouteRoute.js
// Générateur algorithmique de niveaux pour le jeu ConjugRoute
// - Pas d'IA
// - Verbes & temps aléatoires
// - Difficulté potentiellement infinie (plus de pronoms, plus grand plateau, plus de pièges/murs)

// --------------- Outils utilitaires ---------------

function randInt(min, max) {
  // entier inclusif [min, max]
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

// --------------- Données de conjugaison ---------------

const PERSONS = [
  { id: "je", pronoun: "je", index: 0 },
  { id: "tu", pronoun: "tu", index: 1 },
  { id: "il", pronoun: "il", index: 2 },
  { id: "elle", pronoun: "elle", index: 2 },
  { id: "nous", pronoun: "nous", index: 3 },
  { id: "vous", pronoun: "vous", index: 4 },
  { id: "ils", pronoun: "ils", index: 5 },
  { id: "elles", pronoun: "elles", index: 5 },
];

// group: 1 = 1er groupe, 2 = 2e, 3 = 3e (modèle régulier)
const VERBS = [
  { infinitive: "parler", group: 1 },
  { infinitive: "aimer", group: 1 },
  { infinitive: "habiter", group: 1 },
  { infinitive: "regarder", group: 1 },
  { infinitive: "manger", group: 1 },
  { infinitive: "finir", group: 2 },
  { infinitive: "choisir", group: 2 },
  { infinitive: "réussir", group: 2 },
  { infinitive: "vendre", group: 3 },
  { infinitive: "entendre", group: 3 },
  { infinitive: "répondre", group: 3 },
];

const TENSES = {
  present: {
    key: "present",
    label: "Présent de l'indicatif",
    short: "présent",
    ruleByGroup: {
      1: "1er groupe au présent : -e, -es, -e, -ons, -ez, -ent",
      2: "2e groupe au présent : -is, -is, -it, -issons, -issez, -issent",
      3: "3e groupe modèle type 'vendre' : -s, -s, -, -ons, -ez, -ent",
    },
    endingsByGroup: {
      1: ["-e", "-es", "-e", "-ons", "-ez", "-ent"],
      2: ["-is", "-is", "-it", "-issons", "-issez", "-issent"],
      3: ["-s", "-s", "", "-ons", "-ez", "-ent"],
    },
  },
  imparfait: {
    key: "imparfait",
    label: "Imparfait de l'indicatif",
    short: "imparfait",
    ruleByGroup: {
      1: "Imparfait : radical de 'nous' au présent + -ais, -ais, -ait, -ions, -iez, -aient",
      2: "Imparfait : radical de 'nous' au présent + -ais, -ais, -ait, -ions, -iez, -aient",
      3: "Imparfait : radical de 'nous' au présent + -ais, -ais, -ait, -ions, -iez, -aient",
    },
    // On encode seulement les terminaisons (radical non joué dans le puzzle)
    endingsByGroup: {
      1: ["-ais", "-ais", "-ait", "-ions", "-iez", "-aient"],
      2: ["-ais", "-ais", "-ait", "-ions", "-iez", "-aient"],
      3: ["-ais", "-ais", "-ait", "-ions", "-iez", "-aient"],
    },
  },
  futur: {
    key: "futur",
    label: "Futur simple",
    short: "futur",
    ruleByGroup: {
      1: "Futur simple : infinitif complet + -ai, -as, -a, -ons, -ez, -ont",
      2: "Futur simple : infinitif complet + -ai, -as, -a, -ons, -ez, -ont",
      3: "Futur simple : radical futur + -ai, -as, -a, -ons, -ez, -ont",
    },
    endingsByGroup: {
      1: ["-ai", "-as", "-a", "-ons", "-ez", "-ont"],
      2: ["-ai", "-as", "-a", "-ons", "-ez", "-ont"],
      3: ["-ai", "-as", "-a", "-ons", "-ez", "-ont"],
    },
  },
};

// --------------- Sélection de difficulté ---------------

function computeTier(score = 0, round = 1) {
  // Plus le score et le round montent, plus le tier augmente.
  const fromScore = Math.floor(score / 600); // +1 tier tous les ~600 points
  const fromRound = Math.floor((round - 1) / 3); // +1 tier tous les 3 puzzles
  return fromScore + fromRound; // 0,1,2,3,... potentiellement infini
}

function tierToDifficulty(tier) {
  if (tier <= 1) return "A2";
  if (tier <= 3) return "B1";
  if (tier <= 5) return "B2";
  if (tier <= 7) return "C1";
  return "C2";
}

function allowedTensesForTier(tier) {
  if (tier <= 1) return ["present"]; // début : présent uniquement
  if (tier <= 3) return ["present", "imparfait"]; // on ajoute l'imparfait
  return ["present", "imparfait", "futur"]; // plus tard : futur simple aussi
}

function gridSizeForTier(tier) {
  const baseRows = 5;
  const baseCols = 5;
  const extra = Math.min(4, tier); // on n'augmente pas la grille sans fin
  return {
    rows: baseRows + Math.floor(extra / 2),
    cols: baseCols + extra,
  };
}

function pronounCountForTier(tier) {
  // au début : 4 personnes, puis jusqu'à 6
  if (tier <= 1) return 4;
  if (tier <= 3) return 5;
  return 6;
}

function trapCountForTier(tier, gridArea) {
  const base = 1 + tier;
  return Math.min(base, Math.floor(gridArea / 5));
}

function wallCountForTier(tier, gridArea) {
  const base = tier; // augmente plus doucement
  return Math.min(base, Math.floor(gridArea / 6));
}

// --------------- Génération d'un niveau ---------------

function gridKey(r, c) {
  return `${r}-${c}`;
}

function randomFreeCell(rows, cols, occupied) {
  let attempts = 0;
  while (attempts < 200) {
    const r = randInt(0, rows - 1);
    const c = randInt(0, cols - 1);
    const key = gridKey(r, c);
    if (!occupied.has(key)) {
      occupied.add(key);
      return { r, c };
    }
    attempts++;
  }
  // fallback : on balaye la grille
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = gridKey(r, c);
      if (!occupied.has(key)) {
        occupied.add(key);
        return { r, c };
      }
    }
  }
  // Si vraiment saturé, on renvoie (0,0)
  return { r: 0, c: 0 };
}

function generateConjRouteLevel(score = 0, round = 1) {
  const tier = computeTier(score, round);
  const difficulty = tierToDifficulty(tier);
  const tensesAllowed = allowedTensesForTier(tier);
  const tenseKey = choice(tensesAllowed);
  const tenseMeta = TENSES[tenseKey];

  const verb = choice(VERBS);
  const group = verb.group;

  const endings = tenseMeta.endingsByGroup[group];
  if (!endings) {
    throw new Error(`Pas de terminaisons pour le groupe ${group} au temps ${tenseKey}`);
  }

  // Combien de personnes ?
  const pronounCount = Math.min(pronounCountForTier(tier), PERSONS.length);
  const personsShuffled = shuffle(PERSONS);
  const persons = personsShuffled.slice(0, pronounCount);

  const { rows, cols } = gridSizeForTier(tier);
  const gridArea = rows * cols;

  const occupied = new Set();

  // Position de départ : bord bas/gauche ou au hasard
  const start = { r: rows - 1, c: 0 };
  occupied.add(gridKey(start.r, start.c));

  // Stations : on place chaque pronom sur une case libre
  const stations = persons.map((p) => {
    const cell = randomFreeCell(rows, cols, occupied);
    const ending = endings[p.index];
    return {
      id: p.id,
      pronoun: p.pronoun,
      r: cell.r,
      c: cell.c,
      needs: ending,
    };
  });

  // Jetons corrects : une terminaison pour chaque station, sur cases libres
  const tokens = [];
  for (const st of stations) {
    const cell = randomFreeCell(rows, cols, occupied);
    tokens.push({ type: "ending", value: st.needs, r: cell.r, c: cell.c });
  }

  // Pièges : terminaisons d'autres temps / groupes ou fausses combinaisons
  const trapCount = trapCountForTier(tier, gridArea);
  const allEndingsPool = [];
  for (const tKey of Object.keys(TENSES)) {
    const meta = TENSES[tKey];
    const groups = meta.endingsByGroup || {};
    for (const gStr of Object.keys(groups)) {
      for (const e of groups[gStr]) {
        if (e && !allEndingsPool.includes(e)) {
          allEndingsPool.push(e);
        }
      }
    }
  }

  for (let i = 0; i < trapCount; i++) {
    const cell = randomFreeCell(rows, cols, occupied);
    const trapEnding = choice(allEndingsPool);
    tokens.push({ type: "trap", value: trapEnding, r: cell.r, c: cell.c });
  }

  // Murs : cases bloquées
  const wallCount = wallCountForTier(tier, gridArea);
  const walls = [];
  for (let i = 0; i < wallCount; i++) {
    const cell = randomFreeCell(rows, cols, occupied);
    walls.push({ r: cell.r, c: cell.c });
  }

  const rule = tenseMeta.ruleByGroup[group];

  const item = {
    id: `CONJROUTE-${verb.infinitive}-${tenseMeta.short}-${difficulty}-${Date.now()}`,
    difficulty,
    verb: {
      infinitive: verb.infinitive,
      tense: tenseMeta.short,
      label: tenseMeta.label,
      rule,
    },
    grid: { rows, cols },
    start,
    stations,
    tokens,
    walls,
  };

  return item;
}

// --------------- Routes Express ---------------

export function handleConjRouteNext(req, res) {
  try {
    const { score = 0, round = 1 } = req.body || {};
    const item = generateConjRouteLevel(score, round);
    return res.json({ item });
  } catch (err) {
    console.error("conjroute-next error", err);
    return res.status(500).json({ error: "Failed to generate conjugation puzzle" });
  }
}

export function handleConjRouteExplain(req, res) {
  const { item, error } = req.body || {};

  if (!item || !item.verb || !error) {
    return res.status(400).json({ error: "Missing item or error details" });
  }

  const { infinitive, tense, rule } = item.verb;
  const { pronoun, needs, got } = error;
  const cleanGot = got || "(aucune terminaison)";

  const explanation = [
    `Tu conjuguais le verbe "${infinitive}" au ${tense}.`,
    `Pour "${pronoun}", la terminaison correcte est "${needs}".`,
    `Tu as pris "${cleanGot}", ce qui ne correspond pas à la bonne forme.`,
    `Rappelle-toi : ${rule}.`,
  ].join(" ");

  return res.json({ explanation });
}
