import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { FeatureTestsService } from './feature-tests.service';

interface AuthRequest {
  user: { id: string; role: string; email: string };
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'executive')
@Controller('admin/feature-tests')
export class FeatureTestsController {
  constructor(private readonly featureTests: FeatureTestsService) {}

  @Get('cases')
  @ApiOperation({ summary: 'List registered feature test cases' })
  listCases() {
    return this.featureTests.listCases();
  }

  @Get('runs')
  @ApiOperation({ summary: 'List recent feature test runs' })
  listRuns() {
    return this.featureTests.listRuns();
  }

  @Get('runs/latest')
  @ApiOperation({ summary: 'Latest feature test run with results' })
  latestRun() {
    return this.featureTests.getLatestRun();
  }

  @Get('runs/:id')
  @ApiOperation({ summary: 'Feature test run detail' })
  getRun(@Param('id') id: string) {
    return this.featureTests.getRun(id);
  }

  @Post('run')
  @Roles('admin')
  @ApiOperation({ summary: 'Trigger full feature test suite (admin only)' })
  triggerRun(@Req() req: AuthRequest) {
    return this.featureTests.triggerRun(req.user.id);
  }
}
