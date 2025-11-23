// app/(tabs)/index.tsx
// Écran principal avec menu :
// - Test complet de profil (AdaptiveFlowV2)
// - Mini-jeu infini "Phrase fautive" (ErrorScanGame)

import React, { useMemo, useState, useEffect } from "react";
import * as Speech from "expo-speech";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
} from "react-native";
import { create } from "zustand";
import { dictations, imageTasks } from "../../data/content";
import ErrorScanGame from "./ErrorScanGame"; 
import ConjugRouteGame from "./ConjugRouteGame";
import SyllatrisGame from "./SyllatrisGame"; 



// ⚠️ Mets ici l'IP de ton PC (même réseau que l'iPhone)
const BACKEND_URL = "http://192.168.0.27:8787";

// ---------------------- Skills & types ----------------------

const skillsList = [
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
] as const;

type Skill = (typeof skillsList)[number];

export type CEFR = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

interface DictationItem {
  id: string;
  title: string;
  text: string;
  level: CEFR;
}

interface ImageTaskItem {
  id: string;
  title: string;
  description: string;
  level: CEFR;
  source?: any;
}

const dictationBank = dictations as unknown as DictationItem[];
const imageBank = imageTasks as unknown as ImageTaskItem[];

interface HistoryEntry {
  item_id: string;
  skill_id: Skill | "MAIN";
  r: number;
  raw: any;
  response: string;
}

type Step = "onboarding" | "modeChoice" | "mainTask" | "followup" | "results";

type MainMode = "dictation" | "image" | null;

interface StoreState {
  onboarding: { [k: string]: string };
  setOnboarding: (key: string, value: string) => void;
  theta: Record<Skill, number>;
  uncertainty: Record<Skill, number>;
  asked: Set<string>;
  history: HistoryEntry[];
  mainMode: MainMode;
  setMainMode: (m: MainMode) => void;
  resetAll: () => void;
}

const makeZeroed = () => {
  const th: Record<Skill, number> = {} as any;
  const un: Record<Skill, number> = {} as any;
  skillsList.forEach((s) => {
    th[s] = 0;
    un[s] = 1;
  });
  return { th, un };
};

export const useAppStore = create<StoreState>((set) => {
  const { th, un } = makeZeroed();
  return {
    onboarding: { q1: "", q2: "", q3: "", q4: "", q5: "", q6: "" },
    setOnboarding: (key, value) =>
      set((state) => ({ onboarding: { ...state.onboarding, [key]: value } })),
    theta: th,
    uncertainty: un,
    asked: new Set<string>(),
    history: [],
    mainMode: null,
    setMainMode: (m) => set({ mainMode: m }),
    resetAll: () => {
      const { th, un } = makeZeroed();
      set({
        onboarding: { q1: "", q2: "", q3: "", q4: "", q5: "", q6: "" },
        theta: th,
        uncertainty: un,
        asked: new Set<string>(),
        history: [],
        mainMode: null,
      });
    },
  };
});

// ---------------------- Items de suivi ----------------------

interface ItemBase {
  item_id: string;
  skill_id: Skill;
  format: "mcq" | "fill_in" | "short_write";
  prompt: string;
  difficulty_b: number;
  discrimination_a: number;
  max_points: number;
  cefr_hint: string;
}

interface ItemMCQ extends ItemBase {
  format: "mcq";
  options: string[];
  answerIndex: number;
  answer: string;
}

interface ItemFill extends ItemBase {
  format: "fill_in";
  answer: string;
}

interface ItemShortWrite extends ItemBase {
  format: "short_write";
  rubric_id: string;
}

type Item = ItemMCQ | ItemFill | ItemShortWrite;

