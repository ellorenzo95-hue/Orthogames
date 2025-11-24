// File: app/(tabs)/ErrorScanGame.tsx
// Mini-jeu "Phrase fautive" = jeu principal de diagnostic
// Améliorations :
// - animations légères (simples changements de style, pas besoin de libs)
// - après une bonne réponse : option "Réécris la phrase correctement" (mini production)
// - stats par compétence sur la session
// - récapitulatif complet à la fin de la partie
// - toujours : explication + "J'ai compris" + "Plus d'explications"

import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, TextInput } from "react-native";

export type CEFR = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface ErrorScanItem {
  id: string;
  skill_id: string; // ex: "ORT.HOM", "SYN.AGR"...
  level: CEFR;
  sentences: string[]; // 4–6 phrases
  wrongIndex?: number; // index de la phrase fautive (legacy)
  wrongIndexes?: number[]; // indices des phrases fautives (boss round)
  difficulty_b?: number;
  discrimination_a?: number;
}

const BACKEND_URL = "http://192.168.0.27:8787"; // adapte à ton IP

const ROUND_TIME_SECONDS = 30;
const MAX_LIVES = 3;

type RoundKind = "normal" | "sprint" | "boss";

interface RoundSettings {
  type: RoundKind;
  label: string;
  description: string;
  timeLimit: number;
  pointsMultiplier: number;
  wrongAnswersRequired: number;
  theme: {
    background: string;
    badge: string;
    text: string;
    timer: string;
  };
}

function getRoundSettings(round: number): RoundSettings {
  if (round % 5 === 0) {
    return {
      type: "boss",
      label: "Boss round",
      description: "2 phrases fautives à repérer. Points x2.5, temps allongé.",
      timeLimit: 38,
      pointsMultiplier: 2.5,
      wrongAnswersRequired: 2,
      theme: {
        background: "#0f172a",
        badge: "#fbbf24",
        text: "#f8fafc",
        timer: "#fbbf24",
      },
    };
  }

  if (round % 4 === 0) {
    return {
      type: "sprint",
      label: "Round éclair",
      description: "Temps réduit mais points doublés. Vise vite et bien !",
      timeLimit: 18,
      pointsMultiplier: 2,
      wrongAnswersRequired: 1,
      theme: {
        background: "#0ea5e9",
        badge: "#f97316",
        text: "#f0f9ff",
        timer: "#f97316",
      },
    };
  }

  return {
    type: "normal",
    label: "Manche classique",
    description: "1 phrase fautive. Temps standard, score normal.",
    timeLimit: ROUND_TIME_SECONDS,
    pointsMultiplier: 1,
    wrongAnswersRequired: 1,
    theme: {
      background: "#f4f7ff",
      badge: "#2f80ed",
      text: "#1f2937",
      timer: "#2f80ed",
    },
  };
}

// Explications génériques par compétence pour aider l'utilisateur
const SKILL_HINTS: Record<string, string> = {
  "ORT.HOM":
    "Ici, la faute vient d'un homophone (a/à, et/est, son/sont, ce/se, ou/où...). Vérifie toujours le sens du mot : par exemple, 'est' est le verbe 'être', alors que 'et' sert à relier deux mots.",
  "SYN.AGR":
    "Problème d'accord : en français, le verbe s'accorde avec le sujet (les enfants jouent, il joue). De même, le nom et l'adjectif s'accordent en genre et en nombre (des fleurs rouges, un livre intéressant).",
  "CONJ.PC":
    "Problème de passé composé : avec 'avoir', le participe passé s'écrit souvent en -é (j'ai mangé, il a oublié). Avec 'être', le participe s'accorde avec le sujet (elle est arrivée, ils sont partis).",
  "CONJ.ACC":
    "Problème d'accord du verbe ou du participe. Vérifie toujours qui fait l'action (le sujet) et si c'est au singulier ou au pluriel.",
  "ORT.ACC":
    "Problème d'accent ou d'orthographe simple (é/er/ait, c/ç, etc.). Les accents peuvent changer le sens d'un mot : 'a' (verbe avoir) / 'à' (préposition), 'ou' / 'où'...",
};

