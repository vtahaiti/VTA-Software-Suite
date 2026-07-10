import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { RegisterUserDto } from "./dto/register-user.dto";
import { OnboardingService } from "./onboarding.service";

@Controller("onboarding")
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Post("register")
  register(@Body() dto: RegisterUserDto) {
    return this.onboarding.register(dto);
  }

  @Post("company")
  createCompany(@Body() dto: CreateCompanyDto) {
    return this.onboarding.createCompany(dto);
  }

  @Get("status")
  status(@Req() request: AuthenticatedRequest) {
    return this.onboarding.status(request.user?.id);
  }
}