const followupBank: Item[] = [
  {
    item_id: "FU-CONJ.PC-1",
    skill_id: "CONJ.PC",
    format: "short_write",
    prompt: "Écris une phrase correcte au passé composé avec « finir ».",
    rubric_id: "FU-PC-1",
    difficulty_b: 0,
    discrimination_a: 1,
    max_points: 1,
    cefr_hint: "B1",
  },
  {
    item_id: "FU-ORT.HOM-1",
    skill_id: "ORT.HOM",
    format: "mcq",
    prompt: "Choisis la bonne phrase.",
    options: ["Il a oublier de venir.", "Il a oublié de venir."],
    answerIndex: 1,
    answer: "Il a oublié de venir.",
    difficulty_b: -0.1,
    discrimination_a: 1,
    max_points: 1,
    cefr_hint: "A2",
  },
  {
    item_id: "FU-SYN.AGR-1",
    skill_id: "SYN.AGR",
    format: "fill_in",
    prompt: "Les voisins ___ (se plaindre) du bruit.",
    answer: "se plaignent",
    difficulty_b: 0.5,
    discrimination_a: 1,
    max_points: 1,
    cefr_hint: "B1",
  },
  {
    item_id: "FU-ORT.ACC-1",
    skill_id: "ORT.ACC",
    format: "fill_in",
    prompt: "Complète : C’est une idée très inté____.",
    answer: "intéressante",
    difficulty_b: 0,
    discrimination_a: 1,
    max_points: 1,
    cefr_hint: "B1",
  },
  {
    item_id: "FU-PE.COH-1",
    skill_id: "PE.COH",
    format: "short_write",
    prompt: "En 2–3 phrases, raconte une courte situation au passé (hier).",
    rubric_id: "FU-COH-1",
    difficulty_b: 0.4,
    discrimination_a: 1,
    max_points: 1,
    cefr_hint: "B1",
  },
];

// ---------------------- Utils adaptatifs ----------------------

const prob = (theta: number, b: number) => 1 / (1 + Math.exp(-(theta - b)));

const updateSkill = (
  theta: Record<Skill, number>,
  uncertainty: Record<Skill, number>,
  skill_id: Skill,
  r: number,
  b: number,
  a: number,
  K: number = 0.4
) => {
  const p = prob(theta[skill_id], b);
  const newTheta = { ...theta, [skill_id]: theta[skill_id] + K * (r - p) * a };
  const newUnc = { ...uncertainty, [skill_id]: Math.max(0.05, uncertainty[skill_id] * 0.92) };
  return { newTheta, newUnc };
};

const thetaToCEFR = (t: number): string =>
  t < -1.2 ? "A1" : t < -0.4 ? "A2" : t < 0.4 ? "B1" : t < 1.2 ? "B2" : t < 2 ? "C1" : "C2";

const estimatePresumedLevel = (onboarding: { [k: string]: string }): string => {
  const lengthScore = Object.values(onboarding)
    .map((s) => s.trim().split(/\s+/).filter(Boolean).length)
    .reduce((a, b) => a + b, 0);

  if (lengthScore < 30) return "A1-A2";
  if (lengthScore < 80) return "B1";
  return "B2+";
};

// ---------------------- Backend helpers ----------------------

async function gradeWithBackend(item: any, response: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/grade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item, response }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (e: any) {
    console.error("grade error", e);
    Alert.alert("Erreur", "La correction IA est momentanément indisponible.");
    return { score: 0, errors: [], notes: "fallback" };
  }
}

// ---------------------- UI components ----------------------

