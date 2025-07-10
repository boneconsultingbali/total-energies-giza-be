import { countries } from "@/constants/countries";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ThirdPartyService {
  async fetchCountries(): Promise<any> {
    return countries;
  }
}
