// src/blob/blob.service.ts
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";
import { Injectable, Logger } from "@nestjs/common";
import { type Express } from "express";

@Injectable()
export class AzureBlobStorageService {
  private readonly logger = new Logger(AzureBlobStorageService.name);
  private containerClient;

  constructor() {
    const account = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
    const container = process.env.AZURE_BLOB_CONTAINER_NAME;

    if (!account || !accountKey || !container) {
      throw new Error(
        "Azure Storage account name, key, and container name must be set in environment variables."
      );
    }

    const sharedKeyCredential = new StorageSharedKeyCredential(
      account,
      accountKey
    );
    const blobServiceClient = new BlobServiceClient(
      `https://${account}.blob.core.windows.net`,
      sharedKeyCredential
    );

    this.containerClient = blobServiceClient.getContainerClient(container);
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    const blobName = `${Date.now()}-${file.originalname}`;
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(file.buffer, {
      blobHTTPHeaders: {
        blobContentType: file.mimetype,
      },
    });

    return blockBlobClient.url;
  }

  async uploadFiles(files: Express.Multer.File[]): Promise<string[]> {
    const uploadPromises = files.map(async (file) => {
      const blobName = `${Date.now()}-${file.originalname}`;
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);

      await blockBlobClient.uploadData(file.buffer, {
        blobHTTPHeaders: {
          blobContentType: file.mimetype,
        },
      });

      return blockBlobClient.url;
    });

    return Promise.all(uploadPromises);
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extract blob name from URL
      const url = new URL(fileUrl);
      const blobName = url.pathname.split("/").pop();

      if (blobName) {
        const blockBlobClient =
          this.containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.deleteIfExists();
      }
    } catch (error) {
      this.logger.error("Error deleting file from Azure Blob Storage:", error);
      // Don't throw error to prevent blocking the update operation
    }
  }

  async getFileUrl(blobName: string): Promise<string> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
    return blockBlobClient.url;
  }
}
