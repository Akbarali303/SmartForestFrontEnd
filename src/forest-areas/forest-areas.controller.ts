import { Body, Controller, Get, Post } from '@nestjs/common';
import { ForestAreasService } from './forest-areas.service';

@Controller('forest-areas')
export class ForestAreasController {
  constructor(private readonly forestAreasService: ForestAreasService) {}

  @Post()
  async create(@Body() body: { geojson: unknown; regionName?: string }) {
    return this.forestAreasService.create({
      geojson: body.geojson as { type: string; features?: unknown[] },
      regionName: body.regionName,
    });
  }

  @Get()
  async findAll() {
    return this.forestAreasService.findAll();
  }
}
