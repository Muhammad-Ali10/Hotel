import { Module } from "@nestjs/common"

import { AdminModule } from "../admin/admin.module"
import { AdminContractsController, PartnerContractsController } from "./contracts.controller"
import { ContractsRepository } from "./contracts.repository"
import { ContractsService } from "./contracts.service"
import {
  AdminPartnerOrgsController,
  PartnerInviteController,
  PartnerOrgController,
  PartnerTeamController,
} from "./partner.controller"
import { PartnerRepository } from "./partner.repository"
import { PartnerService } from "./partner.service"

@Module({
  // Publishing an agreement, accepting one and ending one are all decisions
  // somebody has to be able to answer for later (rule #77).
  imports: [AdminModule],
  controllers: [
    PartnerOrgController,
    PartnerTeamController,
    PartnerInviteController,
    AdminPartnerOrgsController,
    PartnerContractsController,
    AdminContractsController,
  ],
  providers: [PartnerService, PartnerRepository, ContractsService, ContractsRepository],
  exports: [PartnerService, ContractsService],
})
export class PartnerModule {}
