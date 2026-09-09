import { BadRequestException, type PipeTransform } from "@nestjs/common"
import type { ZodType } from "zod"

/**
 * Validates a request body/query against a zod schema.
 *
 *   @Post()
 *   create(@Body(new ZodValidationPipe(createBookingSchema)) body: CreateBookingInput) {}
 *
 * These schemas will move to a shared package once Phase 0 lands, so the Next
 * app validates the form with the exact object the API validates the request
 * with — one schema, not two that drift.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value)

    if (!result.success) {
      throw new BadRequestException({
        message: "Validation failed",
        errors: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      })
    }

    return result.data
  }
}
