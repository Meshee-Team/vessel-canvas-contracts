import * as fs from "fs";
import * as dotenv from "dotenv";
import * as process from "process";
import {ethers, FeeData, JsonRpcProvider, TransactionReceipt, TransactionRequest} from "ethers";
import {logger} from "./logger.js";
import Safe from "@safe-global/protocol-kit";
import SafeApiKit from "@safe-global/api-kit";
import {EthersAdapter} from "@safe-global/protocol-kit";

/**
 * Constants
 */
let configFilePath: string
export let CONFIG = loadConfig()
export let ACCESS_ROLE_DEFAULT_ADMIN = ethers.zeroPadValue(ethers.toBeArray(0), 32)

/**
 * Singletons
 */
let provider: JsonRpcProvider
// @ts-ignore commonJS module
let apiKit: SafeApiKit.default
// @ts-ignore commonJS module
let safeSdk: Safe.default

/**
 * load json config file
 */
interface EssentialConfig {
  DEPLOYER_SK: string
  ADMIN_ADDRESS: string
  ATTESTER_ADDRESS: string
  BADGE_RESOLVER_ADDRESS: string
  EAS_ADDRESS: string
  NODE_RPC_URL: string
  CHAIN_ID: number
  MAX_FEE_PER_GAS: number
  MAX_PRIORITY_FEE_PER_GAS: number
  ENABLE_1559: boolean
  ENABLE_MULTISIG_ADMIN: boolean
  SAFE_TX_SERVICE_URL: string
  ADMIN_SK: string
  ATTESTER_PROXY_ADDRESS: string
  BADGES: BadgeInfo[]
}

interface BadgeInfo {
  ID: string
  NAME: string
  URI: string
  ADDRESS: string
}

interface Config {
  essential: EssentialConfig
}

function loadConfig(): Config {
  dotenv.config()
  const nodeEnv = process.env.NODE_ENV || "local"
  configFilePath = `.config.${nodeEnv}.json`
  const data = fs.readFileSync(configFilePath, "utf8")
  const config = JSON.parse(data) as Config
  if (checkAllKeysDefined(config.essential) !== "") {
    throw new Error(`Missing essential config key(s) ${checkAllKeysDefined(config.essential)} in ${configFilePath}.`)
  }
  return config
}

export function overwriteConfig() {
  const data = JSON.stringify(CONFIG, null, 2)
  fs.writeFileSync(configFilePath, data)
}

/**
 * types and functions to load contract ABI and bytecode
 */
interface Bytecode {
  object: string
  sourceMap: string
}

interface ContractMetadata {
  abi: string
  bytecode: Bytecode
}

export function loadContractMetadata(name: string): ContractMetadata {
  try {
    const data = fs.readFileSync(`../abi/${name}.sol/${name}.json`, "utf8")
    return JSON.parse(data) as ContractMetadata
  } catch (err) {
    logger.error(`Error loading contract ${name} metadata.`)
    throw err
  }
}

export function loadContract(name: string, address: string): ethers.Contract {
  const metadata = loadContractMetadata(name)
  const provider = getOrNewJsonRpcProvider()
  return new ethers.Contract(address, metadata.abi, provider)
}

export function loadContractInterfaceMetadata(folderName: string, fileName: string): ContractMetadata {
  try {
    const data = fs.readFileSync(`../abi/${folderName}.sol/${fileName}.json`, "utf8")
    return JSON.parse(data) as ContractMetadata
  } catch (err) {
    logger.error(`Error loading contract ${fileName} metadata.`)
    throw err
  }
}

export function loadContractInterface(folderName: string, fileName: string, address: string): ethers.Contract {
  const metadata = loadContractInterfaceMetadata(folderName, fileName)
  const provider = getOrNewJsonRpcProvider()
  return new ethers.Contract(address, metadata.abi, provider)
}

// @ts-ignore commonJS module
export async function getOrNewSafe(): Promise<[SafeApiKit, Safe]> {
  if (!apiKit || !safeSdk) {
    // @ts-ignore commonJS module
    apiKit = new SafeApiKit.default({
      chainId: BigInt(CONFIG.essential.CHAIN_ID),
      txServiceUrl: CONFIG.essential.SAFE_TX_SERVICE_URL
    })

    // admin EOA must be one of the multi-sig owner
    const ethAdapter = new EthersAdapter({
      ethers: ethers,
      signerOrProvider: loadAdminWallet()
    })

    // @ts-ignore commonJS module
    safeSdk = await Safe.default.create({
      ethAdapter,
      safeAddress: CONFIG.essential.ADMIN_ADDRESS
    })
  }

  return [apiKit, safeSdk]
}

