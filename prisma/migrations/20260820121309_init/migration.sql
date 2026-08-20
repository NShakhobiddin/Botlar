-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'VIEWER');

-- CreateEnum
CREATE TYPE "KeyboardType" AS ENUM ('INLINE', 'REPLY', 'NONE');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('NONE', 'PHOTO', 'VIDEO', 'DOCUMENT', 'ANIMATION');

-- CreateEnum
CREATE TYPE "ButtonAction" AS ENUM ('SCREEN', 'URL', 'WEBAPP', 'COMMAND', 'BACK', 'SHARE_CONTACT', 'SHARE_LOCATION');

-- CreateEnum
CREATE TYPE "BroadcastStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'DONE', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('START', 'COMMAND', 'MESSAGE', 'CALLBACK', 'SCREEN_VIEW', 'BLOCK', 'UNBLOCK', 'WEBAPP_OPEN', 'WEBAPP_EVENT', 'BROADCAST_SENT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "tokenCipher" TEXT NOT NULL,
    "tokenIv" TEXT NOT NULL,
    "tokenTag" TEXT NOT NULL,
    "webhookSecret" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "webhookSetAt" TIMESTAMP(3),
    "defaultLocale" TEXT NOT NULL DEFAULT 'uz',
    "locales" TEXT[] DEFAULT ARRAY['uz']::TEXT[],
    "requiredChannels" JSONB NOT NULL DEFAULT '[]',
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceText" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotCommand" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "screenId" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BotCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Screen" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyboardType" "KeyboardType" NOT NULL DEFAULT 'INLINE',
    "resizeKeyboard" BOOLEAN NOT NULL DEFAULT true,
    "oneTimeKeyboard" BOOLEAN NOT NULL DEFAULT false,
    "awaitsInput" BOOLEAN NOT NULL DEFAULT false,
    "inputField" TEXT,
    "inputNextKey" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Screen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenTranslation" (
    "id" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "parseMode" TEXT NOT NULL DEFAULT 'HTML',
    "mediaType" "MediaType" NOT NULL DEFAULT 'NONE',
    "mediaUrl" TEXT,

    CONSTRAINT "ScreenTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Button" (
    "id" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "labels" JSONB NOT NULL DEFAULT '{}',
    "action" "ButtonAction" NOT NULL DEFAULT 'SCREEN',
    "row" INTEGER NOT NULL DEFAULT 0,
    "col" INTEGER NOT NULL DEFAULT 0,
    "targetScreenId" TEXT,
    "url" TEXT,
    "webAppId" TEXT,
    "commandKey" TEXT,

    CONSTRAINT "Button_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotUser" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "username" TEXT,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'uz',
    "phone" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "currentScreenKey" TEXT,
    "awaitingField" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Broadcast" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "screenId" TEXT,
    "text" TEXT NOT NULL DEFAULT '',
    "parseMode" TEXT NOT NULL DEFAULT 'HTML',
    "mediaType" "MediaType" NOT NULL DEFAULT 'NONE',
    "mediaUrl" TEXT,
    "buttons" JSONB NOT NULL DEFAULT '[]',
    "disableNotification" BOOLEAN NOT NULL DEFAULT false,
    "segment" JSONB NOT NULL DEFAULT '{}',
    "status" "BroadcastStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "blockedCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BroadcastDelivery" (
    "id" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "botUserId" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "messageId" INTEGER,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "BroadcastDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebApp" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "trackKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebAppSession" (
    "id" TEXT NOT NULL,
    "webAppId" TEXT NOT NULL,
    "botUserId" TEXT,
    "telegramId" BIGINT,
    "platform" TEXT NOT NULL DEFAULT 'unknown',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPingAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "eventCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WebAppSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "botUserId" TEXT,
    "webAppId" TEXT,
    "type" "EventType" NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyStat" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "newUsers" INTEGER NOT NULL DEFAULT 0,
    "activeUsers" INTEGER NOT NULL DEFAULT 0,
    "blockedUsers" INTEGER NOT NULL DEFAULT 0,
    "messages" INTEGER NOT NULL DEFAULT 0,
    "webAppOpens" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Bot_username_key" ON "Bot"("username");

-- CreateIndex
CREATE UNIQUE INDEX "BotCommand_botId_command_key" ON "BotCommand"("botId", "command");

-- CreateIndex
CREATE INDEX "Screen_botId_idx" ON "Screen"("botId");

-- CreateIndex
CREATE UNIQUE INDEX "Screen_botId_key_key" ON "Screen"("botId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenTranslation_screenId_locale_key" ON "ScreenTranslation"("screenId", "locale");

-- CreateIndex
CREATE INDEX "Button_screenId_idx" ON "Button"("screenId");

-- CreateIndex
CREATE INDEX "BotUser_botId_createdAt_idx" ON "BotUser"("botId", "createdAt");

-- CreateIndex
CREATE INDEX "BotUser_botId_lastSeenAt_idx" ON "BotUser"("botId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "BotUser_botId_isBlocked_idx" ON "BotUser"("botId", "isBlocked");

-- CreateIndex
CREATE UNIQUE INDEX "BotUser_botId_telegramId_key" ON "BotUser"("botId", "telegramId");

-- CreateIndex
CREATE INDEX "Broadcast_botId_status_idx" ON "Broadcast"("botId", "status");

-- CreateIndex
CREATE INDEX "Broadcast_status_scheduledAt_idx" ON "Broadcast"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "BroadcastDelivery_broadcastId_status_idx" ON "BroadcastDelivery"("broadcastId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BroadcastDelivery_broadcastId_botUserId_key" ON "BroadcastDelivery"("broadcastId", "botUserId");

-- CreateIndex
CREATE UNIQUE INDEX "WebApp_trackKey_key" ON "WebApp"("trackKey");

-- CreateIndex
CREATE INDEX "WebAppSession_webAppId_startedAt_idx" ON "WebAppSession"("webAppId", "startedAt");

-- CreateIndex
CREATE INDEX "Event_botId_type_createdAt_idx" ON "Event"("botId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Event_botId_createdAt_idx" ON "Event"("botId", "createdAt");

-- CreateIndex
CREATE INDEX "DailyStat_botId_date_idx" ON "DailyStat"("botId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStat_botId_date_key" ON "DailyStat"("botId", "date");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bot" ADD CONSTRAINT "Bot_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotCommand" ADD CONSTRAINT "BotCommand_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotCommand" ADD CONSTRAINT "BotCommand_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Screen" ADD CONSTRAINT "Screen_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenTranslation" ADD CONSTRAINT "ScreenTranslation_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Button" ADD CONSTRAINT "Button_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Button" ADD CONSTRAINT "Button_targetScreenId_fkey" FOREIGN KEY ("targetScreenId") REFERENCES "Screen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Button" ADD CONSTRAINT "Button_webAppId_fkey" FOREIGN KEY ("webAppId") REFERENCES "WebApp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotUser" ADD CONSTRAINT "BotUser_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastDelivery" ADD CONSTRAINT "BroadcastDelivery_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "Broadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastDelivery" ADD CONSTRAINT "BroadcastDelivery_botUserId_fkey" FOREIGN KEY ("botUserId") REFERENCES "BotUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebApp" ADD CONSTRAINT "WebApp_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebAppSession" ADD CONSTRAINT "WebAppSession_webAppId_fkey" FOREIGN KEY ("webAppId") REFERENCES "WebApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebAppSession" ADD CONSTRAINT "WebAppSession_botUserId_fkey" FOREIGN KEY ("botUserId") REFERENCES "BotUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_botUserId_fkey" FOREIGN KEY ("botUserId") REFERENCES "BotUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_webAppId_fkey" FOREIGN KEY ("webAppId") REFERENCES "WebApp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyStat" ADD CONSTRAINT "DailyStat_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
