"use client"

import { amenityGroups } from "@/data/extranet"
import { ToggleGroupsManager } from "@/components/extranet/shared"

export function AmenitiesManager() {
  return <ToggleGroupsManager groups={amenityGroups} noun="amenities" />
}