/**
 * functions to load admin / operator / fake user wallets from secret key and connect to node RPC provider
 */
export function getOrNewJsonRpcProvider(): JsonRpcProvider {
  if (!provider) {
    provider = new JsonRpcProvider(CONFIG.essential.NODE_RPC_URL)
  }
  return provider
}

// Admin wallet is either used as EOA to directly sends transaction to VesselOwner, or as a proposer of a multi-sig txn.
// Depending on config.essential.ENABLE_MULTISIG_ADMIN
export function loadAdminWallet(): ethers.Wallet {
  return new ethers.Wallet(CONFIG.essential.ADMIN_SK).connect(getOrNewJsonRpcProvider())
}

export function loadDeployerWallet(): ethers.Wallet {
  return new ethers.Wallet(CONFIG.essential.DEPLOYER_SK).connect(getOrNewJsonRpcProvider())
}

/**
 * send transaction and wait it to be mined
 * @param signer
 * @param rawTransaction
 */
export async function sendAndWaitTransaction(
  signer: ethers.Signer,
  rawTransaction: TransactionRequest
): Promise<TransactionReceipt> {
  // estimate and set the gas limit
  try {
    const gasEstimate = await signer.estimateGas(rawTransaction)
    logger.debug(`Gas estimation to send transaction: ${gasEstimate}.`)
    rawTransaction.gasLimit = gasEstimate * BigInt(2)
  } catch (e) {
    throw new Error(`Failed to estimate gas for transaction: ${e}`)
  }

  // check and set the gas price
  let feeData:FeeData
  try {
    feeData = await signer.provider!.getFeeData() // provider cannot be null
  } catch (e) {
    throw new Error(`Failed to get fee data: ${e}`)
  }
  if (CONFIG.essential.ENABLE_1559) {
    if (feeData.maxFeePerGas != null && feeData.maxFeePerGas > ethers.parseUnits(CONFIG.essential.MAX_FEE_PER_GAS.toString(), "gwei")) {
      throw new Error(`Current fee exceeds max price accepted: ${feeData.maxFeePerGas} > ${ethers.parseUnits(CONFIG.essential.MAX_FEE_PER_GAS.toString(), "gwei")}`)
    }
    rawTransaction.maxFeePerGas = feeData.maxFeePerGas
    rawTransaction.maxPriorityFeePerGas = ethers.parseUnits(CONFIG.essential.MAX_PRIORITY_FEE_PER_GAS.toString(), "gwei")
  } else {
    if (feeData.gasPrice != null && feeData.gasPrice > ethers.parseUnits(CONFIG.essential.MAX_FEE_PER_GAS.toString(), "gwei")) {
      throw new Error(`Current gas price exceeds max price accepted: ${feeData.gasPrice} > ${ethers.parseUnits(CONFIG.essential.MAX_FEE_PER_GAS.toString(), "gwei")}`)
    }
    rawTransaction.gasPrice = feeData.gasPrice
  }

  // send transaction and wait it to be mined
  let receipt:ethers.TransactionReceipt
  try {
    const txResponse = await signer.sendTransaction(rawTransaction);
    logger.debug(`Transaction response: ${JSON.stringify(txResponse)}`)
    receipt = (await txResponse.wait())!; // receipt cannot be null when no timeout is set
  } catch (e) {
    throw new Error(`Failed to submit transaction: ${e}`)
  }

  // check transaction receipt
  if (receipt.status !== 1) {
    logger.error("transaction reverted. receipt:")
    logger.error(JSON.stringify(receipt));
    throw new Error("Transaction reverted")
  } else {
    logger.info(`Transaction confirmed. Gas used: ${receipt.gasUsed}. Gas price: ${receipt.gasPrice}`)
  }

  return receipt
}

/**
 * Set nonce of deployer
 */
export async function setDeployerNonce(nonce: number) {
  const deployer = loadDeployerWallet()
  const nonceHex = nonce.toString(16)
  const rpcProvider = getOrNewJsonRpcProvider()
  await rpcProvider.send("anvil_setNonce", [deployer.address, nonceHex])

  const newNonce = await provider.getTransactionCount(deployer.address)
  if (newNonce !== nonce) {
    logger.error(`Failed to set nonce to ${nonce}. Actual: ${newNonce}.`)
    throw new Error("Failed to set nonce")
  }
}

// check and return missing key
function checkAllKeysDefined(obj: any): string {
  for (let key of Object.keys(obj)) {
    if (obj[key] === undefined || obj[key] === null) {
      return key;
    }
  }
  return "";
}
