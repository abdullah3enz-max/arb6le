-- Existing rows were only ever written on a successful provider call (see router.ts before this
-- change), so backfilling them as success=true is accurate, not a guess.
ALTER TABLE "AiGeneration" ADD COLUMN     "success" BOOLEAN NOT NULL DEFAULT true;
