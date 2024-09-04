import {ethers } from 'ethers';
import dotenv from "dotenv";
import axios from "axios";
import {CheckResponse, ClaimResponse} from "../lib/badge-server";

async function main() {
  dotenv.config()
  const provider = new ethers.JsonRpcProvider(process.env.JSON_RPC_ENDPOINT);
  const claimerSk = process.env.CLAIMER_SK!
  const claimerWallet = new ethers.Wallet(claimerSk, provider);
  const badgeAddress = process.env.BADGE_ADDRESS!
  const badgeServerBaseUrl = process.env.BADGE_SERVER_BASE_URL!

  console.log(`Chain ID: ${(await provider.getNetwork()).chainId}`)
  console.log(`block number: ${await provider.getBlockNumber()}`)
  console.log(`claimer address: ${claimerWallet.address}`)
  console.log(`badge address: ${badgeAddress}`)
  console.log(`badge server base url: ${badgeServerBaseUrl}`)

  // check api
  const checkUrl = `${badgeServerBaseUrl}/check?badge=${badgeAddress}&recipient=${claimerWallet.address}`;
  try {
    const response = await axios.get<CheckResponse>(checkUrl);
    if (response.data.code != 1) {
      console.log(`Eligibility check returns false: ${JSON.stringify(response.data)}`);
    } else {
      console.log(`Eligibility check returns true: ${JSON.stringify(response.data)}`)
    }
  } catch (err) {
    console.error(`Failed to check eligibility: ${err}`);
  }

  // claim api
  const claimUrl = `${badgeServerBaseUrl}/claim?badge=${badgeAddress}&recipient=${claimerWallet.address}`
  try {
    const response = await axios.get<ClaimResponse>(claimUrl);
    if (response.data.code != 1) {
      console.log(`Failed to get transaction from claim API: ${JSON.stringify(response.data)}`)
    } else {
      console.log(`Get transaction from claim API: ${JSON.stringify(response.data)}`)
      const apiTx = response.data.tx!

      // simulate the transaction
      const simulateTx = {
        from: claimerWallet.address,
        to: apiTx.to,
        data: apiTx.data,
      }
      try {
        const result = await provider.call(simulateTx);
        console.log('Simulate claim badge tx succeeded:', result);
      } catch (error) {
        console.log('Simulate claim badge tx failed:', error);
      }

      // send transaction
      const realTx = {
        to: apiTx.to,
        data: apiTx.data,
      }
      let receipt:ethers.TransactionReceipt
      try {
        const txResponse = await claimerWallet.sendTransaction(realTx);
        console.log(`Transaction response: ${JSON.stringify(txResponse)}`)
        receipt = (await txResponse.wait())!; // receipt cannot be null when no timeout is set
        if (receipt.status !== 1) {
          console.error("transaction reverted. receipt:")
          console.error(JSON.stringify(receipt));
        } else {
          console.info(`Transaction confirmed. Gas used: ${receipt.gasUsed}. Gas price: ${receipt.gasPrice}`)
        }
      } catch (e) {
        console.error(`Failed to submit transaction: ${e}`)
      }
    }
  } catch (err) {
    console.error(`Failed to call claim API: ${err}`)
  }
}

main();
