import fs from 'fs';
import {logger} from "./logger";
import {nodeProfilingIntegration} from "@sentry/profiling-node";
import * as Sentry from "@sentry/node";

export interface Badge {
  ID: string;
  NAME: string;
  ADDRESS: string;
  ATTESTER_PROXY_ADDRESS: string;
}

export function initializeSentry(env: string) {
  Sentry.init({
    dsn: "",
    integrations: [
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
  });
}

export function formatAddress(address: string): string {
  return address.toLowerCase().startsWith('0x') ? address.toLowerCase() : `0x${address.toLowerCase()}`;
}

export async function loadBadges(filepath: string): Promise<Map<string, Badge>>{
  logger.info(`Try to load badges from file: ${filepath}`)
  const data = await fs.promises.readFile(filepath, 'utf-8');
  const badges: Badge[] = JSON.parse(data);

  const badgeMap = new Map<string, Badge>();
  badges.forEach(badge => {
    badgeMap.set(formatAddress(badge.ADDRESS), badge);
  });

  logger.info(`Load badge configs from config file: ${Object.fromEntries(badgeMap)}`)
  return badgeMap;
}
