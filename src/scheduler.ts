import { Cron } from "croner";
import { dreamingPipeline } from "memok-ai";
import { buildMemokPipelineConfig } from "./memokEnvConfig.js";
import { logger } from "./logger.js";
import { getConfig } from "./config.js";

let currentCron: Cron | null = null;

function getDreamTime(): string {
  const cfg = getConfig();
  const time = cfg.dreamTime;
  if (typeof time === "string" && /^\d{2}:\d{2}$/.test(time)) {
    return time;
  }
  return "03:00";
}

function buildCronPattern(time: string): string {
  const [hour, minute] = time.split(":");
  return `${minute} ${hour} * * *`;
}

async function runDreamingJob(): Promise<void> {
  logger.info("Scheduled dreaming job started");
  const start = Date.now();
  try {
    const base = buildMemokPipelineConfig();
    if (!base.openaiApiKey) {
      logger.warn("Skipping dreaming: openaiApiKey not configured");
      return;
    }
    const dreamLogWarn = (msg: string) => {
      logger.warn(`[memok dream_log] ${msg}`);
    };
    const result = await dreamingPipeline({
      ...base,
      dreamLogWarn,
    });
    logger.info(
      {
        elapsedMs: Date.now() - start,
        predream: result.predream,
        storyRuns: result.storyWordSentencePipeline.plannedRuns,
      },
      "Scheduled dreaming job completed",
    );
  } catch (e) {
    logger.error({ err: e, elapsedMs: Date.now() - start }, "Scheduled dreaming job failed");
  }
}

export function startDreamScheduler(): void {
  stopDreamScheduler();
  const time = getDreamTime();
  const pattern = buildCronPattern(time);
  logger.info({ scheduleTime: time, pattern }, "Starting dream scheduler");
  const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  currentCron = new Cron(pattern, { timezone: systemTz }, runDreamingJob);
}

export function stopDreamScheduler(): void {
  if (currentCron) {
    currentCron.stop();
    currentCron = null;
    logger.info("Dream scheduler stopped");
  }
}

export function restartDreamScheduler(): void {
  stopDreamScheduler();
  startDreamScheduler();
}

export function getDreamScheduleStatus(): { running: boolean; time: string; pattern: string } {
  const time = getDreamTime();
  return {
    running: currentCron !== null,
    time,
    pattern: buildCronPattern(time),
  };
}
