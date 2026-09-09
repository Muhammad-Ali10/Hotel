/**
 * The API layer.
 *
 * `hooks` is what pages use. `endpoints` and `client` are here for the rare
 * caller that needs a bare request — a server component, or a mutation whose
 * caching does not fit a hook.
 */

export * from "./client"
export * from "./endpoints"
export * from "./errors"
export * from "./hooks"
