import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { EvaluationService } from './evaluation.service';

@ApiTags('evaluations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('evaluations')
export class EvaluationController {
  constructor(private readonly evaluationService: EvaluationService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Aggregate evaluation metrics for dashboard' })
  summary() {
    return this.evaluationService.getSummary();
  }
}
