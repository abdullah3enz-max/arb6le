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

/**
 * The fact's own shape, decided before any association is searched. It decides which
 * association types are even allowed (a number bridge needs a number) — see factTypes.ts.
 */
export type FactType =
  | 'NUMBER'
  | 'NAME'
  | 'TERM'
  | 'ENGLISH_WORD'
  | 'ACRONYM'
  | 'LIST'
  | 'PROCESS'
  | 'CONCEPT'
  | 'LOCATION'
  | 'TIME'
  | 'CAUSE_EFFECT'
  | 'OTHER';

/**
 * The association types A-H. No type is "first" in general: every allowed type competes and the
 * judge's scores pick the winner. MINI_STORY is the last resort and is capped at one short sentence.
 */
export type BridgeConnectionType =
  | 'NUMERIC' // A: 7 mg → Ronaldo #7
  | 'PHONETIC' // B: Salt → سلطة
  | 'VISUAL' // C: Spider → Spider-Man
  | 'CHARACTER' // D: Detective → Sherlock Holmes
  | 'SCENE' // E: a real, famous scene/event/place/object from a work
  | 'WORD' // F: the new word → a word the student already knows
  | 'CONCEPTUAL' // G: a clearly similar everyday concept
  | 'MINI_STORY'; // H: last resort, one very short sentence
export type AssociationType = BridgeConnectionType;

/** Internal rejection codes — never shown to the student, kept for debugging and benchmarks. */
export type RejectReason =
  | 'weak_relation'
  | 'hallucination_risk'
  | 'too_long'
  | 'confusing'
  | 'obscure_reference'
  | 'forced_interest'
  | 'duplicate'
  | 'inaccurate'
  | 'requires_explanation';

/** One discovered association, always anchored on an element of the fact. */
export interface BridgeCandidate {
  id: string;
  anchor: string;
  connectionType: BridgeConnectionType;
  worldCategory: WorldCategory;
  /** The familiar thing: "Cristiano Ronaldo", "سلطة". */
  worldRef: string;
  atomEmoji: string;
  /** The whole association at one glance: "7 → Ronaldo #7". */
  bridgeLine: string;
  whyOneLiner: string;
  /** The external, independently checkable fact the association relies on. */
  evidence: string;
  /** Discovery's own certainty that `evidence` is literally true (0-1). */
  confidence: number;
  /** Logical steps between the anchor and the reference (1 = direct). */
  relationDistance: number;
  /** PHONETIC only: the term, how it sounds in Arabic letters, and the reference's matching sound. */
  phonetic?: PhoneticMatch;
  /** True when it came from the student's own interests — the judge checks it wasn't forced. */
  fromInterest?: boolean;
  /** Set when the association rests on a retrieved, verified interest fact (no model memory). */
  interestFactId?: string;
}

export interface PhoneticMatch {
  term: string;
  soundsLike: string;
  matchedSound: string;
}

/** The independent judge's view of one candidate (all scores 0-10). */
export interface BridgeVerdict {
  id: string;
  directness: number;
  familiarity: number;
  memorability: number;
  truthfulness: number;
  simplicity: number;
  /** 0 = none, 10 = almost certainly made up. */
  hallucinationRisk: number;
  /** Would a student get it within 2 seconds, without an explanation? */
  twoSecondTest: boolean;
  /** Does it encode the fact itself (its number/term/meaning), not a neighbouring idea? */
  coversFact: boolean;
  /** Is the familiar thing concrete and specific (a named thing, scene, word), not a vague category? */
  specific: boolean;
  /** Obvious, not merely possible. */
  obvious: boolean;
  /** Only "works" because it's the student's favourite thing. */
  forcedInterest: boolean;
  /** PHONETIC only: is the sound match clear (a full chunk, not a letter or two)? */
  phoneticClear: boolean;
  rejectReason: RejectReason | null;
  reason: string;
}

export interface ScoredBridge {
  candidate: BridgeCandidate;
  verdict: BridgeVerdict;
  /** 0-1 association quality from the judge alone; must clear the threshold on its own. */
  quality: number;
  /** 0-1 personal preference; only reorders associations that already passed. */
  preference: number;
  /** 0.8 × quality + 0.2 × preference. */
  final: number;
}
