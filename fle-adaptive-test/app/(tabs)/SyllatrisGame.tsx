// =============================
// File: app/(tabs)/SyllatrisGame.tsx (v4)
// - Dictionnaire côté backend (/syllatris-validate)
// - Pièces Tetris colorées
// - Rotation + prochaine pièce
// =============================

import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";

const BACKEND_URL = "http://192.168.0.27:8787"; // adapte à ton IP locale

interface TargetWord {
  word: string;
  syllables?: string[];
}

interface SyllablePoolEntry {
  value: string;
  type: "core" | "trap";
}

interface SyllatrisLevel {
  id: string;
  difficulty: string;
  grid: { rows: number; cols: number };
  targetWords: TargetWord[];
  syllablePool: SyllablePoolEntry[];
}

type Cell = {
  syllable: string;
  color: string;
} | null;

interface PieceCell {
  offsetRow: number;
  offsetCol: number;
  syllable: string;
  color: string;
}

interface Piece {
  row: number; // position de référence (ligne du haut)
  col: number; // position de référence (colonne la plus à gauche)
  cells: PieceCell[];
}

interface Shape {
  name: string;
  color: string;
  cells: { offsetRow: number; offsetCol: number }[];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function choice<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function getDropIntervalMs(difficulty: string): number {
  switch (difficulty) {
    case "A2":
      return 900;
    case "B1":
      return 750;
    case "B2":
      return 600;
    case "C1":
      return 500;
    case "C2":
      return 400;
    default:
      return 800;
  }
}

// Formes Tetris-like avec couleurs
const SHAPES: Shape[] = [
  {
    name: "dot",
    color: "#f97316", // orange
    cells: [{ offsetRow: 0, offsetCol: 0 }],
  },
  {
    name: "bar2",
    color: "#22c55e", // vert
    cells: [
      { offsetRow: 0, offsetCol: 0 },
      { offsetRow: 0, offsetCol: 1 },
    ],
  },
  {
    name: "bar3",
    color: "#0ea5e9", // bleu
    cells: [
      { offsetRow: 0, offsetCol: 0 },
      { offsetRow: 0, offsetCol: 1 },
      { offsetRow: 0, offsetCol: 2 },
    ],
  },
  {
    name: "square",
    color: "#eab308", // jaune
    cells: [
      { offsetRow: 0, offsetCol: 0 },
      { offsetRow: 0, offsetCol: 1 },
      { offsetRow: 1, offsetCol: 0 },
      { offsetRow: 1, offsetCol: 1 },
    ],
  },
  {
    name: "L",
    color: "#ef4444", // rouge
    cells: [
      { offsetRow: 0, offsetCol: 0 },
      { offsetRow: 1, offsetCol: 0 },
      { offsetRow: 1, offsetCol: 1 },
    ],
  },
  {
    name: "J",
    color: "#6366f1", // indigo
    cells: [
      { offsetRow: 0, offsetCol: 1 },
      { offsetRow: 1, offsetCol: 1 },
      { offsetRow: 1, offsetCol: 0 },
    ],
  },
  {
    name: "T",
    color: "#ec4899", // rose
    cells: [
      { offsetRow: 0, offsetCol: 0 },
      { offsetRow: 0, offsetCol: 1 },
      { offsetRow: 0, offsetCol: 2 },
      { offsetRow: 1, offsetCol: 1 },
    ],
  },
];

export default function SyllatrisGame() {
  const [level, setLevel] = useState<SyllatrisLevel | null>(null);
  const [grid, setGrid] = useState<Cell[][]>([]);
  const [currentPiece, setCurrentPiece] = useState<Piece | null>(null);
  const [nextShape, setNextShape] = useState<Shape | null>(null);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const dropInterval = useMemo(() => {
    if (!level) return 800;
    return getDropIntervalMs(level.difficulty);
  }, [level]);

  const loadLevel = async (opts?: { resetScore?: boolean }) => {
    if (opts?.resetScore) {
      setScore(0);
      setRound(1);
    }
    setIsLoading(true);
    setFeedback(null);
    setGameOver(false);
    setCurrentPiece(null);

    try {
      const res = await fetch(`${BACKEND_URL}/syllatris-next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, round }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const lvl: SyllatrisLevel = data.item ?? data;
      setLevel(lvl);

      const rows = lvl.grid.rows || 16;
      const cols = lvl.grid.cols || 10;
      const empty: Cell[][] = Array.from({ length: rows }, () =>
        Array(cols).fill(null)
      );
      setGrid(empty);
      setCurrentPiece(null);
      setNextShape(choice(SHAPES));
    } catch (e) {
      console.error("syllatris-next error", e);
      setFeedback("Impossible de charger le niveau de Syllatris.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLevel({ resetScore: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Boucle de jeu
  useEffect(() => {
    if (!level || gameOver) return;
    const id = setInterval(() => {
      setTick((t) => t + 1);
    }, dropInterval);
    return () => clearInterval(id);
  }, [level, dropInterval, gameOver]);

  useEffect(() => {
    if (!level || gameOver) return;
    advanceGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const spawnNewPiece = () => {
    if (!level) return;
    const rows = level.grid.rows;
    const cols = level.grid.cols;

    const shape = nextShape ?? choice(SHAPES);
    const maxColOffset = shape.cells.reduce(
      (max, c) => Math.max(max, c.offsetCol),
      0
    );
    const maxRowOffset = shape.cells.reduce(
      (max, c) => Math.max(max, c.offsetRow),
      0
    );
    const width = maxColOffset + 1;
    const height = maxRowOffset + 1;

    let attempts = 0;
    while (attempts < 20) {
      const startCol = randInt(0, cols - width);
      const startRow = 0;

      let blocked = false;
      for (const cell of shape.cells) {
        const r = startRow + cell.offsetRow;
        const c = startCol + cell.offsetCol;
        if (
          r < 0 ||
          r >= rows ||
          c < 0 ||
          c >= cols ||
          (grid[r] && grid[r][c] !== null)
        ) {
          blocked = true;
          break;
        }
      }

      if (!blocked && level.syllablePool.length > 0) {
        const pieceCells: PieceCell[] = shape.cells.map((c) => ({
          offsetRow: c.offsetRow,
          offsetCol: c.offsetCol,
          syllable: choice(level.syllablePool).value,
          color: shape.color,
        }));
        setCurrentPiece({ row: startRow, col: startCol, cells: pieceCells });
        setNextShape(choice(SHAPES));
        return;
      }

      attempts++;
    }

    setGameOver(true);
    setFeedback("La grille est pleine : fin de la partie.");
  };

const applyWordClears = async (g: Cell[][]) => {
  if (!level) return { newGrid: g, scoreDelta: 0, completedWords: [] as string[] };

  const rows = g.length;
  const cols = g[0]?.length ?? 0;
  const toClear = new Set<string>();
  const completedWords: string[] = [];
  let scoreDelta = 0;

  // Tous les candidats de mots (horizontaux + verticaux)
  const candidates: { word: string; coords: { r: number; c: number }[] }[] = [];

  // 1) HORIZONTAL : on parcourt chaque ligne
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      // Sauter les cases vides
      while (c < cols && g[r][c] === null) c++;
      if (c >= cols) break;

      const segment: { col: number; syl: string }[] = [];
      while (c < cols && g[r][c] !== null) {
        segment.push({ col: c, syl: (g[r][c] as Cell)!.syllable });
        c++;
      }
      if (segment.length === 0) continue;

      const segLen = segment.length;
      const syms = segment.map((s) => s.syl);

      // Toutes les sous-séquences possibles dans ce segment
      for (let i = 0; i < segLen; i++) {
        for (let j = i + 1; j <= segLen; j++) {
          const subSyms = syms.slice(i, j);
          const subJoined = subSyms.join("");
          const coords: { r: number; c: number }[] = [];
          for (let k = i; k < j; k++) {
            coords.push({ r, c: segment[k].col });
          }
          candidates.push({ word: subJoined, coords });
        }
      }
    }
  }

  // 2) VERTICAL : on parcourt chaque colonne
  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      // Sauter les cases vides
      while (r < rows && g[r][c] === null) r++;
      if (r >= rows) break;

      const segment: { row: number; syl: string }[] = [];
      while (r < rows && g[r][c] !== null) {
        segment.push({ row: r, syl: (g[r][c] as Cell)!.syllable });
        r++;
      }
      if (segment.length === 0) continue;

      const segLen = segment.length;
      const syms = segment.map((s) => s.syl);

      // Toutes les sous-séquences possibles dans ce segment vertical
      for (let i = 0; i < segLen; i++) {
        for (let j = i + 1; j <= segLen; j++) {
          const subSyms = syms.slice(i, j);
          const subJoined = subSyms.join("");
          const coords: { r: number; c: number }[] = [];
          for (let k = i; k < j; k++) {
            coords.push({ r: segment[k].row, c });
          }
          candidates.push({ word: subJoined, coords });
        }
      }
    }
  }

  // Si aucun candidat -> rien à faire
  if (candidates.length === 0) {
    return { newGrid: g, scoreDelta: 0, completedWords: [] as string[] };
  }

  try {
    const res = await fetch(`${BACKEND_URL}/syllatris-validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidates: candidates.map((c) => c.word) }),
    });
    // Grâce à la route sécurisée, normalement res.ok est toujours true,
    // mais on garde une petite sécurité
    if (!res.ok) {
      console.error("syllatris-validate HTTP error", res.status);
      return { newGrid: g, scoreDelta: 0, completedWords: [] as string[] };
    }
    const data = await res.json();
    const validWords: string[] = data.validWords || [];
    const validSet = new Set(validWords.map((w: string) => w.toLowerCase()));

