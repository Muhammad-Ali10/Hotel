import { Module } from "@nestjs/common"

import { AnalyticsEventsService } from "./analytics-events.service"
import { AnalyticsRepository } from "./analytics.repository"
import { RankingRepository } from "./ranking.repository"
import { RankingService } from "./ranking.service"
import { RankingJobs } from "./ranking.jobs"
import { JobLockService } from "../../common/scheduling/job-lock.service"
import {
  AdminAnalyticsController,
  PartnerAnalyticsController,
  SearchEventsController,
} from "./analytics.controller"
import { AnalyticsService } from "./analytics.service"

/**
 * Module 10's second half — analytics (rules #62–#68).
 *
 * `AnalyticsEventsService` is exported because the catalogue's search endpoint
 * records through it: the events must be written where the search actually
 * happens, and a partner-facing module cannot reach into the public one.
 */
@Module({
  controllers: [PartnerAnalyticsController, SearchEventsController, AdminAnalyticsController],
  providers: [
    AnalyticsRepository,
    AnalyticsService,
    AnalyticsEventsService,
    RankingRepository,
    RankingService,
    RankingJobs,
    JobLockService,
  ],
  // `AnalyticsRepository` goes out for one reason: it owns
  // `scopedPropertyIds`, and the finance reports must answer "which
  // properties may this member see" exactly the way analytics does.
  exports: [AnalyticsEventsService, AnalyticsRepository, RankingService],
})
export class AnalyticsModule {}
