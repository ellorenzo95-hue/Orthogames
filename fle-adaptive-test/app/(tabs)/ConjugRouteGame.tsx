// ==========================
// File: server/conjRouteRoute.js
// ==========================
// Route backend pour le mini-jeu de conjugaison "ConjugRoute".
// Version 1 : niveaux codés en dur, sans IA. Stable, parfait pour tester.

// Niveaux de base (présent de l'indicatif, verbes réguliers 1er groupe)
// On pourra en ajouter d'autres plus tard (imparfait, PC, etc.).

const CONJ_LEVELS = [
  {
    id: "CONJROUTE-PARLER-A2-01",
    difficulty: "A2",
    verb: {
      infinitive: "parler",
      tense: "présent",
      label: "Présent de l'indicatif",
      rule: "1er groupe au présent : -e, -es, -e, -ons, -ez, -ent",
    },
    grid: { rows: 6, cols: 6 },
    start: { r: 5, c: 0 },
    stations: [
      { id: "je", pronoun: "je", r: 4, c: 1, needs: "-e" },
      { id: "tu", pronoun: "tu", r: 2, c: 2, needs: "-es" },
      { id: "il", pronoun: "il", r: 1, c: 4, needs: "-e" },
      { id: "nous", pronoun: "nous", r: 3, c: 3, needs: "-ons" },
      { id: "vous", pronoun: "vous", r: 4, c: 4, needs: "-ez" },
      { id: "ils", pronoun: "ils", r: 0, c: 5, needs: "-ent" },
    ],
    tokens: [
      { type: "ending", value: "-e", r: 5, c: 1 },
      { type: "ending", value: "-es", r: 3, c: 1 },
      { type: "ending", value: "-e", r: 2, c: 4 },
      { type: "ending", value: "-ons", r: 3, c: 2 },
      { type: "ending", value: "-ez", r: 4, c: 3 },
      { type: "ending", value: "-ent", r: 1, c: 5 },
      { type: "trap", value: "-er", r: 2, c: 0 },
      { type: "trap", value: "-ait", r: 0, c: 3 },
    ],
    walls: [
      { r: 2, c: 3 },
      { r: 2, c: 5 },
      { r: 3, c: 5 },
    ],
  },
  {
    id: "CONJROUTE-AIMER-A2-02",
    difficulty: "A2",
    verb: {
      infinitive: "aimer",
      tense: "présent",
      label: "Présent de l'indicatif",
      rule: "1er groupe au présent : -e, -es, -e, -ons, -ez, -ent",
    },
    grid: { rows: 5, cols: 6 },
    start: { r: 4, c: 0 },
    stations: [
      { id: "je", pronoun: "je", r: 3, c: 1, needs: "-e" },
      { id: "tu", pronoun: "tu", r: 1, c: 2, needs: "-es" },
      { id: "elle", pronoun: "elle", r: 0, c: 4, needs: "-e" },
      { id: "nous", pronoun: "nous", r: 2, c: 3, needs: "-ons" },
      { id: "vous", pronoun: "vous", r: 3, c: 4, needs: "-ez" },
      { id: "elles", pronoun: "elles", r: 0, c: 5, needs: "-ent" },
    ],
    tokens: [
      { type: "ending", value: "-e", r: 4, c: 1 },
      { type: "ending", value: "-es", r: 2, c: 1 },
      { type: "ending", value: "-e", r: 1, c: 4 },
      { type: "ending", value: "-ons", r: 2, c: 2 },
      { type: "ending", value: "-ez", r: 3, c: 3 },
      { type: "ending", value: "-ent", r: 1, c: 5 },
      { type: "trap", value: "-er", r: 1, c: 0 },
      { type: "trap", value: "-aient", r: 0, c: 2 },
    ],
    walls: [
      { r: 1, c: 3 },
      { r: 2, c: 5 },
      { r: 3, c: 5 },
    ],
  },
  {
    id: "CONJROUTE-HABITER-B1-01",
    difficulty: "B1",
    verb: {
      infinitive: "habiter",
      tense: "présent",
      label: "Présent de l'indicatif",
      rule: "1er groupe au présent : -e, -es, -e, -ons, -ez, -ent",
    },
    grid: { rows: 6, cols: 7 },
    start: { r: 5, c: 0 },
    stations: [
      { id: "je", pronoun: "je", r: 4, c: 1, needs: "-e" },
      { id: "tu", pronoun: "tu", r: 3, c: 3, needs: "-es" },
      { id: "il", pronoun: "il", r: 2, c: 5, needs: "-e" },
      { id: "nous", pronoun: "nous", r: 3, c: 4, needs: "-ons" },
      { id: "vous", pronoun: "vous", r: 4, c: 5, needs: "-ez" },
      { id: "ils", pronoun: "ils", r: 1, c: 6, needs: "-ent" },
    ],
    tokens: [
      { type: "ending", value: "-e", r: 5, c: 1 },
      { type: "ending", value: "-es", r: 4, c: 3 },
      { type: "ending", value: "-e", r: 2, c: 4 },
      { type: "ending", value: "-ons", r: 3, c: 2 },
      { type: "ending", value: "-ez", r: 4, c: 4 },
      { type: "ending", value: "-ent", r: 2, c: 6 },
      { type: "trap", value: "-er", r: 1, c: 2 },
      { type: "trap", value: "-ait", r: 0, c: 4 },
    ],
    walls: [
      { r: 2, c: 3 },
      { r: 2, c: 1 },
      { r: 3, c: 6 },
      { r: 4, c: 6 },
    ],
  },
];

