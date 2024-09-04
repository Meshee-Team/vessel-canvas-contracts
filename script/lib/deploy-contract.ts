import { ethers } from "ethers";
import {
  loadContractMetadata,
  loadDeployerWallet,
  sendAndWaitTransaction
} from "./utils.js";
import { logger } from "./logger.js";

async function deployBytecode(deployerWallet: ethers.Wallet , bytecodeHex: string, encodeArgsHex: string): Promise<string> {
  // Define the deployment transaction
  const rawTransaction: ethers.TransactionRequest = {
    data: bytecodeHex + encodeArgsHex.substring(2)
  };

  // Send the deployment transaction and wait
  const txReceipt = await sendAndWaitTransaction(deployerWallet, rawTransaction)
  if (txReceipt.contractAddress == null) {
    throw new Error(`Deployment transaction returns null address ${txReceipt}`)
  } else {
    return txReceipt.contractAddress
  }
}

export async function deployBadgeContract(contractName: string, badgeResolverAddress: string, badgeUri: string): Promise<string> {
  const badgeContract = loadContractMetadata(contractName)
  const deployer = loadDeployerWallet()
  const encodeArgs = ethers.AbiCoder.defaultAbiCoder().encode(["address", "string"], [badgeResolverAddress, badgeUri])

  logger.info(`Deployer ${deployer.address} sends transaction to deploy ${contractName}.`)
  return deployBytecode(deployer, badgeContract.bytecode.object, encodeArgs)
}

export async function deployAttesterProxyContract(easAddress: string): Promise<string> {
  const attesterProxyContract = loadContractMetadata("AttesterProxy")
  const deployer = loadDeployerWallet()
  const encodeArgs = ethers.AbiCoder.defaultAbiCoder().encode(["address"], [easAddress])

  logger.info(`Deployer ${deployer.address} sends transaction to deploy AttesterProxy.`)
  return deployBytecode(deployer, attesterProxyContract.bytecode.object, encodeArgs)
}
