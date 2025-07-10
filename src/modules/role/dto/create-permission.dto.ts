import { IsString, MaxLength } from "class-validator";

export class CreatePermissionDto {
  @IsString()
  @MaxLength(50)
  name: string;

  @IsString()
  @MaxLength(255)
  description?: string;
}
