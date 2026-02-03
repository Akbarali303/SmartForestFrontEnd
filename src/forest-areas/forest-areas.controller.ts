import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateForestAreaDto, ForestAreasService } from './forest-areas.service';

@Controller('forest-areas')
export class ForestAreasController {
  constructor(private readonly forestAreasService: ForestAreasService) {}

  @Post()
  async create(@Body() body: { geojson: unknown; regionName?: string; forestName?: string }) {
    const dto: CreateForestAreaDto = {
      geojson: body.geojson as CreateForestAreaDto['geojson'],
      regionName: body.regionName,
      forestName: body.forestName,
    };
    return this.forestAreasService.create(dto);
  }

  @Get()
  async findAll() {
    return this.forestAreasService.findAll();
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: { name?: string; region_name?: string; type?: string; area_ha?: number; responsible?: string; organization?: string; inn?: string }) {
    await this.forestAreasService.update(id, body);
    return { ok: true };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.forestAreasService.remove(id);
    return { ok: true };
  }

  @Delete()
  async removeAll() {
    await this.forestAreasService.removeAll();
    return { ok: true };
  }
}
