import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { Express } from "express";
import { DocumentService } from "./document.service";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { UpdateDocumentDto } from "./dto/update-document.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { AzureBlobStorageService } from "@/storage/azure-blob-storage/azure-blob-storage.service";
import { FileInterceptor } from "@nestjs/platform-express";

@Controller("documents")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DocumentController {
  constructor(
    private readonly documentService: DocumentService,
    private readonly azureBlobStorageService: AzureBlobStorageService
  ) {}

  @Post()
  @RequirePermission("document:create")
  @UseInterceptors(FileInterceptor("file"))
  async create(
    @Body() createDocumentDto: CreateDocumentDto,
    @Request() req,
    @UploadedFile() file: Express.Multer.File
  ) {
    const fileRes = await this.azureBlobStorageService.uploadFile(file);

    return this.documentService.create(
      {
        ...createDocumentDto,
        tenant_id: req.user?.tenant_id,
        content: fileRes,
      },
      req.user.id,
      req.user.role?.name
    );
  }

  @Get()
  @RequirePermission("document:read")
  findAll(
    @Query()
    query: PaginationDto & {
      tenant_id?: string;
      project_id?: string;
      q?: string;
    },
    @Request() req
  ) {
    return this.documentService.findAll(
      query,
      req.user.id,
      req.user.role?.name
    );
  }

  @Get(":id")
  @RequirePermission("document:read")
  findOne(@Param("id") id: string, @Request() req) {
    return this.documentService.findOne(id, req.user.id, req.user.role?.name);
  }

  @Patch(":id")
  @RequirePermission("document:update")
  @UseInterceptors(FileInterceptor("file"))
  async update(
    @Param("id") id: string,
    @Body() updateDocumentDto: UpdateDocumentDto,
    @Request() req,
    @UploadedFile() file?: Express.Multer.File
  ) {
    let fileRes;
    if (file) {
      fileRes = await this.azureBlobStorageService.uploadFile(file);
    }

    return this.documentService.update(
      id,
      {
        ...updateDocumentDto,
        ...(fileRes && { content: fileRes }),
      },
      req.user.id,
      req.user.role?.name
    );
  }

  @Delete(":id")
  @RequirePermission("document:delete")
  remove(@Param("id") id: string, @Request() req) {
    return this.documentService.remove(id, req.user.id, req.user.role?.name);
  }
}
