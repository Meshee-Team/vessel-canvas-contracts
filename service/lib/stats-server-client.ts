import axios from 'axios';
import {logger} from "./logger";

interface EligibilityResponse {
  error: boolean;
  msg: string;
  badgeEligibility: boolean;
  firstGenerateTime: number;
  metricsValue: string;
}

export class StatsServerClient {
  private readonly baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  public async checkEligibility(badgeID: string, address: string): Promise<boolean> {
    const url = `${this.baseURL}/api/v1/stats/campaign/eligibility/badge?badgeId=${badgeID}&address=${address}`;
    logger.debug(`Check badge eligibility: badge: ${badgeID}, address: ${address}, url: ${url}`)

    try {
      const response = await axios.get<EligibilityResponse>(url);
      if (response.data.error) {
        logger.error(`Eligibility response having error response: ${JSON.stringify(response.data)}`)
        throw new Error(response.data.msg);
      }
      return response.data.badgeEligibility;
    } catch (err) {
      throw new Error(`Failed to check eligibility: ${err}`);
    }
  }
}
