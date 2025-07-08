import { Module } from "@nestjs/common";
import { DocumentController } from "./document.controller";
import { DocumentService } from "./document.service";
import { AzureBlobStorageModule } from "@/storage/azure-blob-storage/azure-blob-storage.module";

@Module({
  imports: [AzureBlobStorageModule],
  controllers: [DocumentController],
  providers: [DocumentService],
  exports: [DocumentService],
})
export class DocumentModule {}