const Button = ({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={{
      backgroundColor: disabled ? "#bdbdbd" : "#2f80ed",
      padding: 14,
      borderRadius: 12,
      marginVertical: 8,
    }}
  >
    <Text style={{ color: "#fff", fontWeight: "700", textAlign: "center" }}>{title}</Text>
  </TouchableOpacity>
);

const TextArea = ({ value, onChangeText, placeholder }: any) => (
  <TextInput
    multiline
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    autoCorrect={false}
    autoCapitalize="none"
    spellCheck={false}
    autoComplete="off"
    textContentType="none"
    style={{
      borderWidth: 1,
      borderColor: "#ddd",
      borderRadius: 10,
      padding: 10,
      minHeight: 60,
      marginTop: 4,
    }}
  />
);

// ---------------------- Test complet de profil ----------------------

export function AdaptiveFlowV2() {
  const { onboarding, setOnboarding, resetAll, theta, uncertainty, history, mainMode, setMainMode } =
    useAppStore();

  const [step, setStep] = useState<Step>("onboarding");

  const [mainResponse, setMainResponse] = useState("");
  const [mainLoading, setMainLoading] = useState(false);
  const [currentDictation, setCurrentDictation] = useState<DictationItem | null>(null);
  const [currentImage, setCurrentImage] = useState<ImageTaskItem | null>(null);

  const [followupItems, setFollowupItems] = useState<Item[]>([]);
  const [currentFollowup, setCurrentFollowup] = useState<Item | null>(null);
  const [followupAnswer, setFollowupAnswer] = useState("");
  const [followupLoading, setFollowupLoading] = useState(false);
  const [followupCount, setFollowupCount] = useState(0);

  // audio dictée
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [dictationSegments, setDictationSegments] = useState<string[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const presumedLevel = useMemo(() => estimatePresumedLevel(onboarding), [onboarding]);

  const cefrBySkill = useMemo(() => {
    const out: Record<Skill, string> = {} as any;
    skillsList.forEach((s) => {
      out[s] = thetaToCEFR(theta[s]);
    });
    return out;
  }, [theta]);

  const overallLevel = useMemo(() => {
    const levels = Object.values(cefrBySkill);
    const order = ["A1", "A2", "B1", "B2", "C1", "C2"];
    const sorted = [...levels].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return sorted[Math.floor(sorted.length / 2)];
  }, [cefrBySkill]);

  const strengths = useMemo(
    () => [...skillsList].sort((a, b) => theta[b] - theta[a]).slice(0, 2),
    [theta]
  );

  const priorities = useMemo(
    () => [...skillsList].sort((a, b) => theta[a] - theta[b]).slice(0, 3),
    [theta]
  );

  // charger une voix FR de bonne qualité
  useEffect(() => {
    (async () => {
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        const french = (voices || []).filter((v: any) => v.language?.startsWith("fr"));
        french.sort((a: any, b: any) => (b.quality ?? 0) - (a.quality ?? 0));
        const best = french[0] || french[1] || voices.find((v: any) => v.language?.startsWith("fr"));
        if (best) setVoiceId(best.identifier);
      } catch (e) {
        console.log("voice load error", e);
      }
    })();
  }, []);

  // découper la dictée en phrases pour pouvoir rejouer à partir d'un point
  useEffect(() => {
    if (currentDictation?.text) {
      const parts = currentDictation.text
        .split(/(?<=[.!?])/)
        .map((p) => p.trim())
        .filter(Boolean);
      setDictationSegments(parts);
      setIsSpeaking(false);
      Speech.stop();
    } else {
      setDictationSegments([]);
    }
  }, [currentDictation]);

  const playFromSegment = (startIndex: number) => {
    if (!currentDictation || dictationSegments.length === 0) return;
    const textToSpeak = dictationSegments.slice(startIndex).join(" ");
    Speech.stop();
    setIsSpeaking(true);
    Speech.speak(textToSpeak, {
      language: "fr-FR",
      rate: 0.9,
      voice: voiceId ?? undefined,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  const pauseDictation = () => {
    Speech.stop();
    setIsSpeaking(false);
  };

  // ---------------- Onboarding ----------------

  if (step === "onboarding") {
    return (
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={{ fontSize: 24, fontWeight: "800", marginBottom: 8 }}>Test de profil ✍️</Text>
        <Text style={{ marginBottom: 16 }}>
          Réponds librement. Nous allons ensuite te proposer une dictée ou une description d'image adaptée à ton
          profil.
        </Text>

        <Text>Pourquoi veux-tu apprendre le français ?</Text>
        <TextArea
          value={onboarding.q1}
          onChangeText={(t: string) => setOnboarding("q1", t)}
          placeholder="Ex : travail, études, vie en France…"
        />

        <Text style={{ marginTop: 12 }}>Dans quelles situations vas-tu l'utiliser ?</Text>
        <TextArea
          value={onboarding.q2}
          onChangeText={(t: string) => setOnboarding("q2", t)}
          placeholder="Ex : mails, réunions, examens…"
        />

        <Text style={{ marginTop: 12 }}>Comment décrirais-tu ton niveau actuel ?</Text>
        <TextArea
          value={onboarding.q3}
          onChangeText={(t: string) => setOnboarding("q3", t)}
          placeholder="Ex : A2, B1… ou une description."
        />

        <Text style={{ marginTop: 12 }}>Comment préfères-tu apprendre ?</Text>
        <TextArea
          value={onboarding.q4}
          onChangeText={(t: string) => setOnboarding("q4", t)}
          placeholder="Ex : exercices courts, dictées, jeux…"
        />

        <Text style={{ marginTop: 12 }}>Qu’est-ce qui est le plus difficile pour toi ?</Text>
        <TextArea
          value={onboarding.q5}
          onChangeText={(t: string) => setOnboarding("q5", t)}
          placeholder="Ex : orthographe, accords, passé composé…"
        />

        <Text style={{ marginTop: 12 }}>Dans 30 jours, qu’aimerais-tu savoir faire ?</Text>
        <TextArea
          value={onboarding.q6}
          onChangeText={(t: string) => setOnboarding("q6", t)}
          placeholder="Ex : écrire un mail sans faute…"
        />

        <Button title="Continuer" onPress={() => setStep("modeChoice")} />
      </ScrollView>
    );
  }

  // ---------------- Choix dictée / image ----------------

  if (step === "modeChoice") {
    const recommended: MainMode = presumedLevel === "A1-A2" ? "image" : "dictation";

    return (
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", marginBottom: 10 }}>Choisis ton test</Text>
        <Text style={{ marginBottom: 10 }}>D'après tes réponses, on pense que tu es autour de : {presumedLevel}.</Text>
        <Text style={{ marginBottom: 16 }}>
          Choisis comment tu veux commencer. Tu pourras toujours faire l'autre plus tard.
        </Text>

        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontWeight: "700", marginBottom: 4 }}>🎧 Dictée (recommandé si déjà à l'aise à l'écrit)</Text>
          <Text style={{ fontSize: 12, marginBottom: 4 }}>
            Tu recopies un texte court. Idéal pour tester l'orthographe et les accords.
          </Text>
          <Button
            title={recommended === "dictation" ? "Dictée (recommandé)" : "Choisir la dictée"}
            onPress={() => {
              setMainMode("dictation");
              const level: CEFR = presumedLevel === "A1-A2" ? "A1" : presumedLevel === "B1" ? "B1" : "B2";
              const candidates = dictationBank.filter((d) => d.level === level);
              const fallback = dictationBank.find((d) => d.level === "B1") || dictationBank[0];
              const chosen = candidates[0] || fallback;
              setCurrentDictation(chosen || null);
              setCurrentImage(null);
              setMainResponse("");
              setStep("mainTask");
            }}
          />
        </View>

        <View>
          <Text style={{ fontWeight: "700", marginBottom: 4 }}>🖼️ Description d'image (recommandé si niveau débutant)</Text>
          <Text style={{ fontSize: 12, marginBottom: 4 }}>
            Tu décris une scène en français. Idéal pour s'exprimer librement, même avec un petit niveau.
          </Text>
          <Button
            title={recommended === "image" ? "Description d'image (recommandé)" : "Choisir la description"}
            onPress={() => {
              setMainMode("image");
              const level: CEFR = presumedLevel === "A1-A2" ? "A1" : presumedLevel === "B1" ? "B1" : "B2";
              const candidates = imageBank.filter((img) => img.level === level);
              const chosen = candidates[0] || imageBank[0] || null;
              setCurrentImage(chosen || null);
              setCurrentDictation(null);
              setMainResponse("");
              setStep("mainTask");
            }}
          />
        </View>

        <Button
          title="Retour"
          onPress={() => {
            pauseDictation();
            setMainMode(null);
            setCurrentDictation(null);
            setCurrentImage(null);
            setMainResponse("");
            setStep("onboarding");
          }}
        />
      </ScrollView>
    );
  }

  // ---------------- Exercice principal ----------------

  if (step === "mainTask") {
    if (!mainMode) {
      return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text>Erreur : aucun mode sélectionné.</Text>
        </View>
      );
    }

    const isDictation = mainMode === "dictation";

    const handleMainSubmit = async () => {
      if (!mainResponse.trim()) return;
      pauseDictation();
      setMainLoading(true);

      let itemForBackend: any;

      if (isDictation) {
        const d = currentDictation;
        itemForBackend = {
          item_id: d?.id || "MAIN-DICTEE",
          skill_id: "CONJ.PC" as Skill,
          format: "dictation_span",
          prompt:
            `Texte de dictée (référence) : "${d?.text || ""}". Corrige la production de l'apprenant en comparant au texte de référence. ` +
            "Analyse précisément les fautes d'orthographe, d'accords, de conjugaison et de ponctuation.",
          rubric_id: "MAIN-DICTEE",
        };
      } else {
        const img = currentImage;
        itemForBackend = {
          item_id: img?.id || "MAIN-IMAGE",
          skill_id: "PE.COH" as Skill,
          format: "image_write",
          prompt:
            `L'apprenant décrit une image avec la consigne suivante : "${img?.description || ""}". ` +
            "Analyse vocabulaire, prépositions, accords, conjugaison et cohérence du texte produit.",
          rubric_id: "MAIN-IMAGE",
        };
      }

      const gpt = await gradeWithBackend(itemForBackend, mainResponse);

      useAppStore.setState((state) => ({
        history: [
          ...state.history,
          {
            item_id: itemForBackend.item_id,
            skill_id: "MAIN",
            r: typeof gpt.score === "number" ? gpt.score : 0,
            raw: gpt,
            response: mainResponse,
          },
        ],
      }));

      if (gpt.skill_score_hint) {
        const newTheta: Record<Skill, number> = { ...theta };
        const newUnc: Record<Skill, number> = { ...uncertainty };
        for (const s of skillsList) {
          const hint = gpt.skill_score_hint[s];
          if (typeof hint === "number") {
            newTheta[s] = (hint - 50) / 25;
            newUnc[s] = 0.5;
          }
        }
        useAppStore.setState({ theta: newTheta, uncertainty: newUnc });
      }

      const prioritiesNow = [...skillsList].sort((a, b) => theta[a] - theta[b]);
      const targetSkills = prioritiesNow.slice(0, 3);
      const selected: Item[] = [];
      targetSkills.forEach((s) => {
        const candidates = followupBank.filter((it) => it.skill_id === s);
        if (candidates.length > 0) selected.push(candidates[0]);
      });

      setFollowupItems(selected);
      setCurrentFollowup(selected[0] || null);
      setFollowupCount(0);
      setFollowupAnswer("");

      setMainLoading(false);
      setStep("followup");
    };

    return (
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", marginBottom: 12 }}>
          {isDictation ? "Dictée" : "Description d'image"}
        </Text>

        {isDictation ? (
          <>
            {currentDictation && (
              <View
                style={{
                  backgroundColor: "#f4f7ff",
                  padding: 10,
                  borderRadius: 10,
                  marginBottom: 10,
                }}
              >
                <Text style={{ fontWeight: "700", marginBottom: 6 }}>{currentDictation.title}</Text>

                <Button title="Lire toute la dictée" onPress={() => playFromSegment(0)} />

                <Button title="Pause" onPress={pauseDictation} disabled={!isSpeaking} />

                {dictationSegments.length > 1 && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 12, marginBottom: 4 }}>Revenir à un endroit précis :</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {dictationSegments.map((_, idx) => (
                        <TouchableOpacity
                          key={idx}
                          onPress={() => playFromSegment(idx)}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: "#2f80ed",
                            marginRight: 6,
                          }}
                        >
                          <Text style={{ fontSize: 12 }}>Phrase {idx + 1}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <Text style={{ fontSize: 12, marginTop: 6 }}>
                  Utilise les boutons pour écouter la dictée, la mettre en pause ou revenir sur une phrase précise.
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            {currentImage?.source && (
              <Image
                source={currentImage.source}
                style={{ width: "100%", height: 220, borderRadius: 12, marginBottom: 10 }}
                resizeMode="cover"
              />
            )}
            {currentImage && (
              <>
                <Text style={{ fontWeight: "700", marginBottom: 4 }}>{currentImage.title}</Text>
                <Text style={{ fontSize: 12, marginBottom: 8 }}>{currentImage.description}</Text>
              </>
            )}
            {!currentImage && (
              <Text style={{ fontSize: 12, marginBottom: 8 }}>
                Décris une scène dans un parc avec plusieurs personnages, objets et actions.
              </Text>
            )}
          </>
        )}

        <TextArea
          value={mainResponse}
          onChangeText={setMainResponse}
          placeholder={isDictation ? "Écris ici la dictée…" : "Décris la scène ici…"}
        />

        <Button
          title={mainLoading ? "Analyse en cours…" : "Envoyer"}
          onPress={handleMainSubmit}
          disabled={mainLoading || !mainResponse.trim()}
        />

        <Button
          title="Retour"
          onPress={() => {
            pauseDictation();
            setMainResponse("");
            setStep("modeChoice");
          }}
        />
      </ScrollView>
    );
  }

  // ---------------- Questions de suivi ----------------

  if (step === "followup") {
    if (!currentFollowup) {
      return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text>Aucune question de suivi.</Text>
          <Button title="Voir les résultats" onPress={() => setStep("results")} />
        </View>
      );
    }

    const isMCQ = currentFollowup.format === "mcq";

    const handleFollowupSubmit = async () => {
      setFollowupLoading(true);

      let r = 0;
      let raw: any = {};

      if (currentFollowup.format === "mcq") {
        r =
          followupAnswer.trim() === String(currentFollowup.answerIndex) ||
          followupAnswer.trim().toLowerCase() === currentFollowup.answer.toLowerCase()
            ? 1
            : 0;
        raw = { given: followupAnswer, expected: currentFollowup.answer };
      } else if (currentFollowup.format === "fill_in") {
        r = followupAnswer.trim().toLowerCase() === currentFollowup.answer.toLowerCase() ? 1 : 0;
        raw = { given: followupAnswer, expected: currentFollowup.answer };
      } else {
        const gpt = await gradeWithBackend(currentFollowup, followupAnswer);
        r = gpt.score;
        raw = gpt;
      }

      const store = useAppStore.getState();
      const asked = new Set(store.asked);
      asked.add(currentFollowup.item_id);

      const { newTheta, newUnc } = updateSkill(
        store.theta,
        store.uncertainty,
        currentFollowup.skill_id,
        r,
        currentFollowup.difficulty_b,
        currentFollowup.discrimination_a,
        currentFollowup.format === "mcq" || currentFollowup.format === "fill_in" ? 0.35 : 0.45
      );

      useAppStore.setState({
        theta: newTheta,
        uncertainty: newUnc,
        asked,
        history: [
          ...store.history,
          {
            item_id: currentFollowup.item_id,
            skill_id: currentFollowup.skill_id,
            r,
            raw,
            response: followupAnswer,
          },
        ],
      });

      setFollowupLoading(false);
      setFollowupAnswer("");

      const nextIndex = followupCount + 1;
      if (nextIndex >= followupItems.length) {
        setStep("results");
      } else {
        setFollowupCount(nextIndex);
        setCurrentFollowup(followupItems[nextIndex]);
      }
    };

    return (
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={{ fontSize: 20, fontWeight: "800", marginBottom: 8 }}>
          Question de suivi {followupCount + 1}/{followupItems.length}
        </Text>
        <Text style={{ marginBottom: 12 }}>{currentFollowup.prompt}</Text>

        {isMCQ ? (
          <View>
            {(currentFollowup as ItemMCQ).options.map((opt, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => setFollowupAnswer(String(idx))}
                style={{
                  borderWidth: 1,
                  borderColor: followupAnswer === String(idx) ? "#2f80ed" : "#ddd",
                  borderRadius: 10,
                  padding: 10,
                  marginVertical: 4,
                }}
              >
                <Text>
                  {idx}. {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <TextArea
            value={followupAnswer}
            onChangeText={setFollowupAnswer}
            placeholder={
              currentFollowup.format === "fill_in" ? "Ta réponse…" : "Écris ta phrase ou ton paragraphe ici…"
            }
          />
        )}

        <Button
          title={followupLoading ? "Correction…" : "Valider"}
          onPress={handleFollowupSubmit}
          disabled={followupLoading || (!followupAnswer && !isMCQ)}
        />
      </ScrollView>
    );
  }

  // ---------------- Résultats ----------------

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={{ fontSize: 24, fontWeight: "800", marginBottom: 8 }}>Résultats</Text>
      <Text style={{ marginBottom: 12 }}>
        Niveau global estimé : <Text style={{ fontWeight: "800" }}>{overallLevel}</Text>
      </Text>

      <View
        style={{
          backgroundColor: "#f4f7ff",
          padding: 12,
          borderRadius: 12,
          marginBottom: 16,
        }}
      >
        <Text style={{ fontWeight: "700", marginBottom: 6 }}>Résumé</Text>
        <Text style={{ marginBottom: 4 }}>
          ✅ Forces : {strengths.map((s) => `${s} (${cefrBySkill[s]})`).join(", ")}
        </Text>
        <Text>🎯 Priorités : {priorities.map((s) => `${s} (${cefrBySkill[s]})`).join(", ")}</Text>
      </View>

      <View
        style={{
          backgroundColor: "#f9fafb",
          padding: 12,
          borderRadius: 12,
          marginBottom: 16,
        }}
      >
        <Text style={{ fontWeight: "700", marginBottom: 8 }}>Niveau par compétence</Text>
        {skillsList.map((s) => (
          <Text key={s} style={{ marginBottom: 2 }}>
            {s} → {cefrBySkill[s]} (θ {theta[s].toFixed(2)})
          </Text>
        ))}
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontWeight: "700", marginBottom: 6 }}>Détails : tes réponses et corrections</Text>
        {history.map((h, idx) => (
          <View key={idx} style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "600" }}>
              {idx + 1}. {h.item_id} · score {h.r}
            </Text>
            <Text style={{ fontSize: 12 }}>Ta réponse : {h.response}</Text>
            {h.raw?.expected && <Text style={{ fontSize: 12 }}>Correction attendue : {h.raw.expected}</Text>}
            {Array.isArray(h.raw?.errors) && h.raw.errors.length > 0 && (
              <View style={{ marginTop: 2 }}>
                {h.raw.errors.map((e: any, i: number) => (
                  <Text key={i} style={{ fontSize: 11 }}>
                    - « {e.span} » → « {e.fix} » ({e.skill_id}) : {e.rule}
                  </Text>
                ))}
              </View>
            )}
          </View>
        ))}
      </View>

      <Button
        title="Refaire un test"
        onPress={() => {
          pauseDictation();
          resetAll();
          setMainResponse("");
          setCurrentDictation(null);
          setCurrentImage(null);
          setFollowupItems([]);
          setCurrentFollowup(null);
          setFollowupAnswer("");
          setFollowupCount(0);
          setStep("onboarding");
        }}
      />
    </ScrollView>
  );
}

