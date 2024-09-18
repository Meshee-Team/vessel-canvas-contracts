import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { BadgeServer } from './lib/badge-server';
import { StatsServerClient } from './lib/stats-server-client';
import {initializeSentry, loadBadges} from './lib/utils';
import {logger} from "./lib/logger";
import path from "path";
import * as Sentry from "@sentry/node";

const main = async () => {
  dotenv.config()
  const env = process.env.ENV!
  const port = process.env.PORT || 8080;
  const statsServerBaseUrl = process.env.STATS_SERVER_BASE_URL!
  const attestorPrivateKey = process.env.ATTESTOR_PRIVATE_KEY!
  const jsonRpcEndpoint = process.env.JSON_RPC_ENDPOINT!

  // initialize sentry
  initializeSentry(env)

  // instantiate badge config
  const badgeConfigFileName = path.resolve(process.cwd(), `badge-config-${env}.json`);
  const badgeMap = await loadBadges(badgeConfigFileName);

  // instantiate service
  const statsClient = new StatsServerClient(statsServerBaseUrl);
  const badgeServer = new BadgeServer(badgeMap, statsClient, jsonRpcEndpoint, attestorPrivateKey);
  await badgeServer.initialize()

  const app = express();
  app.use(cors());
  app.get('/check', badgeServer.checkHandler.bind(badgeServer));
  app.get('/claim', badgeServer.claimHandler.bind(badgeServer));

  app.listen(port, () => {
    logger.info(`Server is running on http://localhost:${port}`);
    Sentry.captureMessage(`Scroll Canvas service starts running`)
  });
};

main().then().catch(e => {
  logger.error(`server exit with error ${e}`)
  Sentry.captureException(e)
// sleep 900s to prevent continuous alarm
  new Promise(resolve => setTimeout(resolve, 900000)).then()
})


