-- DropIndex
DROP INDEX "data_rooms_ownerId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "data_rooms_ownerId_key" ON "data_rooms"("ownerId");
