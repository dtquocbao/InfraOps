import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List all projects' })
  list() {
    return this.projectsService.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project detail with linked documents and IoT devices' })
  getById(@Param('id') id: string) {
    return this.projectsService.getById(id);
  }
}