// ---------------------- Menu principal (hub) ----------------------

type RootMode = "menu" | "profile" | "errorGame" | "conjugRoute" | "syllatris";

export default function Index() {
  const [mode, setMode] = useState<RootMode>("menu");

  if (mode === "profile") {
    return (
      <View style={{ flex: 1 }}>
        <AdaptiveFlowV2 />
        <View style={{ position: "absolute", top: 40, left: 16 }}>
          <TouchableOpacity
            onPress={() => setMode("menu")}
            style={{
              backgroundColor: "rgba(0,0,0,0.6)",
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 12 }}>◀ Menu</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (mode === "errorGame") {
    return (
      <View style={{ flex: 1 }}>
        <ErrorScanGame />
        <View style={{ position: "absolute", top: 40, left: 16 }}>
          <TouchableOpacity
            onPress={() => setMode("menu")}
            style={{
              backgroundColor: "rgba(0,0,0,0.6)",
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 12 }}>◀ Menu</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
 if (mode === "conjugRoute") {
    return (
      <View style={{ flex: 1 }}>
        <ConjugRouteGame />
        <View style={{ position: "absolute", top: 40, left: 16 }}>
          <TouchableOpacity
            onPress={() => setMode("menu")}
            style={{
              backgroundColor: "rgba(0,0,0,0.6)",
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 12 }}>◀ Menu</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

 if (mode === "syllatris") {
    return (
      <View style={{ flex: 1 }}>
        <SyllatrisGame />
        <View style={{ position: "absolute", top: 40, left: 16 }}>
          <TouchableOpacity
            onPress={() => setMode("menu")}
            style={{
              backgroundColor: "rgba(0,0,0,0.6)",
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 12 }}>◀ Menu</Text>
          </TouchableOpacity>
		 </View>
      </View>
    );
  }
          
  // mode === "menu"
  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 60 }}>
      <Text style={{ fontSize: 26, fontWeight: "800", marginBottom: 8 }}>Profil Écriture FLE</Text>
      <Text style={{ fontSize: 14, color: "#555", marginBottom: 24 }}>
        Découvre ton niveau d'écrit en français et améliore ton orthographe avec des mini-jeux et un test complet.
      </Text>

      <View
        style={{
          backgroundColor: "#f4f7ff",
          padding: 16,
          borderRadius: 16,
          marginBottom: 16,
        }}
      >
        <Text style={{ fontWeight: "700", marginBottom: 4 }}>🧪 Test complet de profil</Text>
        <Text style={{ fontSize: 13, color: "#555", marginBottom: 8 }}>
          Onboarding + dictée ou description d'image + questions ciblées. Résultat : un profil détaillé par
          compétence.
        </Text>
        <Button title="Lancer le test" onPress={() => setMode("profile")} />
      </View>

      <View
        style={{
          backgroundColor: "#fdf5f3",
          padding: 16,
          borderRadius: 16,
          marginBottom: 16,
        }}
      >
        <Text style={{ fontWeight: "700", marginBottom: 4 }}>🎯 Mini-jeu : Phrase fautive</Text>
        <Text style={{ fontSize: 13, color: "#555", marginBottom: 8 }}>
          Repère le plus vite possible la phrase qui contient une faute. Parties infinies, difficulté qui s'adapte à
          ton score.
        </Text>
        <Button title="Jouer" onPress={() => setMode("errorGame")} />
      </View>
	        <View
        style={{
          backgroundColor: "#ecfdf3",
          padding: 16,
          borderRadius: 16,
          marginBottom: 16,
        }}
      >
        <Text style={{ fontWeight: "700", marginBottom: 4 }}>🧩 Mini-jeu : ConjugRoute</Text>
        <Text style={{ fontSize: 13, color: "#555", marginBottom: 8 }}>
          Déplace-toi sur un plateau et ramasse les bonnes terminaisons pour conjuger toutes les personnes
          (je, tu, il/elle, nous, vous, ils/elles) au bon temps.
        </Text>
        <Button title="Jouer" onPress={() => setMode("conjugRoute")} />
      </View>
			
			<View style={{ backgroundColor: "#fefce8", padding: 16, borderRadius: 16, marginBottom: 16 }}>
	    <Text style={{ fontWeight: "700", marginBottom: 4 }}>🔡 Mini-jeu : Syllatris</Text>
	    <Text style={{ fontSize: 13, color: "#555", marginBottom: 8 }}>
          Un Tetris de syllabes : aligne les syllabes pour former des mots corrects et fais exploser les lignes.
	  </Text>
	  <Button title="Jouer" onPress={() => setMode("syllatris")} />
	 </View>
    </ScrollView>
  );
}
