import { PartialType } from "@nestjs/mapped-types";
import { CreatePerformanceIndicatorDto } from "./create-performance-indicator.dto";

export class UpdatePerformanceIndicatorDto extends PartialType(
  CreatePerformanceIndicatorDto
) {}
