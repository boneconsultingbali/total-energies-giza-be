import { Module } from "@nestjs/common";
import { ProjectController } from "./project.controller";
import { ProjectService } from "./project.service";
import { EmailModule } from "@/email/email.module";
import { AzureBlobStorageModule } from "@/storage/azure-blob-storage/azure-blob-storage.module";

@Module({
  imports: [EmailModule, AzureBlobStorageModule],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}