function pickConjLevel(score = 0, round = 1) {
  // logiques simples :
  if (score > 1500 || round > 4) {
    return CONJ_LEVELS.find((lvl) => lvl.difficulty === "B1") || CONJ_LEVELS[0];
  }
  // sinon A2
  const a2 = CONJ_LEVELS.filter((lvl) => lvl.difficulty === "A2");
  if (a2.length === 0) return CONJ_LEVELS[0];
  const index = round % a2.length;
  return a2[index];
}

export function handleConjRouteNext(req, res) {
  try {
    const { score = 0, round = 1 } = req.body || {};
    const level = pickConjLevel(score, round);
    return res.json({ item: level });
  } catch (err) {
    console.error("conjroute-next error", err);
    return res.status(500).json({ error: "Failed to load conjugation level" });
  }
}

// Explication simple locale (pas d'IA) après une erreur
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


// ==========================
// ➜ À ajouter dans server/index.js
// ==========================
// import { handleConjRouteNext, handleConjRouteExplain } from "./conjRouteRoute.js";
// ...
// app.post("/conjroute-next", handleConjRouteNext);
// app.post("/conjroute-explain", handleConjRouteExplain);


// ==========================
// File: app/(tabs)/ConjugRouteGame.tsx
// ==========================

import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";

const BACKEND_URL = "http://192.168.0.32:8787"; // adapte à ton IP locale

export type CEFR = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

type Pronoun = "je" | "tu" | "il" | "elle" | "nous" | "vous" | "ils" | "elles";

interface Station {
  id: string;
  pronoun: Pronoun | string;
  r: number;
  c: number;
  needs: string;
}

interface Token {
  type: "ending" | "trap";
  value: string;
  r: number;
  c: number;
}

interface Wall {
  r: number;
  c: number;
}

interface VerbMeta {
  infinitive: string;
  tense: string;
  label: string;
  rule: string;
}

export interface ConjugRouteItem {
  id: string;
  difficulty: string;
  verb: VerbMeta;
  grid: { rows: number; cols: number };
  start: { r: number; c: number };
  stations: Station[];
  tokens: Token[];
  walls: Wall[];
}

interface ErrorContext {
  pronoun: string;
  needs: string;
  got: string | null;
}

const ROUND_TIME_SECONDS = 90;
const MAX_LIVES = 3;

