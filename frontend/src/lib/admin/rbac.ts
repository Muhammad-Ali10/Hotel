/**
 * Role-based access control for `/admin`.
 *
 * The matrix itself moved to `@stayora/shared`, because the API enforces it
 * now and there must be exactly one copy. While it lived only here it was
 * decoration: the browser hid buttons a role could not use, and the API served
 * every one of those routes to anybody holding `role = admin`.
 *
 * This file stays so the twenty-odd components importing from it keep working,
 * and so there is one obvious place to look when somebody asks where the
 * permissions are.
 */

export {
  ACTIONS,
  ADMIN_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  RESOURCES,
  accessFor,
  canDo,
  canManage,
  canView,
  type Access,
  type AdminAction,
  type AdminRole,
  type Resource,
} from "@stayora/shared"
