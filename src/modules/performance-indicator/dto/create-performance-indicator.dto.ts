import {
  IsString,
  IsOptional,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePerformanceIndicatorDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsUUID()
  parent_id?: string;
}