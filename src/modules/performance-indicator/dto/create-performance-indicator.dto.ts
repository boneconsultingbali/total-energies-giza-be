import { IsString, IsOptional, MaxLength, IsNumber } from "class-validator";

export class CreatePerformanceIndicatorDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  parent_id?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  min_score?: number;

  @IsOptional()
  @IsNumber()
  max_score?: number;
}
