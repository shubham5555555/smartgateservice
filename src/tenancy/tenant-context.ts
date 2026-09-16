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
  /**
   * Company principals (boss / HR / employee) are confined to one company on
   * top of the organization, the same way a building manager is confined to
   * their buildings.
   */
  companyId: Types.ObjectId | null;
  /** 'boss' | 'hr' | 'employee' — null for everyone else. */
  companyRole: string | null;
  /** Principal id (admin user id, guard id, resident id). */
  principalId?: string;
  email?: string;
  name?: string;
}

const storage = new AsyncLocalStorage<TenantScope>();

export const PLATFORM_ROLES = new Set(['super_admin', 'legacy_admin']);
/** Roles held by a member of an office tenant, carried on a resident-app token. */
export const COMPANY_ROLE_SET = new Set(['boss', 'hr', 'employee']);
/** Boss and HR manage the company; an employee only ever sees their own rows. */
export const COMPANY_MANAGER_SET = new Set(['boss', 'hr']);
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

  /**
   * Run a block with every tenant filter off. Only for genuinely global
   * questions — "is this email / pass code already taken anywhere?" — where a
   * scoped answer would be wrong and would surface as a duplicate-key crash.
   * Never use it to return data to a caller.
   */
  static runUnscoped<T>(fn: () => T): T {
    return storage.run(
      {
        role: 'legacy_admin',
        organizationId: null,
        buildingIds: null,
        companyId: null,
        companyRole: null,
      },
      fn,
    );
  }

  static current(): TenantScope {
    return (
      storage.getStore() || {
        role: 'anonymous',
        organizationId: null,
        buildingIds: null,
        companyId: null,
        companyRole: null,
      }
    );
  }

  /** Build the scope from a validated JWT payload (+ optional org header for super admins). */
  static fromJwt(user: any, orgHeader?: string): TenantScope {
    if (!user) {
      return {
        role: 'anonymous',
        organizationId: null,
        buildingIds: null,
        companyId: null,
        companyRole: null,
      };
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
        companyId: null,
        companyRole: null,
        principalId: user.userId,
        email: user.email,
        name: user.name,
      };
    }

    // A company member signs in through the resident app: role stays
    // 'resident', and the company claims narrow them further.
    const companyId = oid(user.companyId);
    const companyRole =
      user.companyRole && COMPANY_ROLE_SET.has(String(user.companyRole))
        ? String(user.companyRole)
        : null;

    return {
      role: effectiveRole,
      organizationId,
      buildingIds: buildingIds.length ? buildingIds : null,
      companyId: companyRole ? companyId : null,
      companyRole: companyId ? companyRole : null,
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

  /** True for a boss / HR / employee token. */
  static isCompany(scope = TenantContext.current()): boolean {
    return !!scope.companyId && !!scope.companyRole;
  }

  /** True when the caller may act for the whole company (boss or HR). */
  static isCompanyManager(scope = TenantContext.current()): boolean {
    return (
      TenantContext.isCompany(scope) &&
      COMPANY_MANAGER_SET.has(scope.companyRole as string)
    );
  }

  /** The company a company principal is confined to. */
  static requireCompanyId(scope = TenantContext.current()): Types.ObjectId {
    if (!scope.companyId) {
      const err: any = new Error('Your account is not linked to a company.');
      err.status = 403;
      throw err;
    }
    return scope.companyId;
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
