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
} from '@nestjs/common';
import { DocumentService } from './document.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post()
  create(@Body() createDocumentDto: CreateDocumentDto, @Request() req) {
    this.checkPermission(req.user, 'document:create');
    return this.documentService.create(createDocumentDto, req.user.id, req.user.role?.name);
  }

  @Get()
  findAll(@Query() query: PaginationDto & { tenant_id?: string; project_id?: string; q?: string }, @Request() req) {
    this.checkPermission(req.user, 'document:read');
    return this.documentService.findAll(query, req.user.id, req.user.role?.name);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    this.checkPermission(req.user, 'document:read');
    return this.documentService.findOne(id, req.user.id, req.user.role?.name);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDocumentDto: UpdateDocumentDto, @Request() req) {
    this.checkPermission(req.user, 'document:update');
    return this.documentService.update(id, updateDocumentDto, req.user.id, req.user.role?.name);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    this.checkPermission(req.user, 'document:delete');
    return this.documentService.remove(id, req.user.id, req.user.role?.name);
  }

  private checkPermission(user: any, permission: string) {
    if (!user.permissions.includes(permission)) {
      throw new ForbiddenException(`Insufficient permissions: ${permission} required`);
    }
  }
}