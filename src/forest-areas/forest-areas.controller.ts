import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { ForestAreasService } from './forest-areas.service';
import { CreateForestAreaDto } from './create-forest-area.dto';

@Controller('forest-areas')
export class ForestAreasController {
  constructor(private readonly forestAreasService: ForestAreasService) {}

  @Get()
  async findAll() {
    return this.forestAreasService.findAll();
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async create(@Body() dto: CreateForestAreaDto) {
    return this.forestAreasService.create({
      name: dto.name,
      geometry: dto.geometry,
    });
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.forestAreasService.remove(id);
  }
}
