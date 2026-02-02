import { IsOptional, IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Bbox format: minLon,minLat,maxLon,maxLat (WGS84)
 * Example: -122.5,37.5,-122.0,38.0
 */
const BBOX_PATTERN = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;

export class EventQueryDto {
  @IsOptional()
  @IsString()
  @Matches(BBOX_PATTERN, {
    message: 'bbox must be minLon,minLat,maxLon,maxLat (e.g. -122.5,37.5,-122.0,38.0)',
  })
  @Transform(({ value }) => value?.trim())
  bbox?: string;
}
