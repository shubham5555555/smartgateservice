import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Restrict a route to the given JWT roles. Used together with RolesGuard.
 * Role strings: super_admin | builder_admin | building_manager | guard | resident.
 * The legacy env admin token (role 'admin') is treated as super_admin.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
