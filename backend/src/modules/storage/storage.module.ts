import { Global, Module } from "@nestjs/common"

import { env } from "../../config/env"
import { FakeStorageProvider } from "./provider/fake-storage.provider"
import { S3StorageProvider } from "./provider/s3-storage.provider"
import { STORAGE_PROVIDER } from "./provider/storage.provider"
import { StorageController } from "./storage.controller"

/**
 * The storage port and its two adapters (rule #73).
 *
 * `@Global` because photos are not the last thing that will need a file — an
 * invoice PDF, a partner's contract, a guest's ID scan for a visa-requiring
 * property all want the same port, and none of them should have to import a
 * module to get it.
 *
 * The adapter is chosen from the environment ONCE, at wiring time. Deciding
 * per call would mean a running process could be talked into a different
 * backend by a change nobody redeployed for.
 */
@Global()
@Module({
  controllers: [StorageController],
  providers: [
    FakeStorageProvider,
    S3StorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [FakeStorageProvider, S3StorageProvider],
      useFactory: (fake: FakeStorageProvider, s3: S3StorageProvider) =>
        env.STORAGE_DRIVER === "s3" ? s3 : fake,
    },
  ],
  exports: [STORAGE_PROVIDER, FakeStorageProvider],
})
export class StorageModule {}
