/** Shared "back of card" formatting — used both by the pipeline's automatic flashcard creation
 * and anywhere else a flashcard gets built, so every card looks the same: the real info first,
 * then the isolated short fact, then (only when a bridge actually exists) a reminder of what we
 * linked it to. Never invents a bridge line when there isn't one. */
export function buildFlashcardBack(params: {
  summary: string;
  atomLabel: string;
  bridge?: { atomEmoji: string; bridgeLine: string } | null;
}): string {
  const parts = [params.summary];
  if (params.atomLabel) parts.push(`📌 ${params.atomLabel}`);
  if (params.bridge) parts.push(`🔗 تذكّرها: ربطناها بـ ${params.bridge.atomEmoji} ${params.bridge.bridgeLine}`);
  return parts.join('\n\n');
}
