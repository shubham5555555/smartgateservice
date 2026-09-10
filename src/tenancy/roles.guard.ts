import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

const ADMIN_ROLES = ['super_admin', 'builder_admin', 'building_manager'];

function normaliseRole(user: any): string {
  if (!user) return 'anonymous';
  if (user.role === 'admin' || user.userId === 'admin') return 'super_admin';
  if (user.role) return String(user.role);
  if (user.guardId) return 'guard';
  return 'resident';
}

/**
 * Role check for routes that already passed JwtAuthGuard. When a handler or
 * controller declares @Roles(...) the caller must hold one of them; 'admin' in
 * the list means "any admin role".
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
    const allowed = required.some((r) =>
      r === 'admin' ? ADMIN_ROLES.includes(role) : r === role,
    );
    if (!allowed) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }
    return true;
  }
}
