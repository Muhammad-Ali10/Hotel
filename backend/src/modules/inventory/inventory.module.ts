import { Module } from "@nestjs/common"

import { AvailabilityController, PartnerInventoryController } from "./inventory.controller"
import { InventoryRepository } from "./inventory.repository"
import { InventoryService } from "./inventory.service"

@Module({
  controllers: [AvailabilityController, PartnerInventoryController],
  providers: [InventoryService, InventoryRepository],
  exports: [InventoryService, InventoryRepository],
})
export class InventoryModule {}
