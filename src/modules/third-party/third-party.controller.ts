import { Controller, Get, UseGuards } from "@nestjs/common";
import { ThirdPartyService } from "./third-party.service";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";

@Controller("third-party")
@UseGuards(JwtAuthGuard)
export class ThirdPartyController {
  constructor(private readonly thirdPartyService: ThirdPartyService) {}

  @Get("countries")
  fetchCountries() {
    return this.thirdPartyService.fetchCountries();
  }
}
