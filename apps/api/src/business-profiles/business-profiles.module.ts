import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { BusinessProfilesController } from "./business-profiles.controller";
import { BusinessProfilesService } from "./business-profiles.service";

@Module({
  imports: [PrismaModule],
  controllers: [BusinessProfilesController],
  providers: [BusinessProfilesService],
  exports: [BusinessProfilesService]
})
export class BusinessProfilesModule {}