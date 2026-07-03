import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RagQueryRequestSchema, type UserRole } from '@infraops/shared';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AgentsService } from './agents.service';

interface AuthRequest {
  user: { id: string; role: UserRole };
}

@ApiTags('agents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post('rag/query')
  @ApiOperation({ summary: 'Ask a grounded question with citations' })
  @UsePipes(new ZodValidationPipe(RagQueryRequestSchema))
  async ragQuery(@Req() req: AuthRequest, @Body() body: { question: string; projectId?: string; discipline?: string; docType?: string }) {
    return this.agentsService.ragQuery(req.user.id, req.user.role, body);
  }

  @Get('runs')
  @ApiOperation({ summary: 'List recent agent runs' })
  listRuns() {
    return this.agentsService.listRuns();
  }

  @Get('runs/:id')
  @ApiOperation({ summary: 'Full trace of an agent run' })
  async getRun(@Param('id') id: string) {
    const run = await this.agentsService.getRun(id);
    if (!run) throw new NotFoundException('Agent run not found');
    return run;
  }
}
