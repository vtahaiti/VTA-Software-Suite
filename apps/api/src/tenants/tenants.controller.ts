import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PlatformAdminGuard } from "../platform/guards/platform-admin.guard";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { UpdateTenantDto } from "./dto/update-tenant.dto";
import { TenantsService } from "./tenants.service";

// Ce module ne cree pas les tenants (l'onboarding reel utilise onboarding.service.ts) et ne gere
// pas les tenants au quotidien (platform.controller.ts fait deja tout ca, correctement protege
// par PlatformAdminGuard). Ce controleur n'avait AUCUNE verification de role/tenant : n'importe
// quel utilisateur authentifie, de n'importe quel tenant, pouvait lister/lire/modifier/supprimer
// n'importe quel autre tenant. On applique le meme garde que platform.controller.ts plutot que de
// supprimer le fichier, au cas ou un usage interne existerait encore.
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller("tenants")
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  findAll() {
    return this.tenantsService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.tenantsService.findOne(id);
  }

  @Post()
  create(@Body() createTenantDto: CreateTenantDto) {
    return this.tenantsService.create(createTenantDto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() updateTenantDto: UpdateTenantDto) {
    return this.tenantsService.update(id, updateTenantDto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.tenantsService.remove(id);
  }
}