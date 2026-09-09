import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common"
import { z } from "zod"

import { AdminResource, CurrentUser, Roles } from "../../common/auth/decorators"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
import type { AuthenticatedUser } from "../auth/auth.service"
import { NotificationsService } from "./notifications.service"

const listSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(30),
    unreadOnly: z.coerce.boolean().default(false),
  })
  .strict()

type ListInput = z.infer<typeof listSchema>

/**
 * What a person may change about what they receive (rule #56).
 *
 * There is no switch for `essential` here, and that is the contract: a booking
 * confirmation is a record of something that happened to somebody's money, and
 * offering a toggle would promise a choice the system will not honour.
 */
/*
 * There is no SMS switch, deliberately.
 *
 * `sms_useful` was stored, returned and settable — and `maySend` never read
 * it, because SMS is not a `NotificationChannel` at all. The guest's settings
 * screen offered "Text alerts for your bookings", which is a promise nothing
 * in the product can keep (rule #106). The column stays for the day an adapter
 * exists; until then nothing offers the choice.
 */
const settingsSchema = z
  .object({
    emailUseful: z.boolean(),
    emailMarketing: z.boolean(),
  })
  .partial()
  .strict()

type SettingsInput = z.infer<typeof settingsSchema>

/**
 * A batch of switches (rule #105).
 *
 * A batch rather than one call per switch: a person toggling four rows on a
 * preferences screen should produce one save, not four races against each
 * other. An essential template here is REFUSED, not ignored — silently
 * accepting a switch that will never be honoured is how somebody ends up
 * believing they turned something off.
 */
const preferencesSchema = z
  .object({
    preferences: z
      .array(
        z
          .object({
            template: z.string().trim().min(1).max(64),
            channel: z.enum(["email", "sms", "in_app"]),
            enabled: z.boolean(),
          })
          .strict()
      )
      .min(1)
      .max(100),
  })
  .strict()

type PreferencesInput = z.infer<typeof preferencesSchema>

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(listSchema)) query: ListInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.notifications.listFor(user, query)
  }

  /**
   * Preferences.
   *
   * Declared before `:id` — Nest matches in order, and "settings" would
   * otherwise be read as a notification id.
   */
  @Get("settings")
  settings(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.settingsFor(user.id)
  }

  /**
   * Every message this person may switch, with its current state (rule #105).
   *
   * Built from the catalogue, so a template added last week shows up with its
   * default rather than being invisible until somebody touches it.
   */
  @Get("preferences")
  preferences(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.preferencesFor(user)
  }

  @Patch("preferences")
  savePreferences(
    @Body(new ZodValidationPipe(preferencesSchema)) body: PreferencesInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.notifications.savePreferences({ user, rows: body.preferences })
  }

  @Patch("settings")
  saveSettings(
    @Body(new ZodValidationPipe(settingsSchema)) body: SettingsInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.notifications.saveSettings({ user, patch: body })
  }

  @Post("read-all")
  readAll(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user)
  }

  @Patch(":id/read")
  read(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markRead({ id, user })
  }
}

/**
 * Whether mail is actually leaving the building.
 *
 * Admin-only: it names the configured driver and the sending address, which is
 * deployment detail rather than anything a guest has business seeing.
 *
 * There is no matching partner or guest route on purpose. "Did my email go" is
 * a question for whoever runs the platform; a partner who did not receive
 * something opens a support ticket, and the answer to that is in this screen.
 */
@Controller("admin/notifications")
@AdminResource("settings")
@Roles("admin")
export class AdminNotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get("health")
  health() {
    return this.notifications.deliveryHealth()
  }
}
