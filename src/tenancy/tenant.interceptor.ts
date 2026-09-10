import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext } from './tenant-context';

/**
 * Runs after the JWT guard, so `req.user` is populated. Wraps the handler in
 * the tenant scope so any service down the call chain can read it.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const header = req?.headers?.['x-organization-id'];
    const scope = TenantContext.fromJwt(
      req?.user,
      Array.isArray(header) ? header[0] : header,
    );
    req.tenantScope = scope;
    return TenantContext.run(scope, () => next.handle());
  }
}
