import {
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'List all documents' })
  list() {
    return this.documentsService.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document detail and processing status' })
  getById(@Param('id') id: string) {
    return this.documentsService.getById(id);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload document for processing' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      title: string;
      docType: string;
      projectId?: string;
      department: string;
      securityLevel: string;
      revision?: string;
      approvalStatus?: string;
    },
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.documentsService.createFromUpload(file, body);
  }
}
