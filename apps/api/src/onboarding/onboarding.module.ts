import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { EmailModule } from "../email/email.module";
import { SecurityModule } from "../security/security.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { UploadsModule } from "../uploads/uploads.module";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingService } from "./onboarding.service";

@Module({ imports: [SecurityModule, PrismaModule, AuthModule, EmailModule, UploadsModule, SubscriptionsModule], controllers: [OnboardingController], providers: [OnboardingService] })
export class OnboardingModule {}
