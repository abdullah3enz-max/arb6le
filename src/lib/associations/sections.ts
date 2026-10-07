/*
 * How associations are grouped on the page. Client-safe (no server imports). A section is shown
 * only when it has at least one association — an empty "🔊 ربط صوتي: ما لقينا" is never rendered.
 */

export type AssociationTypeKey =
  | 'NUMERIC'
  | 'PHONETIC'
  | 'VISUAL'
  | 'CHARACTER'
  | 'SCENE'
  | 'WORD'
  | 'CONCEPTUAL'
  | 'MINI_STORY';

export type SectionKey = 'numbers' | 'sound' | 'screen' | 'anime' | 'games' | 'sports' | 'concept';

export const SECTIONS: { key: SectionKey; title: string }[] = [
  { key: 'numbers', title: '🔢 ربط بالأرقام' },
  { key: 'sound', title: '🔊 ربط صوتي وكلمات' },
  { key: 'screen', title: '🎬 ربط بالأفلام والمسلسلات' },
  { key: 'anime', title: '🍥 ربط بالأنمي' },
  { key: 'games', title: '🎮 ربط بالألعاب' },
  { key: 'sports', title: '⚽ ربط بالرياضة' },
  { key: 'concept', title: '🧠 ربط مفاهيمي' }
];

export const TYPE_LABEL: Record<AssociationTypeKey, string> = {
  NUMERIC: '🔢 رقم',
  PHONETIC: '🔊 تشابه صوتي',
  VISUAL: '👁️ ربط بصري',
  CHARACTER: '🎭 شخصية',
  SCENE: '🎬 مشهد',
  WORD: '🔤 كلمة تعرفها',
  CONCEPTUAL: '🧠 مفهوم',
  MINI_STORY: '📖 قصة قصيرة'
};

const LEGACY: Record<string, AssociationTypeKey> = {
  DIRECT: 'CHARACTER',
  MEASUREMENT: 'NUMERIC',
  SEMANTIC: 'CONCEPTUAL',
  STRUCTURAL: 'CONCEPTUAL',
  NARRATIVE: 'SCENE',
  POP_CULTURE: 'CHARACTER',
  SPORTS: 'CHARACTER',
  EVERYDAY: 'CONCEPTUAL'
};

const BY_LEVEL: Record<string, AssociationTypeKey> = {
  DIRECT_MATCH: 'NUMERIC',
  PHONETIC: 'PHONETIC',
  VISUAL: 'VISUAL',
  FAMOUS_ASSOCIATION: 'CHARACTER',
  CONTEXTUAL: 'CONCEPTUAL'
};

/** The A-H type of a stored connection, including rows saved by older engines. */
export function associationTypeOf(scoreBreakdown: unknown, associationLevel: string): AssociationTypeKey {
  const raw = (scoreBreakdown as { connectionType?: string } | null)?.connectionType;
  if (raw && raw in TYPE_LABEL) return raw as AssociationTypeKey;
  if (raw && LEGACY[raw]) return LEGACY[raw]!;
  return BY_LEVEL[associationLevel] ?? 'CONCEPTUAL';
}

export function sectionOf(type: AssociationTypeKey, worldCategory: string): SectionKey {
  if (type === 'NUMERIC') return 'numbers';
  if (type === 'PHONETIC' || type === 'WORD') return 'sound';
  switch (worldCategory) {
    case 'SERIES':
    case 'MOVIES':
    case 'CHARACTERS':
      return 'screen';
    case 'ANIME':
      return 'anime';
    case 'GAMES':
      return 'games';
    case 'FOOTBALL':
      return 'sports';
    default:
      return 'concept';
  }
}

export function confidenceOf(scoreBreakdown: unknown): string | null {
  const c = (scoreBreakdown as { confidence?: unknown } | null)?.confidence;
  return typeof c === 'string' ? c : null;
}
