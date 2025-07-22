import {
  IsString,
  IsOptional,
  IsNumber,
  MaxLength,
  Max,
} from "class-validator";
import { PartialType } from "@nestjs/mapped-types";
import {
  CreateProjectDto,
  CreateProjectIndicatorDto,
} from "./create-project.dto";

export class UpdateProjectIndicatorDto extends PartialType(
  CreateProjectIndicatorDto
) {
  @IsString()
  indicator_id: string;

  @IsOptional()
  @IsNumber()
  @Max(100)
  score?: number;

  @IsOptional()
  @IsString()
  expected_trend?: string;

  @IsOptional()
  @IsNumber()
  @Max(100)
  expected_score?: number;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;
}