export default function ConjugRouteGame() {
  const [item, setItem] = useState<ConjugRouteItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME_SECONDS);

  const [playerRow, setPlayerRow] = useState(0);
  const [playerCol, setPlayerCol] = useState(0);

  const [inventory, setInventory] = useState<string | null>(null);
  const [consumedTokens, setConsumedTokens] = useState<Set<string>>(new Set());
  const [visitedStations, setVisitedStations] = useState<Set<string>>(new Set());

  const [feedback, setFeedback] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [puzzleSolved, setPuzzleSolved] = useState(false);

  const [lastError, setLastError] = useState<ErrorContext | null>(null);
  const [extraExplanation, setExtraExplanation] = useState<string | null>(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);

  const hearts = useMemo(() => "❤".repeat(Math.max(0, lives)), [lives]);

  const gridKey = (r: number, c: number) => `${r}-${c}`;

  const wallsSet = useMemo(() => {
    const s = new Set<string>();
    if (!item) return s;
    for (const w of item.walls) {
      s.add(gridKey(w.r, w.c));
    }
    return s;
  }, [item]);

  const tokensMap = useMemo(() => {
    const m = new Map<string, Token[]>();
    if (!item) return m;
    for (const t of item.tokens) {
      const key = gridKey(t.r, t.c);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(t);
    }
    return m;
  }, [item]);

  const stationsMap = useMemo(() => {
    const m = new Map<string, Station>();
    if (!item) return m;
    for (const s of item.stations) {
      m.set(gridKey(s.r, s.c), s);
    }
    return m;
  }, [item]);

  // --------- Chargement du niveau ---------

  const loadLevel = async (opts?: { newRound?: boolean; resetScore?: boolean }) => {
    if (opts?.resetScore) {
      setScore(0);
      setRound(1);
    }
    setIsLoading(true);
    setFeedback(null);
    setExtraExplanation(null);
    setLastError(null);

    try {
      const res = await fetch(`${BACKEND_URL}/conjroute-next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round, score }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const lvl: ConjugRouteItem = data.item ?? data;

      setItem(lvl);
      setPlayerRow(lvl.start.r);
      setPlayerCol(lvl.start.c);
      setInventory(null);
      setConsumedTokens(new Set());
      setVisitedStations(new Set());
      setPuzzleSolved(false);
      setTimeLeft(ROUND_TIME_SECONDS);
    } catch (e) {
      console.error("conjroute-next error", e);
      setFeedback("Impossible de charger le puzzle de conjugaison.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLevel({ resetScore: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------- Timer ---------

  useEffect(() => {
    if (!item || isLoading || gameOver || puzzleSolved) return;

    if (timeLeft <= 0) {
      setFeedback("Temps écoulé !");
      setGameOver(true);
      return;
    }

    const id = setTimeout(() => {
      setTimeLeft((t) => t - 1);
    }, 1000);

    return () => clearTimeout(id);
  }, [timeLeft, item, isLoading, gameOver, puzzleSolved]);

  // --------- Logique de déplacement ---------

  const movePlayer = (dr: number, dc: number) => {
    if (!item || isLoading || gameOver || puzzleSolved) return;

    const newR = playerRow + dr;
    const newC = playerCol + dc;

    if (newR < 0 || newC < 0 || newR >= item.grid.rows || newC >= item.grid.cols) {
      setFeedback("Tu sors du plateau, impossible de passer.");
      return;
    }

    const cellKeyStr = gridKey(newR, newC);
    if (wallsSet.has(cellKeyStr)) {
      setFeedback("Il y a un mur ici.");
      return;
    }

    setPlayerRow(newR);
    setPlayerCol(newC);
    setExtraExplanation(null);
    setLastError(null);

    // Gestion des jetons
    const tokensHere = tokensMap.get(cellKeyStr) || [];
    if (tokensHere.length > 0) {
      // Vérifie s'ils ne sont pas consommés
      const still = tokensHere.filter((t) => !consumedTokens.has(`${t.r}-${t.c}-${t.value}`));
      if (still.length > 0) {
        const token = still[0];
        const newConsumed = new Set(consumedTokens);
        newConsumed.add(`${token.r}-${token.c}-${token.value}`);
        setConsumedTokens(newConsumed);

        if (token.type === "ending") {
          setInventory(token.value);
          setFeedback(`Tu as ramassé la terminaison "${token.value}".`);
        } else {
          setInventory(token.value);
          setFeedback(`Attention, "${token.value}" est peut-être un piège…`);
        }
      }
    }

    // Gestion des stations
    const station = stationsMap.get(cellKeyStr);
    if (station) {
      const keyPronoun = station.id || station.pronoun;
      if (visitedStations.has(keyPronoun)) {
        setFeedback(`Tu es déjà passé sur "${station.pronoun}".`);
        return;
      }

      const needed = station.needs;
      const got = inventory;

      if (got === needed) {
        // Succès pour cette personne
        const newVisited = new Set(visitedStations);
        newVisited.add(keyPronoun);
        setVisitedStations(newVisited);
        setInventory(null);
        setFeedback(
          `✔ Correct : "${station.pronoun}" au ${item.verb.tense} prend la terminaison "${needed}".`
        );
        setScore((prev) => prev + 120);

        // Puzzle terminé ?
        if (newVisited.size === item.stations.length) {
          setPuzzleSolved(true);
          setFeedback("Bravo, tu as conjugué toutes les personnes !");
        }
      } else {
        // Erreur
        const newLives = lives - 1;
        setLives(newLives);
        setLastError({ pronoun: station.pronoun, needs: needed, got: got ?? null });
        setFeedback(
          `✖ Mauvaise terminaison pour "${station.pronoun}" (tu avais "${got ?? "rien"}").`
        );
        if (newLives <= 0) {
          setGameOver(true);
        }
      }
    }
  };

  // --------- Explications détaillées ---------

  const fetchMoreExplanation = async () => {
    if (!item || !lastError) return;
    if (isLoadingExplanation) return;

    try {
      setIsLoadingExplanation(true);
      const res = await fetch(`${BACKEND_URL}/conjroute-explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item, error: lastError }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (typeof data.explanation === "string") {
        setExtraExplanation(data.explanation);
      } else {
        setExtraExplanation("Je n'arrive pas à expliquer plus pour le moment.");
      }
    } catch (e) {
      console.error("conjroute-explain error", e);
      setExtraExplanation(
        "Impossible de récupérer plus d'explications pour le moment. Réessaie plus tard."
      );
    } finally {
      setIsLoadingExplanation(false);
    }
  };

  const handleNextPuzzle = () => {
    // passe au puzzle suivant, garde le score
    setRound((r) => r + 1);
    loadLevel();
  };

  const handleRestartAll = () => {
    setLives(MAX_LIVES);
    setScore(0);
    setRound(1);
    setGameOver(false);
    setPuzzleSolved(false);
    loadLevel({ resetScore: true });
  };

  // --------- Rendu ---------

  if (!item) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 16 }}>
        {isLoading ? (
          <Text>Chargement du puzzle…</Text>
        ) : (
          <>
            <Text>Impossible de charger un puzzle pour le moment.</Text>
            <TouchableOpacity
              onPress={() => loadLevel({ resetScore: true })}
              style={{ marginTop: 12, padding: 10, borderRadius: 8, backgroundColor: "#2f80ed" }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>Réessayer</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  if (gameOver) {
    return (
      <View style={{ flex: 1, padding: 20, justifyContent: "center" }}>
        <Text style={{ fontSize: 22, fontWeight: "800", marginBottom: 8 }}>Fin de la partie</Text>
        <Text style={{ marginBottom: 4 }}>Score : {score}</Text>
        <Text style={{ marginBottom: 12 }}>Verbe : {item.verb.infinitive} ({item.verb.label})</Text>
        <TouchableOpacity
          onPress={handleRestartAll}
          style={{ backgroundColor: "#2f80ed", borderRadius: 10, paddingVertical: 10, marginBottom: 8 }}
        >
          <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700" }}>Rejouer depuis zéro</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const allVisited = visitedStations.size === item.stations.length;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
        <View>
          <Text style={{ fontSize: 13 }}>Score</Text>
          <Text style={{ fontSize: 18, fontWeight: "800" }}>{score}</Text>
        </View>
        <View>
          <Text style={{ fontSize: 13 }}>Temps</Text>
          <Text style={{ fontSize: 18, fontWeight: "800" }}>{timeLeft}s</Text>
        </View>
        <View>
          <Text style={{ fontSize: 13 }}>Vies</Text>
          <Text style={{ fontSize: 18, fontWeight: "800" }}>{hearts}</Text>
        </View>
      </View>

      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "700" }}>ConjugRoute</Text>
        <Text style={{ fontSize: 13, color: "#555" }}>
          Verbe : "{item.verb.infinitive}" · {item.verb.label}
        </Text>
        <Text style={{ fontSize: 12, color: "#777", marginTop: 4 }}>
          Déplace-toi sur le plateau, ramasse les terminaisons et valide chaque personne (je, tu, il/elle, nous, vous,
          ils/elles) avec la bonne terminaison.
        </Text>
      </View>

      {/* Grille */}
      <View
        style={{
          borderWidth: 1,
          borderColor: "#ddd",
          borderRadius: 12,
          padding: 4,
          marginBottom: 12,
          backgroundColor: "#fafafa",
        }}
      >
        {Array.from({ length: item.grid.rows }).map((_, r) => (
          <View key={r} style={{ flexDirection: "row" }}>
            {Array.from({ length: item.grid.cols }).map((_, c) => {
              const k = gridKey(r, c);
              const isPlayer = r === playerRow && c === playerCol;
              const wall = wallsSet.has(k);
              const station = stationsMap.get(k);
              const tokensHere = (tokensMap.get(k) || []).filter(
                (t) => !consumedTokens.has(`${t.r}-${t.c}-${t.value}`)
              );

              let bg = "#fff";
              let borderColor = "#eee";

              if (wall) {
                bg = "#111827";
                borderColor = "#111827";
              } else if (station) {
                const visited = visitedStations.has(station.id || station.pronoun);
                bg = visited ? "#bbf7d0" : "#dbeafe";
                borderColor = visited ? "#16a34a" : "#2563eb";
              }

              if (isPlayer) {
                borderColor = "#f97316";
              }

              return (
                <View
                  key={c}
                  style={{
                    width: 34,
                    height: 34,
                    margin: 1,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: bg,
                  }}
                >
                  {wall ? (
                    <Text style={{ color: "#f9fafb", fontSize: 12 }}>■</Text>
                  ) : isPlayer ? (
                    <Text style={{ fontSize: 14 }}>🧍</Text>
                  ) : station ? (
                    <Text style={{ fontSize: 10, fontWeight: "700" }}>{station.pronoun}</Text>
                  ) : tokensHere.length > 0 ? (
                    <Text style={{ fontSize: 10 }}>
                      {tokensHere[0].type === "ending" ? tokensHere[0].value : "!"}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {/* Inventaire + déplacement */}
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 13, marginBottom: 4 }}>Inventaire</Text>
        <View
          style={{
            minHeight: 32,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: "#ddd",
            paddingHorizontal: 12,
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 13 }}>
            {inventory ? `Tu portes la terminaison "${inventory}".` : "Tu ne portes aucune terminaison."}
          </Text>
        </View>
      </View>

      <View style={{ alignItems: "center", marginBottom: 12 }}>
        <Text style={{ fontSize: 13, marginBottom: 4 }}>Déplacements</Text>
        <View style={{ alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => movePlayer(-1, 0)}
            style={{ padding: 8, borderRadius: 999, backgroundColor: "#e5e7eb", marginBottom: 4 }}
          >
            <Text>↑</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => movePlayer(0, -1)}
              style={{ padding: 8, borderRadius: 999, backgroundColor: "#e5e7eb", marginRight: 8 }}
            >
              <Text>←</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => movePlayer(1, 0)}
              style={{ padding: 8, borderRadius: 999, backgroundColor: "#e5e7eb" }}
            >
              <Text>↓</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => movePlayer(0, 1)}
              style={{ padding: 8, borderRadius: 999, backgroundColor: "#e5e7eb", marginLeft: 8 }}
            >
              <Text>→</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {feedback && (
        <Text style={{ fontSize: 13, marginBottom: 8 }}>{feedback}</Text>
      )}

      {lastError && (
        <View
          style={{
            marginTop: 4,
            padding: 8,
            borderRadius: 10,
            backgroundColor: "#fef3c7",
          }}
        >
          <Text style={{ fontSize: 12 }}>
            Erreur en conjuguant "{item.verb.infinitive}" avec "{lastError.pronoun}".
          </Text>
          <Text style={{ fontSize: 12 }}>
            Terminaison attendue : "{lastError.needs}" · Tu avais : "{lastError.got ?? "rien"}".
          </Text>

          <View style={{ flexDirection: "row", marginTop: 8 }}>
            <TouchableOpacity
              onPress={fetchMoreExplanation}
              disabled={isLoadingExplanation}
              style={{
                flex: 1,
                backgroundColor: isLoadingExplanation ? "#9ca3af" : "#f97316",
                paddingVertical: 8,
                borderRadius: 999,
                marginRight: 8,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  textAlign: "center",
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {isLoadingExplanation ? "…" : "Plus d'explications"}
              </Text>
            </TouchableOpacity>
          </View>

          {extraExplanation && (
            <Text style={{ fontSize: 12, marginTop: 6 }}>{extraExplanation}</Text>
          )}
        </View>
      )}

      {puzzleSolved && !gameOver && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 13, marginBottom: 4 }}>
            Tu as conjugué toutes les personnes pour "{item.verb.infinitive}".
          </Text>
          <TouchableOpacity
            onPress={handleNextPuzzle}
            style={{
              backgroundColor: "#22c55e",
              paddingVertical: 10,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700" }}>
              Puzzle suivant
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {allVisited && !puzzleSolved && (
        <Text style={{ fontSize: 12, marginTop: 4 }}>
          Toutes les stations sont validées.
        </Text>
      )}
    </ScrollView>
  );
}