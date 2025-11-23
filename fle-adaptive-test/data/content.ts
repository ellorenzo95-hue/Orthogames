// data/content.ts

export type CEFR = "A1" | "A2" | "B1" | "B2" | "C1";

export interface Dictation {
  id: string;
  title: string;
  text: string;
  level: CEFR;
}

export interface ImageTask {
  id: string;
  title: string;
  description: string; // consigne à afficher
  level: CEFR;
  source: any; 
}

export const dictations: Dictation[] = [
  // ------------ A1 ------------
  {
    id: "DICT-A1-1",
    level: "A1",
    title: "Ma journée simple",
    text:
      "Je me lève à sept heures. Je prends une douche puis je bois un café. " +
      "Je vais au travail à pied. Je parle un peu avec mes collègues. " +
      "Le soir, je rentre à la maison et je regarde un film."
  },
  {
    id: "DICT-A1-2",
    level: "A1",
    title: "Au supermarché",
    text:
      "Aujourd’hui, je vais au supermarché. Je prends un panier à l’entrée. " +
      "J’achète du pain, du lait, des pommes et du riz. " +
      "Je passe à la caisse, je paie et je rentre chez moi."
  },
  {
    id: "DICT-A1-3",
    level: "A1",
    title: "Ma famille",
    text:
      "Je vis avec ma famille. J’ai un frère et une sœur. " +
      "Ma mère travaille dans une école. Mon père cuisine souvent le soir. " +
      "Le week-end, nous mangeons ensemble et nous jouons à des jeux."
  },

  // ------------ A2 ------------
  {
    id: "DICT-A2-1",
    level: "A2",
    title: "Un week-end à la campagne",
    text:
      "Le week-end dernier, je suis allé à la campagne chez mes grands-parents. " +
      "Nous avons fait une longue promenade dans la forêt. " +
      "Le soir, nous avons préparé un bon dîner avec des légumes du jardin. " +
      "Je suis rentré à la maison dimanche soir, un peu fatigué mais très content."
  },
  {
    id: "DICT-A2-2",
    level: "A2",
    title: "Un nouveau collègue",
    text:
      "Ce matin, un nouveau collègue est arrivé au bureau. " +
      "Il s’appelle Karim et il vient du Maroc. " +
      "Il parle très bien français mais fait encore quelques petites fautes. " +
      "Toute l’équipe l’a accueilli avec le sourire et nous avons pris un café ensemble."
  },
  {
    id: "DICT-A2-3",
    level: "A2",
    title: "Mon trajet quotidien",
    text:
      "Chaque jour, je prends le métro pour aller au travail. " +
      "Le matin, il y a beaucoup de monde et les wagons sont souvent pleins. " +
      "Je lis un livre ou j’écoute de la musique pendant le trajet. " +
      "Quand j’arrive au bureau, je commence toujours par lire mes e-mails."
  },

  // ------------ B1 ------------
  {
    id: "DICT-B1-1",
    level: "B1",
    title: "Une mauvaise surprise",
    text:
      "Hier soir, en rentrant chez moi, j’ai eu une mauvaise surprise. " +
      "Je me suis rendu compte que j’avais oublié mes clés au travail. " +
      "Il faisait froid et je n’avais pas mon manteau. " +
      "J’ai appelé un collègue qui était encore au bureau. " +
      "Heureusement, il a trouvé mes clés sur mon bureau et me les a apportées."
  },
  {
    id: "DICT-B1-2",
    level: "B1",
    title: "Un projet important",
    text:
      "Depuis plusieurs semaines, je travaille sur un projet important avec mon équipe. " +
      "Nous devons préparer une présentation claire et dynamique pour notre directeur. " +
      "Chacun est responsable d’une partie différente du travail. " +
      "Nous avons déjà eu quelques désaccords, mais nous avons réussi à trouver des solutions ensemble."
  },
  {
    id: "DICT-B1-3",
    level: "B1",
    title: "Changer de ville",
    text:
      "L’année dernière, j’ai décidé de quitter ma petite ville pour m’installer à Paris. " +
      "Au début, j’étais un peu perdu à cause du bruit et du monde dans les rues. " +
      "Petit à petit, j’ai découvert de nouveaux quartiers, des cafés agréables et un parc près de chez moi. " +
      "Aujourd’hui, je me sens beaucoup plus à l’aise dans cette grande ville."
  },

  // ------------ B2 ------------
  {
    id: "DICT-B2-1",
    level: "B2",
    title: "Travailler à distance",
    text:
      "Depuis la pandémie, de nombreuses entreprises ont adopté le télétravail. " +
      "Ce mode d’organisation permet aux employés de travailler depuis chez eux, " +
      "ce qui réduit le temps passé dans les transports. " +
      "Cependant, il peut aussi créer un sentiment d’isolement et rendre la communication moins spontanée. " +
      "Pour garder une bonne dynamique d’équipe, il est essentiel d’organiser des réunions régulières en visioconférence."
  },
  {
    id: "DICT-B2-2",
    level: "B2",
    title: "Un choix difficile",
    text:
      "Après plusieurs années d’études, Clara doit prendre une décision importante pour son avenir. " +
      "Elle hésite entre accepter un poste bien payé dans une grande entreprise ou continuer ses études à l’étranger. " +
      "D’un côté, le travail lui offrirait une certaine stabilité financière. " +
      "De l’autre, partir à l’étranger lui permettrait de découvrir une nouvelle culture et de perfectionner son anglais."
  },
  {
    id: "DICT-B2-3",
    level: "B2",
    title: "L’impact des réseaux sociaux",
    text:
      "Les réseaux sociaux occupent une place grandissante dans notre vie quotidienne. " +
      "Ils facilitent le contact avec nos proches et nous permettent de suivre l’actualité en temps réel. " +
      "Cependant, ils peuvent aussi diffuser de fausses informations très rapidement. " +
      "Il est donc indispensable de vérifier la source d’un contenu avant de le partager, " +
      "et de garder un esprit critique face à ce que l’on lit en ligne."
  }
];

export const imageTasks: ImageTask[] = [
  {
    id: "IMG-A1-PARK-01",
    title: "Scène au parc (A1)",
    level: "A1",
    description:
      "Décris simplement ce que tu vois : les personnes, les animaux, le temps, les objets.",
    source: require("../assets/images/A1.png"),
  },
  {
    id: "IMG-A2-PARK-01",
    title: "Scène au parc (A2)",
    level: "A2",
    description:
      "Décris la scène : qui est dans le parc, que font les gens, quels objets tu vois.",
    source: require("../assets/images/A2.png"),
  },
  {
    id: "IMG-B1-STREET-01",
    title: "Rue animée (B1)",
    level: "B1",
    description:
      "Décris la rue, les personnes, ce qu’elles font, les véhicules et les bâtiments.",
    source: require("../assets/images/B1.png"),
  },
  {
    id: "IMG-B1B2-CAFE-01",
    title: "Café (B1/B2)",
    level: "B1",
    description:
      "Décris l’ambiance du café, les personnages, leurs actions et les détails de la scène.",
    source: require("../assets/images/B1B2.png"),
  },
  {
    id: "IMG-B2-STATION-01",
    title: "Gare ou métro (B2)",
    level: "B2",
    description:
      "Décris la scène en détail : les voyageurs, leurs attitudes, l’espace, les éléments importants.",
    source: require("../assets/images/B2.png"),
  },
];

