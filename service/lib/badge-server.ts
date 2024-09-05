import { Request, Response } from 'express';
import { StatsServerClient } from './stats-server-client';
import { formatAddress, Badge } from './utils';
import { EIP712Proxy } from '@ethereum-attestation-service/eas-sdk/dist/eip712-proxy.js';
import {AddressLike, BigNumberish, BytesLike, ContractTransaction, ethers, JsonRpcProvider, Signer} from 'ethers';
import {logger} from "./logger";
import {
  AttestationRequestData,
  DelegatedAttestationRequest,
  NO_EXPIRATION,
  SchemaEncoder,
  ZERO_BYTES32
} from "@ethereum-attestation-service/eas-sdk";
import {EIP712AttestationProxyParams} from "@ethereum-attestation-service/eas-sdk/dist/offchain/delegated-proxy";
import {
  DelegatedAttestationRequestStruct
} from "@ethereum-attestation-service/eas-contracts/dist/typechain-types/contracts/EAS";

const SCROLL_BADGE_DATA_SCHEMA = 'address badge, bytes payload'

export interface CheckResponse {
  code: number;
  message: string;
  eligibility: boolean;
}

export interface ClaimResponse {
  code: number;
  message: string;
  tx?: ContractTransaction;
}

export class BadgeServer {
  private badgeMap: Map<string, Badge>;
  private statsClient: StatsServerClient;
  private readonly provider: JsonRpcProvider;
  private readonly attesterSigner: Signer;
  private readonly scrollBadgeSchemaUid: string
  private readonly attesterProxyAddress: string

  constructor(
    badgeMap_: Map<string, Badge>,
    statsClient_: StatsServerClient,
    jsonRpcEndpoint_: string,
    attestorPrivateKey_: string,
  ) {
    this.badgeMap = badgeMap_;
    this.statsClient = statsClient_;
    this.provider = new ethers.JsonRpcProvider(jsonRpcEndpoint_);
    this.attesterSigner = new ethers.Wallet(attestorPrivateKey_).connect(this.provider);
    this.scrollBadgeSchemaUid = process.env.SCROLL_BADGE_SCHEMA_UID!
    this.attesterProxyAddress = process.env.ATTESTER_PROXY_ADDRESS!
  }

  async initialize() {
    logger.info(`Initializing badge server`)
    logger.info(`Network: ${JSON.stringify(await this.provider.getNetwork())}`)
    logger.info(`Block: ${await this.provider.getBlockNumber()}`)
    logger.info(`Signer address: ${await this.attesterSigner.getAddress()}`)
  }

  private async checkBadgeEligible(badgeAddress: string, recipientAddress: string): Promise<CheckResponse> {
    badgeAddress = formatAddress(badgeAddress);
    recipientAddress = formatAddress(recipientAddress);

    const badge = this.badgeMap.get(badgeAddress);
    if (!badge) {
      return {
        code: 0,
        message: `badge address ${badgeAddress} not configured in badge server`,
        eligibility: false,
      };
    }

    try {
      const eligible = await this.statsClient.checkEligibility(badge.ID, recipientAddress);
      if (!eligible) {
        return {
          code: 0,
          message: `user address ${recipientAddress} not eligible for badge ${badge.ID}`,
          eligibility: false,
        };
      }

      return {
        code: 1,
        message: 'success',
        eligibility: true,
      };
    } catch (err) {
      const error = err as Error
      return {
        code: 0,
        message: error.message,
        eligibility: false,
      };
    }
  }

  public async checkHandler(req: Request, res: Response) {
    const badgeAddress = req.query.badge as string;
    const recipientAddress = req.query.recipient as string;

    const response = await this.checkBadgeEligible(badgeAddress, recipientAddress);
    res.json(response);
  }

  private async createAttestation(
    proxy: EIP712Proxy,
    badge: Badge,
    recipientAddress: string,
  ): Promise<DelegatedAttestationRequest> {
    const encoder = new SchemaEncoder(SCROLL_BADGE_DATA_SCHEMA)
    const data = encoder.encodeData([
      { name: "badge", value: formatAddress(badge.ADDRESS), type: "address" },
      { name: "payload", value: "0x", type: "bytes" },
    ]);

    const attestationParams: EIP712AttestationProxyParams = {
      // attestation data
      schema: this.scrollBadgeSchemaUid,
      recipient: formatAddress(recipientAddress),
      data: data,

      // unused
      expirationTime: BigInt(0),
      revocable: false,
      refUID: ZERO_BYTES32,
      value: BigInt(0),

      // signature
      deadline: BigInt(Math.floor(new Date().getTime() / 1000) + 3600),
    }

    // sign the attestation
    const delegatedProxy = await proxy.connect(this.attesterSigner).getDelegated()
    const signature = await delegatedProxy.signDelegatedProxyAttestation(attestationParams, this.attesterSigner)

    // return
    return {
      schema: attestationParams.schema,
      data: attestationParams,
      signature: signature.signature,
      attester: await this.attesterSigner.getAddress(),
      deadline: attestationParams.deadline,
    }
  }

  public async claimHandler(req: Request, res: Response) {
    const badgeAddress = req.query.badge as string;
    const recipientAddress = req.query.recipient as string;
    const eligibilityResponse = await this.checkBadgeEligible(badgeAddress, recipientAddress);

    let response: ClaimResponse;
    if (!eligibilityResponse.eligibility) {
      response = {
        code: 0,
        message: eligibilityResponse.message,
      }
    } else {
      try {
        const badge = (this.badgeMap.get(formatAddress(badgeAddress)))!;
        const proxy = new EIP712Proxy(this.attesterProxyAddress)

        const delegatedAttestationRequest = await this.createAttestation(
          proxy,
          badge,
          recipientAddress,
        )

        // @ts-ignore
        const tx = await proxy.contract.attestByDelegation.populateTransaction(delegatedAttestationRequest);
        response = {
          code: 1,
          message: 'success',
          tx: tx,
        }
      } catch (err) {
        response = {
          code: 0,
          message: `failed to generate claim transaction: ${err}`
        }
      }
    }
    res.json(response);
  }
}
