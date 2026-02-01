import { IsString, IsOptional, IsObject, IsArray, MinLength, MaxLength } from 'class-validator';

export class CreateLandParcelDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  region: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  lease_holder?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contract_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  contract_start?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  contract_expiry?: string;

  @IsObject()
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
}
