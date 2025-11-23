// server/syllatrisDictionary.js
// Dictionnaire central pour Syllatris, basé sur le module NPM
// "an-array-of-french-words".
// Assure :
//   - une grosse liste de mots français
//   - un Set pour les vérifications rapides
//   - quelques helpers pratiques

import rawWords from "an-array-of-french-words";

// Certains modules CommonJS sont exposés différemment en ESM.
// On sécurise pour être sûr d'avoir un tableau de mots.
const words =
  Array.isArray(rawWords)
    ? rawWords
    : Array.isArray(rawWords?.default)
    ? rawWords.default
    : [];

console.log("[SyllatrisDictionary] mots bruts chargés :", words.length);

// 1) Nettoyage & filtrage de base
// - tout en minuscules
// - on enlève les mots trop courts ou trop longs
// - on enlève les entrées avec des caractères trop exotiques

function isReasonableWord(w) {
  if (!w) return false;
  const word = w.toLowerCase();

  // longueur minimale / maximale (à ajuster si tu veux)
  if (word.length < 3 || word.length > 24) return false;

  // garder uniquement lettres françaises + tiret et apostrophe
  // (on enlève chiffres, symboles, etc.)
  if (!/^[a-zàâçéèêëïîôùûüÿœæ'-]+$/.test(word)) return false;

  return true;
}

export const RAW_WORDS = words;

export const FILTERED_WORDS = words
  .map((w) => (w || "").toLowerCase())
  .filter((w, index, arr) => arr.indexOf(w) === index) // on enlève les doublons
  .filter(isReasonableWord);

// Set pour les vérifications O(1)
export const DICTIONARY_SET = new Set(FILTERED_WORDS);

console.log(
  "[SyllatrisDictionary] mots filtrés :",
  FILTERED_WORDS.length,
  " / taille du Set :",
  DICTIONARY_SET.size
);

// 2) Helper simple : savoir si un mot est valide
export function isValidWord(word) {
  if (!word) return false;
  return DICTIONARY_SET.has(word.toLowerCase());
}

// 3) Helper optionnel : récupérer un sous-ensemble pour les "mots à viser"
//    (par exemple : mots de longueur moyenne)
export function getTargetWordsSample(maxCount = 50) {
  const mids = FILTERED_WORDS.filter((w) => w.length >= 4 && w.length <= 10);
  // On prend les premiers pour la démo. Si tu veux, tu peux mélanger aléatoirement.
  return mids.slice(0, maxCount);
}
