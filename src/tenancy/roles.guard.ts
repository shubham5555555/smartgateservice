import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

const ADMIN_ROLES = ['super_admin', 'builder_admin', 'building_manager'];
const COMPANY_MANAGER_ROLES = ['boss', 'hr'];

function normaliseRole(user: any): string {
  if (!user) return 'anonymous';
  if (user.role === 'admin' || user.userId === 'admin') return 'super_admin';
  if (user.role) return String(user.role);
  if (user.guardId) return 'guard';
  return 'resident';
}

/**
 * Role check for routes that already passed JwtAuthGuard. When a handler or
 * controller declares @Roles(...) the caller must hold one of them.
 *
 * Shorthands: 'admin' = any admin role; 'company' = any member of an office
 * tenant; 'company_manager' = boss or HR. A company member signs in through
 * the resident app, so their base role is 'resident' and the company standing
 * lives in the separate `companyRole` claim.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const role = normaliseRole(req.user);
    const companyRole = req.user?.companyRole
      ? String(req.user.companyRole)
      : null;
    const allowed = required.some((r) => {
      if (r === 'admin') return ADMIN_ROLES.includes(role);
      if (r === 'company') return !!companyRole;
      if (r === 'company_manager')
        return !!companyRole && COMPANY_MANAGER_ROLES.includes(companyRole);
      if (r === 'boss' || r === 'hr' || r === 'employee')
        return companyRole === r;
      return r === role;
    });
    if (!allowed) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }
    return true;
  }
}
