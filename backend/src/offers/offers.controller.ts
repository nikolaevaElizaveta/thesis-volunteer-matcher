import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { RolesGuard } from '../auth/roles.guard';
import { CreateOfferDto } from './dto/create-offer.dto';
import { OfferDto } from './dto/offer.dto';
import { OffersService } from './offers.service';

const OFFER_EXAMPLE = {
  location: { lat: 59.91, lon: 30.31 },
  skills: ['medical', 'logistics'],
  availability: [
    { start: '2026-02-10T14:00:00', end: '2026-02-10T18:00:00' },
  ],
  max_distance_km: 10,
  description: 'Volunteer medic',
};

@ApiTags('offers')
@ApiBearerAuth()
@Controller('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('coordinator', 'volunteer')
  @ApiOperation({ summary: 'Create a volunteer offer' })
  @ApiBody({
    type: CreateOfferDto,
    examples: { default: { summary: 'Ready to run (id auto-generated)', value: OFFER_EXAMPLE } },
  })
  async create(
    @Body() dto: CreateOfferDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<OfferDto> {
    if (user.role === 'volunteer') {
      dto.description = user.displayName;
    }
    return this.offersService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all offers' })
  async findAll(): Promise<OfferDto[]> {
    return this.offersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get offer by id' })
  async findOne(@Param('id') id: string): Promise<OfferDto> {
    return this.offersService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete offer (coordinator or owning volunteer)' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    if (user.role === 'coordinator') {
      return this.offersService.delete(id);
    }
    if (user.role === 'volunteer') {
      const o = await this.offersService.findOne(id);
      const desc = (o.description ?? '').trim().toLowerCase();
      const mine = user.displayName.trim().toLowerCase();
      if (desc !== mine) {
        throw new ForbiddenException('Not your offer');
      }
      return this.offersService.delete(id);
    }
    throw new ForbiddenException();
  }
}
