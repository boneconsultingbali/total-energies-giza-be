import {
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
  IsArray,
  IsNumber,
  MaxLength,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateProjectIndicatorDto {
  @IsUUID()
  indicator_id: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number;

  @IsOptional()
  @IsUUID()
  tenant_id?: string;

  @IsOptional()
  @IsUUID()
  owner_id?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateProjectIndicatorDto)
  indicators?: UpdateProjectIndicatorDto[];
}