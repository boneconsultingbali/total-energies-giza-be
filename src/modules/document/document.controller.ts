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
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { Express } from "express";
import { DocumentService } from "./document.service";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { UpdateDocumentDto } from "./dto/update-document.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { AzureBlobStorageService } from "@/storage/azure-blob-storage/azure-blob-storage.service";
import { FileInterceptor } from "@nestjs/platform-express";

@Controller("documents")
@UseGuards(JwtAuthGuard)
export class DocumentController {
  constructor(
    private readonly documentService: DocumentService,
    private readonly azureBlobStorageService: AzureBlobStorageService
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor("file"))
  async create(
    @Body() createDocumentDto: CreateDocumentDto,
    @Request() req,
    @UploadedFile() file: Express.Multer.File
  ) {
    this.checkPermission(req.user, "document:create");

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
  findAll(
    @Query()
    query: PaginationDto & {
      tenant_id?: string;
      project_id?: string;
      q?: string;
    },
    @Request() req
  ) {
    this.checkPermission(req.user, "document:read");
    return this.documentService.findAll(
      query,
      req.user.id,
      req.user.role?.name
    );
  }

  @Get(":id")
  findOne(@Param("id") id: string, @Request() req) {
    this.checkPermission(req.user, "document:read");
    return this.documentService.findOne(id, req.user.id, req.user.role?.name);
  }

  @Patch(":id")
  @UseInterceptors(FileInterceptor("file"))
  async update(
    @Param("id") id: string,
    @Body() updateDocumentDto: UpdateDocumentDto,
    @Request() req,
    @UploadedFile() file?: Express.Multer.File
  ) {
    this.checkPermission(req.user, "document:update");

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
  remove(@Param("id") id: string, @Request() req) {
    this.checkPermission(req.user, "document:delete");
    return this.documentService.remove(id, req.user.id, req.user.role?.name);
  }

  private checkPermission(user: any, permission: string) {
    if (!user.permissions.includes(permission)) {
      throw new ForbiddenException(
        `Insufficient permissions: ${permission} required`
      );
    }
  }
}
