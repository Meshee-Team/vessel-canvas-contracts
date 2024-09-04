import {ContractTransaction, ethers} from "ethers";
import {logger} from "./logger.js";
import {
  CONFIG, loadAdminWallet, loadContract,
  loadDeployerWallet,
  sendAndWaitTransaction
} from "./utils.js";

/********************************************************************
 * Following updates are sent to VesselOwner contract for execution *
 ********************************************************************/

async function sendToAdminForExecution(rawTransaction: ContractTransaction) {
  if (CONFIG.essential.ENABLE_MULTISIG_ADMIN) {
    logger.info("================================================================")
    logger.info("SAFE transaction created, propose in SAFE UI using admin wallet")
    logger.info(`to: ${rawTransaction.to}`)
    logger.info(`data: ${rawTransaction.data}`)
    logger.info(`value: 0`)
    logger.info("================================================================")
    return
  }
  else {
    // directly send transaction using admin secret key
    const adminEOA = loadAdminWallet()
    await sendAndWaitTransaction(adminEOA, rawTransaction)
  }
}

export async function updateBadgeUri(
  badgeAddress: string,
  newUri: string
) {
  const contract: ethers.Contract = loadContract("VesselBadgeV1", badgeAddress)
  let rawTransaction = await contract.updateBadgeURI.populateTransaction(newUri)

  logger.info(`Send transaction to update badge ${badgeAddress} URI to ${newUri}`)
  await sendToAdminForExecution(rawTransaction)
}

/******************************************************************************
 * Following updates are directly sent by deployer to newly deployed contract *
 ******************************************************************************/

export async function toggleAttesterProxyFromDeployer(attesterProxyAddress:string, attesterAddress: string) {
  const contract: ethers.Contract = loadContract("AttesterProxy", attesterProxyAddress)
  const deployer = loadDeployerWallet()

  // send transaction to toggleAttester
  let rawTransaction = await contract.toggleAttester.populateTransaction(attesterAddress, true)
  logger.info(`Send transaction to toggle attester ${attesterAddress} for proxy ${attesterProxyAddress}.`)
  await sendAndWaitTransaction(deployer, rawTransaction)
}

export async function toggleBadgeAttesterFromDeployer(badgeAddress:string, attesterAddress: string) {
  const contract: ethers.Contract = loadContract("ScrollBadgeAccessControl", badgeAddress)
  const deployer = loadDeployerWallet()

  // send transaction to toggleAttester
  let rawTransaction = await contract.toggleAttester.populateTransaction(attesterAddress, true)
  logger.info(`Send transaction to toggle attester ${attesterAddress} for badge ${badgeAddress}.`)
  await sendAndWaitTransaction(deployer, rawTransaction)
}

export async function transferContractOwnerFromDeployer(ownableContractAddress:string, newOwnerAddress: string) {
  const ownableContract: ethers.Contract = loadContract("Ownable", ownableContractAddress)
  const deployer = loadDeployerWallet()

  // send transaction to transfer ownership
  let rawTransaction = await ownableContract.transferOwnership.populateTransaction(newOwnerAddress)
  logger.info(`Send transaction to transfer ownership of ${ownableContractAddress} from deployer ${deployer.address} to ${newOwnerAddress}`)
  await sendAndWaitTransaction(deployer, rawTransaction)
}