    candidates.forEach((cand) => {
      if (validSet.has(cand.word.toLowerCase())) {
        cand.coords.forEach(({ r, c }) => {
          toClear.add(`${r}-${c}`);
        });
        completedWords.push(cand.word);
        scoreDelta += 80 + 20 * cand.word.length;
      }
    });
  } catch (err) {
    console.error("syllatris-validate error", err);
  }

  if (toClear.size === 0) {
    return { newGrid: g, scoreDelta: 0, completedWords: [] as string[] };
  }

  const newGrid: Cell[][] = g.map((row) => [...row]);
  toClear.forEach((key) => {
    const [rStr, cStr] = key.split("-");
    const rr = parseInt(rStr, 10);
    const cc = parseInt(cStr, 10);
    if (!Number.isNaN(rr) && !Number.isNaN(cc)) {
      newGrid[rr][cc] = null;
    }
  });

  // Gravité par colonne
  for (let c = 0; c < cols; c++) {
    const stack: Cell[] = [];
    for (let r = rows - 1; r >= 0; r--) {
      const cell = newGrid[r][c];
      if (cell !== null) {
        stack.push(cell);
      }
    }
    let writeRow = rows - 1;
    for (const cell of stack) {
      newGrid[writeRow][c] = cell;
      writeRow--;
    }
    for (let r = writeRow; r >= 0; r--) {
      newGrid[r][c] = null;
    }
  }

  return { newGrid, scoreDelta, completedWords };
};


  const advanceGame = () => {
    if (!level || gameOver) return;

    if (!currentPiece) {
      spawnNewPiece();
      return;
    }

    const rows = level.grid.rows;
    const cols = level.grid.cols;
    const { row, col, cells } = currentPiece;
    const nextRow = row + 1;

    let blocked = false;
    for (const cell of cells) {
      const r = nextRow + cell.offsetRow;
      const c = col + cell.offsetCol;
      if (
        r >= rows ||
        r < 0 ||
        c < 0 ||
        c >= cols ||
        (grid[r] && grid[r][c] !== null)
      ) {
        blocked = true;
        break;
      }
    }

    if (!blocked) {
      setCurrentPiece({ row: nextRow, col, cells });
      return;
    }

    // On verrouille la pièce
    setGrid((prev) => {
      const copy: Cell[][] = prev.map((r) => [...r]);
      for (const cell of cells) {
        const r = row + cell.offsetRow;
        const c = col + cell.offsetCol;
        if (r >= 0 && r < copy.length && c >= 0 && c < copy[0].length) {
          copy[r][c] = {
            syllable: cell.syllable,
            color: cell.color,
          };
        }
      }

      (async () => {
        const { newGrid, scoreDelta, completedWords } = await applyWordClears(
          copy
        );
        setGrid(newGrid);
        if (scoreDelta > 0) {
          setScore((s) => s + scoreDelta);
          const unique = [
            ...new Set(completedWords.map((w) => w.toLowerCase())),
          ];
          if (unique.length > 0) {
            setFeedback(`Tu as complété des mots : ${unique.join(", ")}.`);
          }
        }
      })();

      return copy;
    });

    setCurrentPiece(null);
  };

  const movePieceHorizontal = (dir: -1 | 1) => {
    if (!level || !currentPiece || gameOver) return;
    const rows = level.grid.rows;
    const cols = level.grid.cols;
    const { row, col, cells } = currentPiece;
    const newCol = col + dir;

    for (const cell of cells) {
      const r = row + cell.offsetRow;
      const c = newCol + cell.offsetCol;
      if (
        r < 0 ||
        r >= rows ||
        c < 0 ||
        c >= cols ||
        (grid[r] && grid[r][c] !== null)
      ) {
        return;
      }
    }

    setCurrentPiece({ row, col: newCol, cells });
  };

  const rotatePiece = () => {
    if (!level || !currentPiece || gameOver) return;
    const rows = level.grid.rows;
    const cols = level.grid.cols;
    const { row, col, cells } = currentPiece;

    let maxRowOffset = 0;
    cells.forEach((cell) => {
      if (cell.offsetRow > maxRowOffset) maxRowOffset = cell.offsetRow;
    });

    const rotatedCells: PieceCell[] = cells.map((cell) => {
      const newOffsetRow = cell.offsetCol;
      const newOffsetCol = maxRowOffset - cell.offsetRow;
      return {
        ...cell,
        offsetRow: newOffsetRow,
        offsetCol: newOffsetCol,
      };
    });

    // Vérifier collisions après rotation
    for (const cell of rotatedCells) {
      const r = row + cell.offsetRow;
      const c = col + cell.offsetCol;
      if (
        r < 0 ||
        r >= rows ||
        c < 0 ||
        c >= cols ||
        (grid[r] && grid[r][c] !== null)
      ) {
        return; // rotation impossible
      }
    }

    setCurrentPiece({ row, col, cells: rotatedCells });
  };

  const dropFast = () => {
    if (!level || !currentPiece || gameOver) return;
    const rows = level.grid.rows;
    const cols = level.grid.cols;
    let { row, col, cells } = currentPiece;

    while (true) {
      const nextRow = row + 1;
      let blocked = false;
      for (const cell of cells) {
        const r = nextRow + cell.offsetRow;
        const c = col + cell.offsetCol;
        if (
          r >= rows ||
          r < 0 ||
          c < 0 ||
          c >= cols ||
          (grid[r] && grid[r][c] !== null)
        ) {
          blocked = true;
          break;
        }
      }
      if (blocked) break;
      row = nextRow;
    }

    // On verrouille à la position finale
    setGrid((prev) => {
      const copy: Cell[][] = prev.map((r) => [...r]);
      for (const cell of cells) {
        const r = row + cell.offsetRow;
        const c = col + cell.offsetCol;
        if (r >= 0 && r < copy.length && c >= 0 && c < copy[0].length) {
          copy[r][c] = {
            syllable: cell.syllable,
            color: cell.color,
          };
        }
      }

      (async () => {
        const { newGrid, scoreDelta, completedWords } = await applyWordClears(
          copy
        );
        setGrid(newGrid);
        if (scoreDelta > 0) {
          setScore((s) => s + scoreDelta);
          const unique = [
            ...new Set(completedWords.map((w) => w.toLowerCase())),
          ];
          if (unique.length > 0) {
            setFeedback(`Tu as complété des mots : ${unique.join(", ")}.`);
          }
        }
      })();

      return copy;
    });

    setCurrentPiece(null);
  };

  const handleRestart = () => {
    setGameOver(false);
    setScore(0);
    setRound(1);
    loadLevel({ resetScore: true });
  };

  const handleNextLevel = () => {
    setRound((r) => r + 1);
    loadLevel();
  };

  if (!level) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 16,
        }}
      >
        {isLoading ? (
          <Text>Chargement de Syllatris…</Text>
        ) : (
          <Text>Impossible de charger Syllatris.</Text>
        )}
      </View>
    );
  }

  if (gameOver) {
    return (
      <View style={{ flex: 1, padding: 20, justifyContent: "center" }}>
        <Text style={{ fontSize: 22, fontWeight: "800", marginBottom: 8 }}>
          Fin de la partie
        </Text>
        <Text style={{ marginBottom: 4 }}>Score : {score}</Text>
        <Text style={{ marginBottom: 12 }}>Niveau : {level.difficulty}</Text>
        <TouchableOpacity
          onPress={handleRestart}
          style={{
            backgroundColor: "#2f80ed",
            borderRadius: 10,
            paddingVertical: 10,
            marginBottom: 8,
          }}
        >
          <Text
            style={{ color: "#fff", textAlign: "center", fontWeight: "700" }}
          >
            Rejouer
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const rows = level.grid.rows;
  const cols = level.grid.cols;

  // Pour le preview de la prochaine pièce
  let previewRows = 4;
  let previewCols = 4;
  let previewCells: { r: number; c: number }[] = [];
  let previewColor = "#64748b";

  if (nextShape) {
    let minR = Infinity,
      maxR = -Infinity,
      minC = Infinity,
      maxC = -Infinity;
    nextShape.cells.forEach((cell) => {
      if (cell.offsetRow < minR) minR = cell.offsetRow;
      if (cell.offsetRow > maxR) maxR = cell.offsetRow;
      if (cell.offsetCol < minC) minC = cell.offsetCol;
      if (cell.offsetCol > maxC) maxC = cell.offsetCol;
    });
    const h = maxR - minR + 1;
    const w = maxC - minC + 1;
    previewRows = Math.max(h, 2);
    previewCols = Math.max(w, 2);
    previewColor = nextShape.color;
    previewCells = nextShape.cells.map((cell) => ({
      r: cell.offsetRow - minR,
      c: cell.offsetCol - minC,
    }));
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <View>
          <Text style={{ fontSize: 13 }}>Score</Text>
          <Text style={{ fontSize: 18, fontWeight: "800" }}>{score}</Text>
        </View>
        <View>
          <Text style={{ fontSize: 13 }}>Niveau</Text>
          <Text style={{ fontSize: 16, fontWeight: "700" }}>
            {level.difficulty}
          </Text>
        </View>
        <View>
          <Text style={{ fontSize: 13 }}>Vitesse</Text>
          <Text style={{ fontSize: 16 }}>
            {(1000 / dropInterval).toFixed(1)} blocs/s
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 8,
        }}
      >
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: "700" }}>Syllatris</Text>
          <Text style={{ fontSize: 13, color: "#555", marginTop: 4 }}>
            Fais tomber des pièces de formes variées (comme dans Tetris)
            remplies de syllabes. Quand une suite de syllabes forme un mot du
            dictionnaire, les cases disparaissent et tu gagnes des points.
          </Text>
        </View>

        <View
          style={{
            alignItems: "center",
            paddingLeft: 4,
          }}
        >
          <Text style={{ fontSize: 12, marginBottom: 4 }}>Prochaine pièce</Text>
          <View
            style={{
              borderWidth: 1,
              borderColor: "#e5e7eb",
              borderRadius: 8,
              padding: 4,
              backgroundColor: "#0f172a",
            }}
          >
            {Array.from({ length: previewRows }).map((_, r) => (
              <View key={r} style={{ flexDirection: "row" }}>
                {Array.from({ length: previewCols }).map((_, c) => {
                  const hasBlock = previewCells.some(
                    (cell) => cell.r === r && cell.c === c
                  );
                  return (
                    <View
                      key={c}
                      style={{
                        width: 16,
                        height: 16,
                        margin: 1,
                        borderRadius: 3,
                        borderWidth: 1,
                        borderColor: hasBlock ? "#e5e7eb" : "#1f2937",
                        backgroundColor: hasBlock ? previewColor : "#020617",
                      }}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Plateau (terrain un peu plus petit : cases 20x20) */}
      <View
        style={{
          borderWidth: 1,
          borderColor: "#ddd",
          borderRadius: 12,
          padding: 4,
          marginBottom: 12,
          backgroundColor: "#020617",
          alignSelf: "center",
        }}
      >
        {Array.from({ length: rows }).map((_, r) => (
          <View key={r} style={{ flexDirection: "row" }}>
            {Array.from({ length: cols }).map((_, c) => {
              const baseCell = grid[r] ? grid[r][c] : null;

              let pieceCell: PieceCell | null = null;
              if (currentPiece) {
                for (const cell of currentPiece.cells) {
                  const rr = currentPiece.row + cell.offsetRow;
                  const cc = currentPiece.col + cell.offsetCol;
                  if (rr === r && cc === c) {
                    pieceCell = cell;
                    break;
                  }
                }
              }

              const cellData = pieceCell || baseCell;

              const hasSyll = !!cellData;
              const bg = hasSyll
                ? cellData!.color
                : "#020617";
              const borderColor = hasSyll ? "#e5e7eb" : "#1f2937";
              const textColor = "#f9fafb";
              const syl = cellData?.syllable ?? null;

              return (
                <View
                  key={c}
                  style={{
                    width: 20,
                    height: 20,
                    margin: 1,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: bg,
                  }}
                >
                  {syl ? (
                    <Text
                      style={{ fontSize: 8, color: textColor }}
                      numberOfLines={1}
                    >
                      {syl}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <View style={{ marginBottom: 12 }}>
        <Text
          style={{ fontSize: 13, fontWeight: "700", marginBottom: 4 }}
        >
          Mots à viser (optionnel)
        </Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 4,
          }}
        >
          {level.targetWords.map((w) => (
            <View
              key={w.word}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: "#ecfdf3",
                marginRight: 4,
                marginBottom: 4,
              }}
            >
              <Text style={{ fontSize: 11 }}>{w.word}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ alignItems: "center", marginBottom: 12 }}>
        <Text style={{ fontSize: 13, marginBottom: 4 }}>Contrôles</Text>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            marginBottom: 4,
          }}
        >
          <TouchableOpacity
            onPress={() => movePieceHorizontal(-1)}
            style={{
              padding: 8,
              borderRadius: 999,
              backgroundColor: "#e5e7eb",
              marginRight: 8,
            }}
          >
            <Text>◀</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={rotatePiece}
            style={{
              padding: 8,
              borderRadius: 999,
              backgroundColor: "#fef3c7",
              marginRight: 8,
            }}
          >
            <Text>⟳</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={dropFast}
            style={{
              padding: 8,
              borderRadius: 999,
              backgroundColor: "#fee2e2",
              marginRight: 8,
            }}
          >
            <Text>⬇⬇</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => movePieceHorizontal(1)}
            style={{
              padding: 8,
              borderRadius: 999,
              backgroundColor: "#e5e7eb",
            }}
          >
            <Text>▶</Text>
          </TouchableOpacity>
        </View>
      </View>

      {feedback && (
        <Text style={{ fontSize: 13, marginBottom: 8 }}>{feedback}</Text>
      )}

      <TouchableOpacity
        onPress={handleNextLevel}
        style={{
          marginTop: 8,
          backgroundColor: "#22c55e",
          paddingVertical: 10,
          borderRadius: 10,
        }}
      >
        <Text
          style={{ color: "#fff", textAlign: "center", fontWeight: "700" }}
        >
          Niveau suivant
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
