import { IsOptional, IsString, IsObject, MaxLength } from 'class-validator';

export class CreateForestAreaDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsObject()
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
}
