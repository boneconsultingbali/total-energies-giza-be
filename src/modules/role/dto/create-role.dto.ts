import { IsArray, IsString, MaxLength } from "class-validator";

export class CreateRoleDto {
  @IsString()
  @MaxLength(50)
  name: string;

  @IsArray()
  @IsString({ each: true })
  permission_ids?: string[];
}
