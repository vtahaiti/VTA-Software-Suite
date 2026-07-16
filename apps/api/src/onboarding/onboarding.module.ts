import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { EmailModule } from "../email/email.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { UploadsModule } from "../uploads/uploads.module";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingService } from "./onboarding.service";

@Module({ imports: [PrismaModule, AuthModule, EmailModule, UploadsModule, SubscriptionsModule], controllers: [OnboardingController], providers: [OnboardingService] })
export class OnboardingModule {}
