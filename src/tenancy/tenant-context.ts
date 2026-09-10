import { AsyncLocalStorage } from 'async_hooks';
import { Types } from 'mongoose';

/**
 * Who is asking, and which slice of the data they may touch. Built once per
 * request from the JWT (never from the request body) and read by the services
 * through `TenantContext.current()`.
 */
export interface TenantScope {
  /** 'super_admin' | 'builder_admin' | 'building_manager' | 'guard' | 'resident' | 'legacy_admin' | 'anonymous' */
  role: string;
  /** The organization the request is confined to; null = platform-wide (super admin without a selected org). */
  organizationId: Types.ObjectId | null;
  /** Building restriction on top of the organization (building managers, guards with assigned sites). */
  buildingIds: Types.ObjectId[] | null;
  /** Principal id (admin user id, guard id, resident id). */
  principalId?: string;
  email?: string;
  name?: string;
}

const storage = new AsyncLocalStorage<TenantScope>();

export const PLATFORM_ROLES = new Set(['super_admin', 'legacy_admin']);
export const ADMIN_ROLE_SET = new Set([
  'super_admin',
  'builder_admin',
  'building_manager',
  'legacy_admin',
]);

function oid(v: any): Types.ObjectId | null {
  if (!v) return null;
  const s = String(v);
  return Types.ObjectId.isValid(s) ? new Types.ObjectId(s) : null;
}

export class TenantContext {
  static run<T>(scope: TenantScope, fn: () => T): T {
    return storage.run(scope, fn);
  }

  static current(): TenantScope {
    return (
      storage.getStore() || {
        role: 'anonymous',
        organizationId: null,
        buildingIds: null,
      }
    );
  }

  /** Build the scope from a validated JWT payload (+ optional org header for super admins). */
  static fromJwt(user: any, orgHeader?: string): TenantScope {
    if (!user) {
      return { role: 'anonymous', organizationId: null, buildingIds: null };
    }
    const role: string =
      user.role ||
      (user.guardId ? 'guard' : user.userId === 'admin' ? 'legacy_admin' : 'resident');

    // The pre-multi-tenant env admin token: { sub: 'admin', role: 'admin' }.
    const effectiveRole = role === 'admin' ? 'legacy_admin' : role;

    let organizationId = oid(user.organizationId);
    const buildingIds = Array.isArray(user.buildingIds)
      ? (user.buildingIds.map(oid).filter(Boolean) as Types.ObjectId[])
      : [];

    if (PLATFORM_ROLES.has(effectiveRole)) {
      // Platform operator: optionally narrow to one organization.
      organizationId = oid(orgHeader);
      return {
        role: effectiveRole,
        organizationId,
        buildingIds: null,
        principalId: user.userId,
        email: user.email,
        name: user.name,
      };
    }

    return {
      role: effectiveRole,
      organizationId,
      buildingIds: buildingIds.length ? buildingIds : null,
      principalId: user.userId,
      email: user.email,
      name: user.name,
    };
  }

  static isPlatform(scope = TenantContext.current()): boolean {
    return PLATFORM_ROLES.has(scope.role);
  }

  static isAdmin(scope = TenantContext.current()): boolean {
    return ADMIN_ROLE_SET.has(scope.role);
  }

  /** Mongo filter for a collection stamped with `organizationId`. */
  static orgFilter(field = 'organizationId', scope = TenantContext.current()): Record<string, any> {
    if (!scope.organizationId) return {};
    return { [field]: scope.organizationId };
  }

  /**
   * Mongo filter for a collection stamped with a building id. Combines the
   * organization and, for restricted accounts, the building list.
   */
  static buildingFilter(
    buildingField = 'buildingId',
    orgField = 'organizationId',
    scope = TenantContext.current(),
  ): Record<string, any> {
    const filter: Record<string, any> = TenantContext.orgFilter(orgField, scope);
    if (scope.buildingIds && scope.buildingIds.length) {
      filter[buildingField] = { $in: scope.buildingIds };
    }
    return filter;
  }

  /** Filter for the Building collection itself (`_id` is the building id). */
  static buildingSelfFilter(scope = TenantContext.current()): Record<string, any> {
    return TenantContext.buildingFilter('_id', 'organizationId', scope);
  }

  /** The organization a newly created record must be stamped with. */
  static requireOrganizationId(scope = TenantContext.current()): Types.ObjectId {
    if (!scope.organizationId) {
      const err: any = new Error(
        TenantContext.isPlatform(scope)
          ? 'Select an organization first (X-Organization-Id header).'
          : 'Your account is not linked to an organization.',
      );
      err.status = 400;
      throw err;
    }
    return scope.organizationId;
  }

  /** True when the given building id is inside the caller's scope. */
  static canAccessBuilding(buildingId: any, scope = TenantContext.current()): boolean {
    if (!scope.buildingIds || !scope.buildingIds.length) return true;
    const id = String(buildingId);
    return scope.buildingIds.some((b) => String(b) === id);
  }
}
