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
  connectionStyles: string[]; // stories | characters | events | cause_effect | comparisons | visual
  /** style/world weights from the Personalization Engine, higher = prefer more */
  weights: Record<string, number>;
}

export type WorldCategory =
  | 'SERIES'
  | 'MOVIES'
  | 'FOOTBALL'
  | 'GAMES'
  | 'ANIME'
  | 'CHARACTERS'
  | 'BOOKS'
  | 'DAILY_LIFE';

export type ConnectionType =
  | 'CHARACTER'
  | 'EVENT'
  | 'CAUSE_EFFECT'
  | 'SEQUENCE'
  | 'CONTRAST'
  | 'STORY'
  | 'VISUAL'
  | 'COMPARISON';

export type ClaimType = 'FACT' | 'ANALOGY' | 'INTERPRETATION';
export type SourceKind = 'KNOWLEDGE_BASE' | 'LIVE_SEARCH' | 'USER_PROVIDED';

export interface ConnectionSourceDraft {
  sourceType: SourceKind;
  url?: string;
  title?: string;
  confidence: number; // 0-1
  evidenceSnippet: string;
}

export interface ConnectionCandidate {
  type: ConnectionType;
  worldCategory: WorldCategory;
  worldRef: string;
  headline: string;
  relationExplain: string;
  memoryHook: string;
  claimType: ClaimType;
  sources: ConnectionSourceDraft[];
  scoreBreakdown: {
    semanticRelevance: number;
    factualAccuracy: number;
    relationshipStrength: number;
    memorability: number;
    preferenceMatch: number;
    contextMatch: number;
    specificity: number;
  };
}

export interface CriticVerdict {
  verdict: 'APPROVE' | 'REJECT';
  failedQuestion?: number; // 1-8, see docs/ARCHITECTURE.md §5
  reason: string;
}
