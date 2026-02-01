import { Body, Controller, Get, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { LandParcelsService } from './land-parcels.service';
import { CreateLandParcelDto } from './create-land-parcel.dto';

@Controller('land-parcels')
export class LandParcelsController {
  constructor(private readonly landParcelsService: LandParcelsService) {}

  @Get()
  async findAll() {
    return this.landParcelsService.findAll();
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async create(@Body() dto: CreateLandParcelDto) {
    return this.landParcelsService.create({
      name: dto.name,
      region: dto.region,
      lease_holder: dto.lease_holder,
      contract_number: dto.contract_number,
      contract_start: dto.contract_start,
      contract_expiry: dto.contract_expiry,
      geometry: dto.geometry,
    });
  }
}
