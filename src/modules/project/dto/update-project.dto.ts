import {
  IsString,
  IsOptional,
  IsDateString,
  IsArray,
  IsNumber,
  MaxLength,
  Min,
  Max,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
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
  @Min(0)
  @Max(100)
  score?: number;
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
