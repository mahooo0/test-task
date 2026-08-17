-- AlterTable
ALTER TABLE "items" ADD COLUMN     "starred" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "items_dataRoomId_starred_idx" ON "items"("dataRoomId", "starred");
