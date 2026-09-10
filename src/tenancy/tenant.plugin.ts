import { Schema, Types } from 'mongoose';
import { TenantContext, TenantScope } from './tenant-context';

/**
 * Data-layer tenancy. Registered on the Mongoose connection so it applies to
 * every model:
 *
 * - For admin and guard callers, every read/update/delete on a collection that
 *   carries `organizationId` is confined to the caller's organization, and —
 *   for building managers / site-bound guards — to their buildings (via
 *   `buildingId`, or `_id` on the Building collection itself).
 * - New documents are stamped with the caller's organization when the schema
 *   has `organizationId` and the document does not set one.
 *
 * Resident callers are not filtered here: their services already key off the
 * resident's own id, and residents created before the migration carry no
 * organization yet.
 */
const QUERY_OPS = [
  'find',
  'findOne',
  'countDocuments',
  'estimatedDocumentCount',
  'findOneAndUpdate',
  'findOneAndDelete',
  'findOneAndReplace',
  'updateOne',
  'updateMany',
  'deleteOne',
  'deleteMany',
  'distinct',
] as const;

function isScoped(scope: TenantScope): boolean {
  return TenantContext.isAdmin(scope) || scope.role === 'guard';
}

export function tenantFilterFor(
  scope: TenantScope,
  opts: { hasOrg: boolean; hasBuilding: boolean; isBuildingModel: boolean },
): Record<string, any> | null {
  if (!isScoped(scope)) return null;
  const f: Record<string, any> = {};
  if (opts.hasOrg) {
    if (scope.organizationId) f.organizationId = scope.organizationId;
    else if (!TenantContext.isPlatform(scope)) {
      // A builder admin / guard without a builder (pre-migration token) only
      // sees legacy data that has no builder either — never everything.
      f.organizationId = null;
    }
  }
  if (scope.buildingIds && scope.buildingIds.length) {
    if (opts.isBuildingModel) f._id = { $in: scope.buildingIds };
    else if (opts.hasBuilding) f.buildingId = { $in: scope.buildingIds };
  }
  return Object.keys(f).length ? f : null;
}

export function tenantPlugin(schema: Schema) {
  const hasOrg = !!schema.path('organizationId');
  const hasBuilding = !!schema.path('buildingId');
  if (!hasOrg && !hasBuilding) return;

  const opts = (modelName?: string) => ({
    hasOrg,
    hasBuilding,
    isBuildingModel: modelName === 'Building',
  });

  const queryHook = function (this: any) {
    const scope = TenantContext.current();
    const f = tenantFilterFor(scope, opts(this.model?.modelName));
    if (!f) return;
    const current = this.getFilter ? this.getFilter() : this.getQuery();
    this.setQuery({ $and: [current || {}, f] });
  };
  for (const op of QUERY_OPS) {
    schema.pre(op as any, queryHook);
  }

  schema.pre('aggregate', function (this: any) {
    const scope = TenantContext.current();
    const f = tenantFilterFor(scope, opts(this._model?.modelName));
    if (!f) return;
    this.pipeline().unshift({ $match: f });
  });

  if (hasOrg) {
    schema.pre('save', function (this: any) {
      if (this.organizationId) return;
      const scope = TenantContext.current();
      if (scope.organizationId) {
        this.organizationId = scope.organizationId as Types.ObjectId;
      }
    });
    (schema as any).pre('insertMany', function (this: any, next: any, docs: any[]) {
      const scope = TenantContext.current();
      if (scope.organizationId && Array.isArray(docs)) {
        for (const d of docs) if (d && !d.organizationId) d.organizationId = scope.organizationId;
      }
      next();
    });
  }
}
