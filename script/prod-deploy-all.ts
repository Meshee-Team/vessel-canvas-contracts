import { logger } from './lib/logger.js'
import {CONFIG, getOrNewJsonRpcProvider, overwriteConfig} from "./lib/utils.js";
import {deployAttesterProxyContract, deployBadgeContract} from "./lib/deploy-contract.js";
import {
  toggleAttesterProxyFromDeployer,
  toggleBadgeAttesterFromDeployer,
  transferContractOwnerFromDeployer
} from "./lib/update-contract.js";

async function main(): Promise<void> {
  logger.info('========= Deploy all contracts =========')
  logger.info(`Chain ID: ${CONFIG.essential.CHAIN_ID}`)
  logger.info(`Current Block: ${await getOrNewJsonRpcProvider().getBlockNumber()}`)
  logger.info(`Node RPC: ${CONFIG.essential.NODE_RPC_URL}`)

  logger.info('========= Deploy AttesterProxy contract =========')
  const attesterProxyAddress = await deployAttesterProxyContract(CONFIG.essential.EAS_ADDRESS)

  logger.info('========= Toggle AttesterProxy contract and transfer ownership =========')
  await toggleAttesterProxyFromDeployer(attesterProxyAddress, CONFIG.essential.ATTESTER_ADDRESS)
  await transferContractOwnerFromDeployer(attesterProxyAddress, CONFIG.essential.ADMIN_ADDRESS)

  logger.info('========= Deploy contract for badges =========')
  for (const badge of CONFIG.essential.BADGES) {
    const badgeAddress = await deployBadgeContract(badge.NAME, CONFIG.essential.BADGE_RESOLVER_ADDRESS, badge.URI)
    logger.info(`Badge ${badge.ID} is deployed to ${badgeAddress}`)
    badge.ADDRESS = badgeAddress

    logger.info(`Toggle badge contract ${badgeAddress} and transfer ownership`)
    await toggleBadgeAttesterFromDeployer(badgeAddress, attesterProxyAddress)
    await transferContractOwnerFromDeployer(badgeAddress, CONFIG.essential.ADMIN_ADDRESS)
  }

  logger.info('========= Update config file =========')
  CONFIG.essential.ATTESTER_PROXY_ADDRESS = attesterProxyAddress
  overwriteConfig()
}

main().then().catch(e => {
  logger.error(e)
  process.exit(-1)
})
