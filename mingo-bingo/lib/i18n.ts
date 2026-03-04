export type Locale = "en" | "fr" | "es";

export interface Translations {
  // Header
  appTitle: string;
  rngTracker: string;
  // Counter
  songsPlayed: string;
  // Song button
  songPlayed: string;
  allSongsCalled: string;
  // Reset
  resetGame: string;
  resetTitle: string;
  resetDescription: string;
  cancel: string;
  reset: string;
  // Probability panel
  oddsForRandomBoard: string;
  squares: string;
  fiveInARow: string;
  anyLine: string;
  twoLines: string;
  onOneBoard: string;
  blackout: string;
  fullBoard: string;
  impossible: string;
  oneIn: string;
}

export const translations: Record<Locale, Translations> = {
  en: {
    appTitle: "Mingo Bingo",
    rngTracker: "RNG Tracker",
    songsPlayed: "songs played",
    songPlayed: "Song Played!",
    allSongsCalled: "All Songs Called",
    resetGame: "Reset Game",
    resetTitle: "Reset the game?",
    resetDescription: "This will set the song count back to zero.",
    cancel: "Cancel",
    reset: "Reset",
    oddsForRandomBoard: "Odds for a random board",
    squares: "/ 25 squares",
    fiveInARow: "5-in-a-row",
    anyLine: "any line",
    twoLines: "Two lines",
    onOneBoard: "on one board",
    blackout: "Blackout",
    fullBoard: "full board",
    impossible: "impossible",
    oneIn: "1 in",
  },
  fr: {
    appTitle: "Mingo Bingo",
    rngTracker: "Suivi RNG",
    songsPlayed: "chansons jouées",
    songPlayed: "Chanson Jouée !",
    allSongsCalled: "Toutes Jouées",
    resetGame: "Réinitialiser",
    resetTitle: "Réinitialiser ?",
    resetDescription: "Cela remettra le compteur de chansons à zéro.",
    cancel: "Annuler",
    reset: "Réinitialiser",
    oddsForRandomBoard: "Probabilités pour une grille aléatoire",
    squares: "/ 25 cases",
    fiveInARow: "5 d'affilée",
    anyLine: "toute ligne",
    twoLines: "Deux lignes",
    onOneBoard: "sur une grille",
    blackout: "Noircissement",
    fullBoard: "grille entière",
    impossible: "impossible",
    oneIn: "1 sur",
  },
  es: {
    appTitle: "Mingo Bingo",
    rngTracker: "Rastreador RNG",
    songsPlayed: "canciones tocadas",
    songPlayed: "¡Canción Tocada!",
    allSongsCalled: "Todo Cantado",
    resetGame: "Reiniciar",
    resetTitle: "¿Reiniciar el juego?",
    resetDescription: "Esto pondrá el contador de canciones a cero.",
    cancel: "Cancelar",
    reset: "Reiniciar",
    oddsForRandomBoard: "Probabilidades para un cartón aleatorio",
    squares: "/ 25 casillas",
    fiveInARow: "5 en línea",
    anyLine: "cualquier línea",
    twoLines: "Dos líneas",
    onOneBoard: "en un cartón",
    blackout: "Cartón lleno",
    fullBoard: "tablero completo",
    impossible: "imposible",
    oneIn: "1 en",
  },
};

export const localeLabels: Record<Locale, string> = {
  en: "EN",
  fr: "FR",
  es: "ES",
};
