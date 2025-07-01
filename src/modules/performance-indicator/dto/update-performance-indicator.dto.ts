import {
  IsString,
  IsOptional,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdatePerformanceIndicatorDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsUUID()
  parent_id?: string;
}