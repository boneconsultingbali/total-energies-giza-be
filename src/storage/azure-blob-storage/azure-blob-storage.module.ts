import { Global, Module } from "@nestjs/common";
import { AzureBlobStorageService } from "./azure-blob-storage.service";

@Global()
@Module({
  providers: [AzureBlobStorageService],
  exports: [AzureBlobStorageService],
})
export class AzureBlobStorageModule {}
