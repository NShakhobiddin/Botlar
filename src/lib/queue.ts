import { Queue } from "bullmq";
import IORedis from "ioredis";

export const BROADCAST_QUEUE = "broadcast";

let connection: IORedis | null = null;

export function redis(): IORedis {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return connection;
}

let queue: Queue | null = null;

export function broadcastQueue(): Queue {
  if (!queue) {
    queue = new Queue(BROADCAST_QUEUE, { connection: redis() });
  }
  return queue;
}

export type BroadcastJob = { broadcastId: string };

export async function enqueueBroadcast(broadcastId: string, delayMs = 0) {
  await broadcastQueue().add(
    "send",
    { broadcastId } satisfies BroadcastJob,
    {
      jobId: `bc-${broadcastId}`,
      delay: delayMs > 0 ? delayMs : undefined,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
      attempts: 1,
    }
  );
}

export async function cancelBroadcastJob(broadcastId: string) {
  const job = await broadcastQueue().getJob(`bc-${broadcastId}`);
  await job?.remove().catch(() => {});
}
