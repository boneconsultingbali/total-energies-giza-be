import { IsArray, IsString } from "class-validator";

export class AssignPermissionDto {
  @IsArray()
  @IsString({ each: true })
  permission_ids: string[];
}
