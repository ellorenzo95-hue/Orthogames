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
  wrongIndex: number; // index de la phrase fautive
  difficulty_b?: number;
  discrimination_a?: number;
}

const BACKEND_URL = "http://192.168.0.27:8787"; // adapte à ton IP

const ROUND_TIME_SECONDS = 30;
const MAX_LIVES = 3;

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
  wrongIndex: number;
  playerChoice: number | null;
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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [roundOver, setRoundOver] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const [lastSkillId, setLastSkillId] = useState<string | null>(null);
  const [lastWasCorrect, setLastWasCorrect] = useState<boolean | null>(null);

  const [bestStreak, setBestStreak] = useState(0);
  const [comboMessage, setComboMessage] = useState<string | null>(null);

  const [detailExplanation, setDetailExplanation] = useState<string | null>(null);
  const [extraExplanation, setExtraExplanation] = useState<string | null>(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);

  // mini production : "réécris la phrase correctement"
  const [rewriteEnabled, setRewriteEnabled] = useState(false);
  const [rewriteAnswer, setRewriteAnswer] = useState("");

  // historique de la session (pour le diagnostic final)
  const [history, setHistory] = useState<RoundHistoryEntry[]>([]);

  const hearts = useMemo(() => "❤".repeat(Math.max(0, lives)), [lives]);
  const liveComboMultiplier = useMemo(
    () => 1 + Math.floor(Math.max(streak, 0) / 3) * 0.25,
    [streak]
  );

  // ---------- Chargement d'une manche ----------

  const loadNextItem = async () => {
    if (lives <= 0) {
      setGameOver(true);
      return;
    }

    setIsLoadingItem(true);
    setRoundOver(false);
    setSelectedIndex(null);
    setFeedback(null);
    setDetailExplanation(null);
    setExtraExplanation(null);
    setComboMessage(null);
    setRewriteEnabled(false);
    setRewriteAnswer("");
    setTimeLeft(ROUND_TIME_SECONDS);

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
    loadNextItem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Timer ----------

  useEffect(() => {
    if (gameOver || roundOver || isLoadingItem || !currentItem) return;

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
    const wrongSentence = item.sentences[item.wrongIndex];
    const explanation = getSkillExplanation(item.skill_id);
    setDetailExplanation(`La phrase fautive était : « ${wrongSentence} »\n\n${explanation}`);
  };

  const pushHistory = (entry: RoundHistoryEntry) => {
    setHistory((prev) => [...prev, entry]);
  };

  const handleTimeout = () => {
    if (roundOver || gameOver || !currentItem) return;

    setRoundOver(true);
    setFeedback("⏰ Temps écoulé ! -1 vie");
    setComboMessage(null);
    setStreak(0);

    setLastSkillId(currentItem.skill_id);
    setLastWasCorrect(false);
    prepareExplanation(currentItem);

    pushHistory({
      round: roundNumber,
      skill_id: currentItem.skill_id,
      level: currentItem.level,
      sentences: currentItem.sentences,
      wrongIndex: currentItem.wrongIndex,
      playerChoice: null,
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
    if (!currentItem || roundOver || gameOver) return;

    setRoundOver(true);
    setSelectedIndex(index);

    const isCorrect = index === currentItem.wrongIndex;

    setLastSkillId(currentItem.skill_id);
    setLastWasCorrect(isCorrect);
    prepareExplanation(currentItem);

    if (isCorrect) {
      const timeFactor = Math.max(0, timeLeft) / ROUND_TIME_SECONDS; // 0 à 1
      const base = 100;
      const timeBonus = Math.round(50 * timeFactor);
      const nextStreak = streak + 1;
      const comboMultiplier = 1 + Math.floor(nextStreak / 3) * 0.25; // +25% tous les 3 coups
      const newPoints = Math.round((base + timeBonus) * comboMultiplier);

      setScore((prev) => prev + newPoints);
      setStreak(nextStreak);
      setBestStreak((prev) => Math.max(prev, nextStreak));
      setFeedback(`✔ Correct ! x${comboMultiplier.toFixed(2)} · +${newPoints} points`);
      setComboMessage(
        nextStreak % 3 === 0
          ? `Multiplicateur augmenté ! Série de ${nextStreak}`
          : nextStreak > 1
            ? `Série de ${nextStreak} en cours, continue !`
            : null
      );
      setRewriteEnabled(true); // propose de réécrire correctement

      if (nextStreak > 0 && nextStreak % 4 === 0) {
        setLives((prev) => {
          if (prev >= MAX_LIVES) return prev;
          setComboMessage(`🔥 Série de ${nextStreak} : +1 vie !`);
          return Math.min(MAX_LIVES, prev + 1);
        });
      }

      pushHistory({
        round: roundNumber,
        skill_id: currentItem.skill_id,
        level: currentItem.level,
        sentences: currentItem.sentences,
        wrongIndex: currentItem.wrongIndex,
        playerChoice: index,
        outcome: "correct",
        pointsEarned: newPoints,
      });
    } else {
      setStreak(0);
      setFeedback("✖ Mauvaise phrase ! -1 vie");
      setComboMessage(null);

      pushHistory({
        round: roundNumber,
        skill_id: currentItem.skill_id,
        level: currentItem.level,
        sentences: currentItem.sentences,
        wrongIndex: currentItem.wrongIndex,
        playerChoice: index,
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
    loadNextItem();
  };

  const handleRestart = () => {
    setCurrentItem(null);
    setIsLoadingItem(false);
    setRoundNumber(1);
    setTimeLeft(ROUND_TIME_SECONDS);
    setLives(MAX_LIVES);
    setScore(0);
    setStreak(0);
    setSelectedIndex(null);
    setFeedback(null);
    setRoundOver(false);
    setGameOver(false);
    setLastSkillId(null);
    setLastWasCorrect(null);
    setBestStreak(0);
    setComboMessage(null);
    setDetailExplanation(null);
    setExtraExplanation(null);
    setIsLoadingExplanation(false);
    setRewriteEnabled(false);
    setRewriteAnswer("");
    setHistory([]);
    loadNextItem();
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
          <Text>Meilleure série : {bestStreak}</Text>
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
              <Text style={{ fontSize: 12 }}>Phrase fautive : {h.sentences[h.wrongIndex]}</Text>
              {typeof h.playerChoice === "number" && h.playerChoice !== h.wrongIndex && (
                <Text style={{ fontSize: 12 }}>
                  Phrase choisie : {h.sentences[h.playerChoice]}
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

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
        <View>
          <Text style={{ fontSize: 14 }}>Score</Text>
          <Text style={{ fontSize: 20, fontWeight: "800" }}>{score}</Text>
        </View>
        <View>
          <Text style={{ fontSize: 14 }}>Temps</Text>
          <Text style={{ fontSize: 20, fontWeight: "800" }}>{timeLeft}s</Text>
        </View>
        <View>
          <Text style={{ fontSize: 14 }}>Vies</Text>
          <Text style={{ fontSize: 20, fontWeight: "800" }}>{hearts}</Text>
        </View>
      </View>

      <View style={{ marginBottom: 12 }}>
        <View
          style={{
            height: 8,
            backgroundColor: "#edf2ff",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              height: 8,
              width: `${Math.max(0, Math.min(100, (timeLeft / ROUND_TIME_SECONDS) * 100))}%`,
              backgroundColor: timeLeft < 8 ? "#e74c3c" : "#2f80ed",
              borderRadius: 999,
            }}
          />
        </View>
        <Text style={{ fontSize: 10, color: "#555", marginTop: 4 }}>
          Barre de temps : plus c'est vite, plus tu gagnes de points.
        </Text>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
        <Text style={{ fontSize: 12, fontWeight: "700", color: "#2f80ed" }}>
          Multiplicateur actuel : x{liveComboMultiplier.toFixed(2)}
        </Text>
        <Text style={{ fontSize: 12, fontWeight: "700", color: "#f97316" }}>
          Meilleure série : {bestStreak}
        </Text>
      </View>

      <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>Trouve la phrase fautive</Text>
      <Text style={{ fontSize: 13, color: "#555", marginBottom: 12 }}>
        Une seule phrase contient une faute. Appuie dessus le plus vite possible, puis lis l'explication et, si tu veux,
        réécris-la correctement.
      </Text>

      <Text style={{ fontSize: 12, color: "#777", marginBottom: 8 }}>
        Manche {roundNumber} · Compétence ciblée : {currentItem.skill_id} · Niveau {currentItem.level}
      </Text>

      {currentItem.sentences.map((sentence, idx) => {
        const isSelected = selectedIndex === idx;
        const isWrong = roundOver && idx === currentItem.wrongIndex;

        let borderColor = "#ddd";
        if (isWrong) borderColor = "#e74c3c";
        else if (isSelected) borderColor = "#2f80ed";

        const bg = isWrong ? "#fdecea" : isSelected ? "#e8f0ff" : "#fff";

        return (
          <TouchableOpacity
            key={idx}
            onPress={() => handleSentencePress(idx)}
            disabled={roundOver}
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

      {isLoadingItem && currentItem && !roundOver && (
        <Text style={{ marginTop: 8, fontSize: 12, color: "#888" }}>Préparation de la prochaine manche…</Text>
      )}

      {feedback && (
        <Text style={{ marginTop: 12, fontSize: 14, fontWeight: "600" }}>{feedback}</Text>
      )}

      {comboMessage && (
        <Text style={{ marginTop: 4, fontSize: 12, color: "#2f80ed" }}>{comboMessage}</Text>
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
          Série actuelle : {streak} bonnes réponses d'affilée (x{liveComboMultiplier.toFixed(2)})
        </Text>
      )}
    </ScrollView>
  );
}
