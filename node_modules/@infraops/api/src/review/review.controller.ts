import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReviewDecideRequestSchema } from '@infraops/shared';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ReviewService } from './review.service';

interface AuthRequest {
  user: { id: string; role: string };
}

@ApiTags('reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get('pending')
  @ApiOperation({ summary: 'Queue of pending human reviews' })
  pending() {
    return this.reviewService.listPending();
  }

  @Post(':runId/decide')
  @UseGuards(RolesGuard)
  @Roles('safety', 'pm', 'executive', 'admin')
  @ApiOperation({ summary: 'Approve or reject a pending review' })
  @UsePipes(new ZodValidationPipe(ReviewDecideRequestSchema))
  decide(
    @Req() req: AuthRequest,
    @Param('runId') runId: string,
    @Body() body: { decision: 'approved' | 'rejected'; comments?: string },
  ) {
    return this.reviewService.decide(req.user.id, runId, body);
  }
}
