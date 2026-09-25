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

/** A memorable element of a fact that a bridge can hang on — the search starts from these. */
export type AnchorKind =
  | 'NUMBER'
  | 'RANGE'
  | 'MEASUREMENT'
  | 'TERM'
  | 'NAME'
  | 'SEQUENCE'
  | 'PROPERTY'
  | 'RELATION'
  | 'VISUAL';

export interface Anchor {
  text: string;
  kind: AnchorKind;
  /** 0-1: how much this element is worth memorizing and bridging ("approximately" ≈ 0). */
  relevance: number;
}

export type BridgeConnectionType =
  | 'DIRECT'
  | 'NUMERIC'
  | 'MEASUREMENT'
  | 'PHONETIC'
  | 'SEMANTIC'
  | 'STRUCTURAL'
  | 'VISUAL'
  | 'NARRATIVE'
  | 'POP_CULTURE'
  | 'SPORTS'
  | 'EVERYDAY';

/** One discovered bridge, always anchored on an element of the fact — never on the student. */
export interface BridgeCandidate {
  id: string;
  anchor: string;
  connectionType: BridgeConnectionType;
  worldCategory: WorldCategory;
  worldRef: string;
  atomEmoji: string;
  bridgeLine: string;
  whyOneLiner: string;
  /** The external, independently checkable fact the bridge relies on. */
  evidence: string;
  /** Discovery's own certainty that `evidence` is literally true (0-1). */
  confidence: number;
  /** Logical steps between the anchor and the reference (1 = direct). */
  relationDistance: number;
}

export type Forcedness = 'NATURAL' | 'WEAK' | 'FORCED';

/** The independent verifier's judgment of one candidate. Never sees the student's interests. */
export interface BridgeVerdict {
  id: string;
  factTrue: boolean;
  linkTrue: boolean;
  forcedness: Forcedness;
  relationDistance: number;
  coversMemoryTarget: boolean;
  scores: { connection: number; simplicity: number; memorability: number; evidence: number };
  reason: string;
}

export interface ScoredBridge {
  candidate: BridgeCandidate;
  verdict: BridgeVerdict;
  baseScore: number;
  /** 0-5 at most, added only after the quality gate — never rescues a weak bridge. */
  personalization: number;
  score: number;
}
