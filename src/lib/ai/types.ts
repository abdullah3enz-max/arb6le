export interface ParsedPage {
  pageNumber: number;
  rawText: string;
  usedOcr: boolean;
  tables?: unknown;
}

export interface ExtractedConcept {
  title: string;
  summary: string;
  importance: number; // 0-100
  conceptType: 'DEFINITION' | 'PROCESS' | 'CAUSE_EFFECT' | 'COMPARISON' | 'SEQUENCE' | 'TERMINOLOGY';
  sourcePageNumbers: number[];
  /**
   * The atomic fact itself, isolated from its explanation — this is what actually gets
   * bridged, never the surrounding sentence. "Dose = 7 mg" -> atomLabel "7 mg".
   * Falls back to the concept title when the slide has no clean isolated value.
   */
  atomLabel: string;
  atomEmoji: string; // a single emoji representing what kind of fact this is (💉 dose, ⏱️ time, 🫀 organ/term...)
}

export interface ConceptRelation {
  fromTitle: string;
  toTitle: string;
  relation: 'cause_effect' | 'sequence' | 'similar_term' | 'contrast';
}

export interface UserMemoryProfile {
  preferredWorlds: string[];
  favoriteTeams: string[];
  favoritePlayers: string[];
  favoriteShows: string[];
  favoriteMovies: string[];
  favoriteAnime: string[];
  favoriteGames: string[];
  favoriteCars: string[];
  favoriteMusic: string[];
  favoritePeople: string[];
  connectionStyles: string[]; // fast | funny | smart | visual | phonetic
  /** style/world weights from the Personalization Engine, higher = prefer more */
  weights: Record<string, number>;
}

export type WorldCategory =
  | 'SERIES'
  | 'MOVIES'
  | 'FOOTBALL'
  | 'GAMES'
  | 'ANIME'
  | 'CARS'
  | 'MUSIC'
  | 'PEOPLE'
  | 'CHARACTERS'
  | 'BOOKS'
  | 'DAILY_LIFE'
  /** A bridge to universal common knowledge, not to one of the student's saved interests —
   * see the WorldCategory Prisma enum for why this exists. */
  | 'GENERAL_KNOWLEDGE';

/**
 * The priority ladder (item 6 of the spec) — always attempt the lowest level first; it
 * produces the strongest, most instantly-understood bridge. Only fall through to a higher
 * level when the lower ones genuinely don't exist for this fact + this user's interests.
 */
export type AssociationLevel = 'DIRECT_MATCH' | 'PHONETIC' | 'VISUAL' | 'FAMOUS_ASSOCIATION' | 'CONTEXTUAL';

export type ClaimType = 'FACT' | 'ANALOGY' | 'INTERPRETATION';
export type SourceKind = 'KNOWLEDGE_BASE' | 'LIVE_SEARCH' | 'USER_PROVIDED';

export interface ConnectionSourceDraft {
  sourceType: SourceKind;
  url?: string;
  title?: string;
  confidence: number; // 0-1
  evidenceSnippet: string;
}

/**
 * Internal scoring only (item 8) — never shown to the user, used purely to pick the best
 * candidate and to gate what's shown at all. confusionRisk is inverted (higher = worse) and
 * subtracted, not averaged in with the rest.
 */
export interface AssociationScoreBreakdown {
  directness: number; // is this a 1:1 match, or does it need explaining?
  familiarity: number; // does the user actually know this reference well?
  simplicity: number; // can it be understood in under ~2 seconds?
  memorability: number; // will it actually stick?
  relevance: number; // does the bridge serve the real fact, not just sound clever?
  confusionRisk: number; // could this be misread as a different fact? (higher = worse)
}

export interface ConnectionCandidate {
  associationLevel: AssociationLevel;
  worldCategory: WorldCategory;
  worldRef: string; // "Cristiano Ronaldo"
  atomEmoji: string;
  atomLabel: string; // "7 mg" — the fact, verbatim, never altered
  bridgeLine: string; // the ENTIRE mnemonic: "Ronaldo = 7" — nothing longer
  whyOneLiner: string; // one or two short sentences max, shown only behind "ليش؟"
  claimType: ClaimType;
  sources: ConnectionSourceDraft[];
  scoreBreakdown: AssociationScoreBreakdown;
}

export interface CriticVerdict {
  verdict: 'APPROVE' | 'REJECT';
  failedCheck?:
    | 'factual_accuracy' // the real-world fact used (Ronaldo wears #7) is wrong
    | 'relationship_real' // the link is invented / coincidental, not a genuine match
    | 'hallucination' // a scene/stat/quote/event was made up
    | 'too_slow' // takes more than ~2 seconds to parse
    | 'weak_familiarity' // the reference isn't actually something this user knows
    | 'forced_by_preference'; // only "makes sense" because it's the student's favorite thing, not because the link itself is real
  reason: string;
}
