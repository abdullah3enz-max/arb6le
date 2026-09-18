-- Text extraction moved entirely client-side (browser); the server never receives a raw file
-- anymore, so there is nothing to store. This backfills textSizeKb from the old fileSizeKb
-- (a reasonable approximation for existing rows) before dropping the file-storage columns.

ALTER TABLE "Document" ADD COLUMN "textSizeKb" INTEGER;

UPDATE "Document" SET "textSizeKb" = "fileSizeKb";

ALTER TABLE "Document" ALTER COLUMN "textSizeKb" SET NOT NULL;

ALTER TABLE "Document" DROP COLUMN "fileSizeKb";
ALTER TABLE "Document" DROP COLUMN "storageKey";
