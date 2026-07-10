import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { UploadsModule } from "../uploads/uploads.module";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingService } from "./onboarding.service";

@Module({ imports: [PrismaModule, AuthModule, UploadsModule], controllers: [OnboardingController], providers: [OnboardingService] })
export class OnboardingModule {}