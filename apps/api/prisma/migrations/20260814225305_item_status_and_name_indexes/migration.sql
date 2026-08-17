-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('PENDING', 'ACTIVE');

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "status" "ItemStatus" NOT NULL,
ADD COLUMN     "uploadedAt" TIMESTAMP(3);

-- DropIndex
DROP INDEX "items_dataRoomId_parentId_idx";

-- CreateIndex
CREATE INDEX "items_dataRoomId_parentId_type_name_idx" ON "items"("dataRoomId", "parentId", "type", "name");

-- CreateIndex (partial UNIQUE — sibling-name uniqueness among ACTIVE items; not expressible in Prisma DSL)
CREATE UNIQUE INDEX "items_parent_name_active_uq" ON "items"("parentId", "name") WHERE "parentId" IS NOT NULL AND "status" = 'ACTIVE';

-- CreateIndex (partial UNIQUE — room-root siblings; NULLs are distinct in Postgres, so scope by dataRoomId)
CREATE UNIQUE INDEX "items_room_root_name_active_uq" ON "items"("dataRoomId", "name") WHERE "parentId" IS NULL AND "status" = 'ACTIVE';
