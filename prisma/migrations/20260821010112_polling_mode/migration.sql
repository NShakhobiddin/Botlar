-- CreateEnum
CREATE TYPE "BotMode" AS ENUM ('WEBHOOK', 'POLLING');

-- AlterTable
ALTER TABLE "Bot" ADD COLUMN     "mode" "BotMode" NOT NULL DEFAULT 'WEBHOOK';

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "telegramFileId" TEXT;
