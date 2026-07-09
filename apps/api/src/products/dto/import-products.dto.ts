import { IsString } from "class-validator";
export class ImportProductsDto { @IsString() csv!: string; }