function getSkillExplanation(skillId: string) {
  return (
    SKILL_HINTS[skillId] ||
    "Cette phrase contient une erreur typique de cette compétence. Prends le temps de comparer avec les autres phrases pour repérer ce qui change (accords, temps du verbe, homophones, etc.)."
  );
}

type RoundOutcome = "correct" | "wrong" | "timeout";

interface RoundHistoryEntry {
  round: number;
  skill_id: string;
  level: CEFR;
  sentences: string[];
  wrongIndexes: number[];
  playerChoices: number[];
  outcome: RoundOutcome;
  pointsEarned: number;
  playerRewrite?: string;
}

export default function ErrorScanGame() {
  const [currentItem, setCurrentItem] = useState<ErrorScanItem | null>(null);
  const [isLoadingItem, setIsLoadingItem] = useState(false);

  const [roundNumber, setRoundNumber] = useState(1);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME_SECONDS);
  const [lives, setLives] = useState(MAX_LIVES);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [roundOver, setRoundOver] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [showRuleBanner, setShowRuleBanner] = useState(true);
  const [activeRoundSettings, setActiveRoundSettings] = useState<RoundSettings>(
    getRoundSettings(1)
  );

  const [lastSkillId, setLastSkillId] = useState<string | null>(null);
  const [lastWasCorrect, setLastWasCorrect] = useState<boolean | null>(null);

  const [detailExplanation, setDetailExplanation] = useState<string | null>(null);
  const [extraExplanation, setExtraExplanation] = useState<string | null>(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);

  // mini production : "réécris la phrase correctement"
  const [rewriteEnabled, setRewriteEnabled] = useState(false);
  const [rewriteAnswer, setRewriteAnswer] = useState("");

  // historique de la session (pour le diagnostic final)
  const [history, setHistory] = useState<RoundHistoryEntry[]>([]);

  const hearts = useMemo(() => "❤".repeat(Math.max(0, lives)), [lives]);

  // ---------- Chargement d'une manche ----------

  const loadNextItem = async (round: number) => {
    const settings = getRoundSettings(round);
    setActiveRoundSettings(settings);
    setTimerActive(false);
    setShowRuleBanner(true);

    if (lives <= 0) {
      setGameOver(true);
      return;
    }

    setIsLoadingItem(true);
    setRoundOver(false);
    setSelectedIndexes([]);
    setFeedback(null);
    setDetailExplanation(null);
    setExtraExplanation(null);
    setRewriteEnabled(false);
    setRewriteAnswer("");
    setTimeLeft(settings.timeLimit);

    try {
      const res = await fetch(`${BACKEND_URL}/error-scan-next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          round: roundNumber,
          score,
          lives,
          streak,
          lastSkillId,
          lastWasCorrect,
          wrongAnswersRequested: settings.wrongAnswersRequired,
          mode: settings.type,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const item: ErrorScanItem = data.item ?? data;

      if (!item || !Array.isArray(item.sentences) || item.sentences.length < 2) {
        throw new Error("format d'item invalide");
      }

      setCurrentItem(item);
    } catch (e) {
      console.error("error-scan-next error", e);
      setFeedback("Impossible de charger une nouvelle manche.");
    } finally {
      setIsLoadingItem(false);
    }
  };

  useEffect(() => {
    loadNextItem(roundNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundNumber]);

  // ---------- Timer ----------

  useEffect(() => {
    if (gameOver || roundOver || isLoadingItem || !currentItem || !timerActive)
      return;

    if (timeLeft <= 0) {
      handleTimeout();
      return;
    }

    const id = setTimeout(() => {
      setTimeLeft((t) => t - 1);
    }, 1000);

    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, gameOver, roundOver, isLoadingItem, currentItem]);

  const prepareExplanation = (item: ErrorScanItem) => {
    const wrongIndexes = item.wrongIndexes || (typeof item.wrongIndex === "number" ? [item.wrongIndex] : []);
    const wrongSentences = wrongIndexes.map((idx) => item.sentences[idx]);
    const explanation = getSkillExplanation(item.skill_id);
    const intro =
      wrongSentences.length > 1
        ? `Les phrases fautives étaient : \n- ${wrongSentences.join("\n- ")}`
        : wrongSentences.length === 1
        ? `La phrase fautive était : « ${wrongSentences[0]} »`
        : "Impossible de retrouver la phrase fautive pour cette manche.";
    setDetailExplanation(`${intro}\n\n${explanation}`);
  };

  const pushHistory = (entry: RoundHistoryEntry) => {
    setHistory((prev) => [...prev, entry]);
  };

  const handleTimeout = () => {
    if (roundOver || gameOver || !currentItem) return;

    setRoundOver(true);
    setFeedback("⏰ Temps écoulé ! -1 vie");

    setLastSkillId(currentItem.skill_id);
    setLastWasCorrect(false);
    prepareExplanation(currentItem);

    const wrongIndexes = currentItem.wrongIndexes || (typeof currentItem.wrongIndex === "number" ? [currentItem.wrongIndex] : []);

    pushHistory({
      round: roundNumber,
      skill_id: currentItem.skill_id,
      level: currentItem.level,
      sentences: currentItem.sentences,
      wrongIndexes,
      playerChoices: [],
      outcome: "timeout",
      pointsEarned: 0,
    });

    setLives((prev) => {
      const next = prev - 1;
      if (next <= 0) {
        setGameOver(true);
      }
      return next;
    });
  };

  const handleSentencePress = (index: number) => {
    if (!currentItem || roundOver || gameOver || !timerActive) return;

    setSelectedIndexes((prev) => {
      let next = prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index];

      if (next.length > activeRoundSettings.wrongAnswersRequired) {
        next = next.slice(1);
      }

      if (next.length === activeRoundSettings.wrongAnswersRequired) {
        finalizeRound(next);
      }

      return next;
    });
  };

  const finalizeRound = (choices: number[]) => {
    if (!currentItem || roundOver) return;

    const wrongIndexes = currentItem.wrongIndexes || (typeof currentItem.wrongIndex === "number" ? [currentItem.wrongIndex] : []);
    const expectedSet = new Set(wrongIndexes);
    const isCorrect =
      choices.length === wrongIndexes.length && choices.every((i) => expectedSet.has(i));

    setRoundOver(true);
    setLastSkillId(currentItem.skill_id);
    setLastWasCorrect(isCorrect);
    prepareExplanation(currentItem);

    if (isCorrect) {
      const timeFactor = Math.max(0, timeLeft) / activeRoundSettings.timeLimit; // 0 à 1
      const base = 100 * activeRoundSettings.wrongAnswersRequired;
      const timeBonus = Math.round((50 * activeRoundSettings.wrongAnswersRequired) * timeFactor);
      const rawPoints = base + timeBonus;
      const newPoints = Math.round(rawPoints * activeRoundSettings.pointsMultiplier);

      setScore((prev) => prev + newPoints);
      setStreak((prev) => prev + 1);
      setFeedback(`✔ ${activeRoundSettings.label} réussi ! +${newPoints} points`);
      setRewriteEnabled(true); // propose de réécrire correctement

      pushHistory({
        round: roundNumber,
        skill_id: currentItem.skill_id,
        level: currentItem.level,
        sentences: currentItem.sentences,
        wrongIndexes,
        playerChoices: choices,
        outcome: "correct",
        pointsEarned: newPoints,
      });
    } else {
      setStreak(0);
      setFeedback("✖ Mauvaise sélection ! -1 vie");

      pushHistory({
        round: roundNumber,
        skill_id: currentItem.skill_id,
        level: currentItem.level,
        sentences: currentItem.sentences,
        wrongIndexes,
        playerChoices: choices,
        outcome: "wrong",
        pointsEarned: 0,
      });

      setLives((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          setGameOver(true);
        }
        return next;
      });
    }
  };

  const handleMoreExplanation = async () => {
    if (!currentItem) return;
    if (isLoadingExplanation) return;

    try {
      setIsLoadingExplanation(true);
      const res = await fetch(`${BACKEND_URL}/error-scan-explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: currentItem }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (typeof data.explanation === "string") {
        setExtraExplanation(data.explanation);
      } else {
        setExtraExplanation(
          "Impossible de récupérer plus d'explications pour le moment. Réessaie plus tard."
        );
      }
    } catch (e) {
      console.error("error-scan-explain error", e);
      setExtraExplanation(
        "Impossible de récupérer plus d'explications pour le moment. Réessaie plus tard."
      );
    } finally {
      setIsLoadingExplanation(false);
    }
  };

  const handleNextRound = () => {
    if (lives <= 0) {
      setGameOver(true);
      return;
    }
    setRoundNumber((r) => r + 1);
  };

  const handleRestart = () => {
    setCurrentItem(null);
    setIsLoadingItem(false);
    setRoundNumber(1);
    setTimeLeft(ROUND_TIME_SECONDS);
    setLives(MAX_LIVES);
    setScore(0);
    setStreak(0);
    setSelectedIndexes([]);
    setFeedback(null);
    setRoundOver(false);
    setGameOver(false);
    setLastSkillId(null);
    setLastWasCorrect(null);
    setDetailExplanation(null);
    setExtraExplanation(null);
    setIsLoadingExplanation(false);
    setRewriteEnabled(false);
    setRewriteAnswer("");
    setHistory([]);
  };

  // ---------- Récapitulatif & stats ----------

  const skillStats = useMemo(() => {
    const stats: Record<
      string,
      { attempts: number; correct: number; timeouts: number; wrong: number }
    > = {};

    history.forEach((h) => {
      if (!stats[h.skill_id]) {
        stats[h.skill_id] = { attempts: 0, correct: 0, timeouts: 0, wrong: 0 };
      }
      stats[h.skill_id].attempts += 1;
      if (h.outcome === "correct") stats[h.skill_id].correct += 1;
      if (h.outcome === "timeout") stats[h.skill_id].timeouts += 1;
      if (h.outcome === "wrong") stats[h.skill_id].wrong += 1;
    });

    return stats;
  }, [history]);

  const totalRounds = history.length;

  if (gameOver) {
    return (
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={{ fontSize: 24, fontWeight: "800", marginBottom: 8 }}>Fin de la partie</Text>

        <View
          style={{
            backgroundColor: "#f4f7ff",
            padding: 12,
            borderRadius: 12,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontWeight: "700", marginBottom: 4 }}>Résumé global</Text>
          <Text>Score total : {score}</Text>
          <Text>Manches jouées : {totalRounds}</Text>
        </View>

        <View
          style={{
            backgroundColor: "#f9fafb",
            padding: 12,
            borderRadius: 12,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontWeight: "700", marginBottom: 6 }}>Par compétence</Text>
          {Object.keys(skillStats).length === 0 && (
            <Text style={{ fontSize: 13 }}>Pas encore assez de données.</Text>
          )}
          {Object.entries(skillStats).map(([skill, st]) => {
            const pct = st.attempts ? Math.round((st.correct / st.attempts) * 100) : 0;
            return (
              <View key={skill} style={{ marginBottom: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: "600" }}>{skill}</Text>
                <Text style={{ fontSize: 12 }}>
                  {pct}% de bonnes réponses · {st.correct} bonnes / {st.wrong} mauvaises / {st.timeouts} hors temps
                </Text>
              </View>
            );
          })}
        </View>

        <View
          style={{
            backgroundColor: "#fff7ed",
            padding: 12,
            borderRadius: 12,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontWeight: "700", marginBottom: 6 }}>Détail des manches</Text>
          {history.map((h, idx) => (
            <View key={idx} style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: "600" }}>
                Manche {h.round} · {h.skill_id} · niveau {h.level}
              </Text>
              <Text style={{ fontSize: 12 }}>Issue : {h.outcome === "correct" ? "bonne" : h.outcome === "wrong" ? "mauvaise" : "temps écoulé"}</Text>
              <Text style={{ fontSize: 12 }}>
                Phrases fautives : {h.wrongIndexes.map((wi) => h.sentences[wi]).join(" · ")}
              </Text>
              {h.playerChoices.length > 0 && (
                <Text style={{ fontSize: 12 }}>
                  Tes choix : {h.playerChoices.map((pc) => h.sentences[pc]).join(" · ")}
                </Text>
              )}
              {h.playerRewrite && (
                <Text style={{ fontSize: 12 }}>Ta réécriture : {h.playerRewrite}</Text>
              )}
            </View>
          ))}
        </View>

        <TouchableOpacity
          onPress={handleRestart}
          style={{
            backgroundColor: "#2f80ed",
            paddingVertical: 12,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", textAlign: "center" }}>Rejouer une partie</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (isLoadingItem && !currentItem) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 16 }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12 }}>Préparation de la première manche…</Text>
      </View>
    );
  }

  if (!currentItem) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 16 }}>
        <Text>Impossible de charger une manche.</Text>
        <TouchableOpacity
          onPress={handleRestart}
          style={{
            backgroundColor: "#2f80ed",
            paddingVertical: 10,
            paddingHorizontal: 18,
            borderRadius: 12,
            marginTop: 10,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const wrongIndexes = currentItem.wrongIndexes || (typeof currentItem.wrongIndex === "number" ? [currentItem.wrongIndex] : []);

  const headerTheme = activeRoundSettings.theme;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <View
        style={{
          backgroundColor: headerTheme.background,
          borderRadius: 14,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: headerTheme.badge, fontSize: 12, fontWeight: "800" }}>
              {activeRoundSettings.label.toUpperCase()}
            </Text>
            <Text style={{ color: headerTheme.text, fontSize: 16, fontWeight: "800" }}>Manche {roundNumber}</Text>
            <Text style={{ color: headerTheme.text, fontSize: 12, marginTop: 4 }}>
              {activeRoundSettings.description}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: headerTheme.text, fontSize: 12 }}>Temps</Text>
            <Text style={{ color: headerTheme.timer, fontSize: 22, fontWeight: "900" }}>{timeLeft}s</Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
        <View>
          <Text style={{ fontSize: 14 }}>Score</Text>
          <Text style={{ fontSize: 20, fontWeight: "800" }}>{score}</Text>
        </View>
        <View>
          <Text style={{ fontSize: 14 }}>Vies</Text>
          <Text style={{ fontSize: 20, fontWeight: "800" }}>{hearts}</Text>
        </View>
        <View>
          <Text style={{ fontSize: 14 }}>Série</Text>
          <Text style={{ fontSize: 20, fontWeight: "800" }}>{streak}</Text>
        </View>
      </View>

      {showRuleBanner && (
        <View
          style={{
            backgroundColor: "#fff7ed",
            borderColor: "#fdba74",
            borderWidth: 1,
            borderRadius: 12,
            padding: 10,
            marginBottom: 10,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 4 }}>Règle de la manche</Text>
          <Text style={{ fontSize: 12, color: "#7c2d12" }}>
            {activeRoundSettings.type === "boss"
              ? "Deux phrases contiennent des erreurs. Sélectionne-les toutes avant la fin du temps."
              : activeRoundSettings.type === "sprint"
              ? "Temps réduit, mais les points sont doublés. Vise la phrase fautive en priorité."
              : "Une seule phrase fautive à repérer. Temps standard."}
          </Text>
          {!timerActive && (
            <TouchableOpacity
              onPress={() => {
                setTimerActive(true);
                setShowRuleBanner(false);
              }}
              style={{
                marginTop: 8,
                backgroundColor: "#2f80ed",
                paddingVertical: 10,
                borderRadius: 10,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "800", textAlign: "center" }}>
                Démarrer la manche
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>Trouve la phrase fautive</Text>
      <Text style={{ fontSize: 13, color: "#555", marginBottom: 12 }}>
        {activeRoundSettings.wrongAnswersRequired > 1
          ? "Deux phrases contiennent une faute. Appuie sur chacune d'elles avant la fin du compte à rebours."
          : "Une seule phrase contient une faute. Appuie dessus le plus vite possible, puis lis l'explication et, si tu veux, réécris-la correctement."}
      </Text>

      <Text style={{ fontSize: 12, color: "#777", marginBottom: 8 }}>
        Manche {roundNumber} · Compétence ciblée : {currentItem.skill_id} · Niveau {currentItem.level}
      </Text>

      {currentItem.sentences.map((sentence, idx) => {
        const isSelected = selectedIndexes.includes(idx);
        const isWrong = roundOver && wrongIndexes.includes(idx);

        let borderColor = "#ddd";
        if (isWrong) borderColor = "#e74c3c";
        else if (isSelected) borderColor = headerTheme.badge;

        const bg = isWrong ? "#fdecea" : isSelected ? "#e8f0ff" : "#fff";

        return (
          <TouchableOpacity
            key={idx}
            onPress={() => handleSentencePress(idx)}
            disabled={roundOver || !timerActive}
            style={{
              borderWidth: isSelected ? 2 : 1,
              borderColor,
              borderRadius: 10,
              padding: 12,
              marginVertical: 6,
              backgroundColor: bg,
            }}
          >
            <Text style={{ fontSize: 14 }}>{sentence}</Text>
          </TouchableOpacity>
        );
      })}

      {!timerActive && !roundOver && (
        <Text style={{ marginTop: 8, fontSize: 12, color: "#888" }}>
          Lis la règle, puis démarre la manche pour lancer le timer.
        </Text>
      )}

      {isLoadingItem && currentItem && !roundOver && timerActive && (
        <Text style={{ marginTop: 8, fontSize: 12, color: "#888" }}>Préparation de la prochaine manche…</Text>
      )}

      {feedback && (
        <Text style={{ marginTop: 12, fontSize: 14, fontWeight: "600" }}>{feedback}</Text>
      )}

      {detailExplanation && (
        <View
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 10,
            backgroundColor: "#f7f7f9",
          }}
        >
          <Text style={{ fontSize: 12, color: "#333", lineHeight: 18 }}>{detailExplanation}</Text>

          {rewriteEnabled && (
            <View style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 12, marginBottom: 4 }}>
                Option bonus : réécris la phrase correctement pour t'entraîner.
              </Text>
              <TextInput
                value={rewriteAnswer}
                onChangeText={setRewriteAnswer}
                placeholder="Ta phrase correcte"
                style={{
                  borderWidth: 1,
                  borderColor: "#ddd",
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 6,
                  fontSize: 13,
                  backgroundColor: "#fff",
                }}
              />
            </View>
          )}

          {extraExplanation && (
            <View style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 12, color: "#333", lineHeight: 18 }}>{extraExplanation}</Text>
            </View>
          )}

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 10,
            }}
          >
            <TouchableOpacity
              onPress={() => {
                // enregistre la réécriture si présente dans la dernière entrée d'historique
                if (rewriteAnswer.trim()) {
                  setHistory((prev) => {
                    if (prev.length === 0) return prev;
                    const copy = [...prev];
                    copy[copy.length - 1] = {
                      ...copy[copy.length - 1],
                      playerRewrite: rewriteAnswer.trim(),
                    };
                    return copy;
                  });
                }
                handleNextRound();
              }}
              style={{
                flex: 1,
                backgroundColor: "#2f80ed",
                paddingVertical: 10,
                borderRadius: 999,
                marginRight: 8,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", textAlign: "center", fontSize: 13 }}>
                J'ai compris
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleMoreExplanation}
              disabled={isLoadingExplanation}
              style={{
                flex: 1,
                backgroundColor: isLoadingExplanation ? "#bdbdbd" : "#f97316",
                paddingVertical: 10,
                borderRadius: 999,
                marginLeft: 8,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontWeight: "700",
                  textAlign: "center",
                  fontSize: 13,
                }}
              >
                {isLoadingExplanation ? "Chargement…" : "Plus d'explications"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {streak > 1 && (
        <Text style={{ marginTop: 4, fontSize: 12, color: "#2f80ed" }}>
          Série actuelle : {streak} bonnes réponses d'affilée
        </Text>
      )}
    </ScrollView>
  );
}
