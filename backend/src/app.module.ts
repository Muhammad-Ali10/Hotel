import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common"
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core"
import { ScheduleModule } from "@nestjs/schedule"
import { ThrottlerModule } from "@nestjs/throttler"

import { env } from "./config/env"
import { AccessLogInterceptor } from "./common/interceptors/access-log.interceptor"
import { RequestContextMiddleware } from "./common/middleware/request-context.middleware"
import { ThrottlerBehindProxyGuard } from "./common/throttling/throttler-behind-proxy.guard"
import { THROTTLERS } from "./common/throttling/throttling"
import { PostgresThrottlerStorage } from "./common/throttling/postgres-throttler.storage"
import { ThrottlingModule } from "./common/throttling/throttling.module"
import { AuthModule } from "./modules/auth/auth.module"
import { CatalogModule } from "./modules/catalog/catalog.module"
import { InventoryModule } from "./modules/inventory/inventory.module"
import { BookingsModule } from "./modules/bookings/bookings.module"
import { PricingModule } from "./modules/pricing/pricing.module"
import { FinanceModule } from "./modules/finance/finance.module"
import { IsoTimestampsInterceptor } from "./common/interceptors/iso-timestamps.interceptor"
import { AdminModule } from "./modules/admin/admin.module"
import { RegistrationModule } from "./modules/registration/registration.module"
import { SupportModule } from "./modules/support/support.module"
import { AnalyticsModule } from "./modules/analytics/analytics.module"
import { StorageModule } from "./modules/storage/storage.module"
import { NotificationsModule } from "./modules/notifications/notifications.module"
import { PartnerModule } from "./modules/partner/partner.module"
import { PaymentsModule } from "./modules/payments/payments.module"
import { ReviewsModule } from "./modules/reviews/reviews.module"
import { DrizzleModule } from "./db/drizzle.module"
import { HealthModule } from "./modules/health/health.module"

/**
 * Feature modules land here as the modules in docs/ARCHITECTURE.md §10 are
 * built:
 *
 *   1  AuthModule        users · sessions · roles · guards · tier
 *   2  CatalogModule     properties · rooms · rate plans · photos
 *   3  InventoryModule   room inventory · rate calendar · restrictions
 *   4  PricingModule     quote engine · quote token · promotions
 *   5  BookingsModule    transactional create · modify · cancel
 *   6  ReviewsModule     write · publish · partner reply · moderation
 *   7  PaymentsModule    provider port · intents · webhooks · refunds
 *   8  FinanceModule     fortnightly payout run · commission · statements
 *   9  NotificationsModule  in-app · email outbox · SendGrid port
 *  10  PartnerModule     org profile · team invites · role & property scoping
 *  10  AnalyticsModule   stay-date ledger · partner reporting · search events
 *   …
 */
@Module({
  imports: [
    /*
     * The scheduler is OFF under test.
     *
     * Every job is exercised by calling its service directly, which is both
     * more precise and repeatable. Left running, the minute-by-minute jobs
     * fire in the middle of a long suite and change the data a test is in the
     * middle of asserting on — the hold sweeper cancelling a booking a test
     * just created, the outbox worker delivering a message a test was about to
     * inspect. Those show up as failures in unrelated specs.
     */
    ...(env.NODE_ENV === "test" ? [] : [ScheduleModule.forRoot()]),
    /*
     * The storage is handed to `ThrottlerModule` EXPLICITLY.
     *
     * Providing `ThrottlerStorage` from a global module is not enough:
     * `forRoot` registers its own in-memory storage provider, which wins, and
     * the limiter goes on counting per process while looking configured. The
     * only way to know is that no rows appear in `rate_limits` — which is what
     * the test asserts.
     */
    ThrottlingModule,
    ThrottlerModule.forRootAsync({
      imports: [ThrottlingModule],
      inject: [PostgresThrottlerStorage],
      useFactory: (storage: PostgresThrottlerStorage) => ({ ...THROTTLERS, storage }),
    }),
    DrizzleModule, AuthModule, CatalogModule, InventoryModule, PricingModule, BookingsModule, ReviewsModule, PaymentsModule, FinanceModule, NotificationsModule, PartnerModule, AnalyticsModule, StorageModule, AdminModule, SupportModule, RegistrationModule, HealthModule],
  providers: [
    // Rate limiting is global and opt-DOWN, not opt-in: a new endpoint is
    // protected the moment it exists, rather than the day someone remembers.
    { provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard },
    { provide: APP_INTERCEPTOR, useClass: AccessLogInterceptor },
    /*
     * Every timestamp leaves this API as ISO 8601.
     *
     * Registered HERE rather than with `app.useGlobalInterceptors` in
     * `main.ts`, because the e2e suite builds its app from this module and
     * never runs the bootstrap — a guarantee registered in `main.ts` would
     * hold in production and be completely untested.
     */
    { provide: APP_INTERCEPTOR, useClass: IsoTimestampsInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Wildcard so the context also exists for unmatched routes — a 404 is
    // still worth tracing.
    consumer.apply(RequestContextMiddleware).forRoutes("{*path}")
  }
}
