-- B1: item uploader identity — who created each folder/file.
-- Nullable so existing rows are valid; backfilled to each room's owner (single-owner
-- rooms ⇒ the owner is the uploader). FK is ON DELETE SET NULL so deleting a user never
-- cascades away their items — they just lose the uploader link.

ALTER TABLE "items" ADD COLUMN "uploadedById" TEXT;

-- Backfill existing items to their room's owner.
UPDATE "items" i
  SET "uploadedById" = dr."ownerId"
  FROM "data_rooms" dr
  WHERE i."dataRoomId" = dr.id AND i."uploadedById" IS NULL;

CREATE INDEX "items_uploadedById_idx" ON "items"("uploadedById");

ALTER TABLE "items"
  ADD CONSTRAINT "items_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
