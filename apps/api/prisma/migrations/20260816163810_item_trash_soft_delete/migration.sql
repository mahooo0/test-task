-- AlterEnum
ALTER TYPE "ItemStatus" ADD VALUE 'TRASHED';

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "items_dataRoomId_status_idx" ON "items"("dataRoomId", "status");
