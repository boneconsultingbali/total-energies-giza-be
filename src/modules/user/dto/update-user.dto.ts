import {
  IsEmail,
  IsString,
  IsOptional,
  MinLength,
  IsBoolean,
  ValidateNested,
  IsDateString,
  IsIn,
} from "class-validator";
import { Type } from "class-transformer";
import { PartialType } from "@nestjs/mapped-types";
import { CreateProfileDto, CreateUserDto } from "./create-user.dto";

export class UpdateProfileDto extends PartialType(CreateProfileDto) {}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  @IsIn(["admin", "user"]) // Cannot update to superadmin
  role_name?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateProfileDto)
  profile?: UpdateProfileDto;
}
