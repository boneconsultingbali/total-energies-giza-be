import {
  IsString,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class CreateProjectStatusDto {
  @IsString()
  @MaxLength(100)
  status: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}