import {
  IsEmail,
  IsString,
  IsOptional,
  IsBoolean,
  ValidateNested,
  IsDateString,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateProfileDto {
  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsDateString()
  birth_date?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  postal_code?: string;
}

export class CreateUserDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  branch_or_acronym?: string;

  @IsOptional()
  @IsString()
  tenant_id?: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  role_name?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateProfileDto)
  profile?: CreateProfileDto;
}
