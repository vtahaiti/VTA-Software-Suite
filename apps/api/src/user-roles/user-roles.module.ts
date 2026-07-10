import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { UserRolesController } from "./user-roles.controller";
import { UserRolesService } from "./user-roles.service";
@Module({ imports: [PrismaModule], controllers: [UserRolesController], providers: [UserRolesService] })
export class UserRolesModule {}