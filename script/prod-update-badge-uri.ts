import { logger } from './lib/logger.js'
import {CONFIG, formatAddress, getOrNewJsonRpcProvider, overwriteConfig} from "./lib/utils.js";
import {deployAttesterProxyContract, deployBadgeContract} from "./lib/deploy-contract.js";
import {
  toggleAttesterProxyFromDeployer,
  toggleBadgeAttesterFromDeployer,
  transferContractOwnerFromDeployer, updateBadgeUri
} from "./lib/update-contract.js";

async function main(): Promise<void> {
  logger.info('========= Deploy all contracts =========')
  logger.info(`Chain ID: ${CONFIG.essential.CHAIN_ID}`)
  logger.info(`Current Block: ${await getOrNewJsonRpcProvider().getBlockNumber()}`)
  logger.info(`Node RPC: ${CONFIG.essential.NODE_RPC_URL}`)

  const badgeAddress = "0xd0C35B7311531faDC790618e4B05B892d5d5a753"
  const newUri = "agou"

  logger.info(`try to update URI of badge ${badgeAddress} to ${newUri}`)
  for (const badge of CONFIG.essential.BADGES) {
    if (formatAddress(badge.ADDRESS) === formatAddress(badgeAddress)) {
      logger.info(`find target badge ${badge}`)
      await updateBadgeUri(badgeAddress, newUri)
      badge.URI = newUri
    }
  }

  logger.info('========= Update config file =========')
  overwriteConfig()
}

main().then().catch(e => {
  logger.error(e)
  process.exit(-1)
})
