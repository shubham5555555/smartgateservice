import { Types } from 'mongoose';
import { tenantFilterFor } from './tenant.plugin';
import { TenantContext, TenantScope } from './tenant-context';

const ORG_A = new Types.ObjectId();
const COMPANY_A = new Types.ObjectId();
const COMPANY_B = new Types.ObjectId();

function scope(over: Partial<TenantScope> = {}): TenantScope {
  return {
    role: 'resident',
    organizationId: null,
    buildingIds: null,
    companyId: null,
    companyRole: null,
    ...over,
  };
}

const companyCollection = {
  hasOrg: true,
  hasBuilding: true,
  hasCompany: true,
  isBuildingModel: false,
  isCompanyModel: false,
};

describe('tenantFilterFor — company scoping', () => {
  it('confines a company member to their own company', () => {
    const f = tenantFilterFor(
      scope({ companyId: COMPANY_A, companyRole: 'hr' }),
      companyCollection,
    );
    expect(f).toEqual({ companyId: COMPANY_A });
    // The filter is by id, so another company's rows cannot match.
    expect(String(f!.companyId)).not.toBe(String(COMPANY_B));
  });

  it('applies to an employee exactly as it does to a boss', () => {
    for (const companyRole of ['boss', 'hr', 'employee']) {
      expect(
        tenantFilterFor(
          scope({ companyId: COMPANY_A, companyRole }),
          companyCollection,
        ),
      ).toEqual({ companyId: COMPANY_A });
    }
  });

  it('filters the Company collection itself by _id', () => {
    expect(
      tenantFilterFor(scope({ companyId: COMPANY_A, companyRole: 'boss' }), {
        ...companyCollection,
        isCompanyModel: true,
      }),
    ).toEqual({ _id: COMPANY_A });
  });

  it('leaves a plain resident unfiltered', () => {
    expect(tenantFilterFor(scope(), companyCollection)).toBeNull();
  });

  it('keeps the org filter for admins and guards on company collections', () => {
    expect(
      tenantFilterFor(
        scope({ role: 'guard', organizationId: ORG_A }),
        companyCollection,
      ),
    ).toEqual({ organizationId: ORG_A });
  });

  it('does not let a company claim widen an admin token', () => {
    // A company principal is scoped by company; an admin never carries one.
    const f = tenantFilterFor(
      scope({ role: 'builder_admin', organizationId: ORG_A }),
      companyCollection,
    );
    expect(f).toEqual({ organizationId: ORG_A });
  });
});

describe('TenantContext.fromJwt — company claims', () => {
  it('reads company claims off a resident token', () => {
    const s = TenantContext.fromJwt({
      userId: 'u1',
      role: 'resident',
      companyId: String(COMPANY_A),
      companyRole: 'hr',
    });
    expect(String(s.companyId)).toBe(String(COMPANY_A));
    expect(s.companyRole).toBe('hr');
    expect(TenantContext.isCompanyManager(s)).toBe(true);
  });

  it('treats an employee as a company principal but not a manager', () => {
    const s = TenantContext.fromJwt({
      userId: 'u2',
      role: 'resident',
      companyId: String(COMPANY_A),
      companyRole: 'employee',
    });
    expect(TenantContext.isCompany(s)).toBe(true);
    expect(TenantContext.isCompanyManager(s)).toBe(false);
  });

  it('ignores an unknown companyRole', () => {
    const s = TenantContext.fromJwt({
      userId: 'u3',
      role: 'resident',
      companyId: String(COMPANY_A),
      companyRole: 'ceo-of-everything',
    });
    expect(s.companyRole).toBeNull();
    expect(s.companyId).toBeNull();
    expect(TenantContext.isCompany(s)).toBe(false);
  });

  it('ignores a company claim on an admin token', () => {
    const s = TenantContext.fromJwt({
      userId: 'a1',
      role: 'super_admin',
      companyId: String(COMPANY_A),
      companyRole: 'boss',
    });
    expect(s.companyId).toBeNull();
    expect(s.companyRole).toBeNull();
  });

  it('runUnscoped drops every filter', () => {
    TenantContext.run(
      scope({ companyId: COMPANY_A, companyRole: 'hr', organizationId: ORG_A }),
      () => {
        expect(
          tenantFilterFor(TenantContext.current(), companyCollection),
        ).toEqual({ companyId: COMPANY_A });
        TenantContext.runUnscoped(() => {
          expect(
            tenantFilterFor(TenantContext.current(), companyCollection),
          ).toBeNull();
        });
      },
    );
  });
});
