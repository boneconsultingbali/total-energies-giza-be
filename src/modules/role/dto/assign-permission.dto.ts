import { IsArray, IsString, ValidateNested } from "class-validator";

export class AssignPermissionDto {
  @IsArray()
  @IsString({ each: true })
  permission_ids: string[];
}
