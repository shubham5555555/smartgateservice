jest.mock('../common/s3.service', () => ({ S3Service: class S3Service {} }));
import { Types } from 'mongoose';
import { AdminService } from './admin.service';
import { VisitPassService } from '../visits/visit-pass.service';
import { VisitRulesService } from '../visits/visit-rules.service';
import { EmployeeAccessService } from '../company/employee-access.service';
import { VisitorStatus, ApprovalMode } from '../schemas/visitor.schema';
import { SiteType, resolveSiteSettings } from '../schemas/site-settings';

// In-memory model boundary: no database, push, email or production HTTP calls.
describe('Gate lifecycle and pass verification', () => {
  let service: AdminService;
  let visitor: any;
  let model: any;
  let pass: VisitPassService;
  let rules: VisitRulesService;
  const settings = resolveSiteSettings(SiteType.RESIDENTIAL);
  beforeEach(() => {
    visitor = { _id: new Types.ObjectId(), name: 'Test visitor', status: VisitorStatus.APPROVED,
      approvalMode: ApprovalMode.NONE, passToken: 'test_pass_token_123456789', passCode: 'ABC234',
      approvedAt: new Date(), expiresAt: new Date(Date.now() + 3600000),
      save: jest.fn(async () => visitor) };
    const query = (filter: any = {}) => {
      const matches = !filter.status || filter.status.$in.includes(visitor.status);
      const q: any = { populate: () => q, sort: () => q, exec: async () => matches ? visitor : null };
      return q;
    };
    model = { findById: jest.fn(() => ({ ...visitor, ...query(), then: (fn: any) => Promise.resolve(visitor).then(fn) })), findOne: jest.fn(query) };
    pass = new VisitPassService(model, {} as any, {} as any);
    jest.spyOn(pass, 'contextForUser').mockResolvedValue({ siteType: SiteType.RESIDENTIAL, settings });
    rules = new VisitRulesService(model, {} as any, {} as any);
    jest.spyOn(rules, 'assertCapacity').mockResolvedValue();
    service = Object.assign(Object.create(AdminService.prototype), { visitorModel: model, passService: pass, visitRules: rules,
      employeeAccess: { findByToken: jest.fn(async () => null), findByCode: jest.fn(async () => null) },
      configService: { get: () => '24' } });
  });
  it.each([{ isApprovedByAdmin: false }, { isApprovedByAdmin: true, isActive: false }])('refuses an unapproved or inactive resident ID', async (user) => {
    (service as any).userModel = { findById: async () => user };
    await expect(service.verifyResidentId('test')).rejects.toThrow(/not approved/);
  });
  it('records approved entry, exit and re-entry, clearing the previous exit', async () => {
    await service.recordVisitorEntry(String(visitor._id), { role: 'guard', userId: 'guard' }, 'Main');
    expect(visitor.status).toBe('Inside'); expect(visitor.checkInGate).toBe('Main');
    await service.recordVisitorExit(String(visitor._id), 'Side');
    expect(visitor.status).toBe('Left'); expect(visitor.exitTime).toBeInstanceOf(Date);
    await service.recordVisitorEntry(String(visitor._id));
    expect(visitor.status).toBe('Inside'); expect(visitor.exitTime).toBeUndefined(); expect(visitor.checkOutGate).toBeUndefined();
  });
  it.each(['Pending', 'Rejected', 'Inside'])('refuses entry for %s without saving', async (status) => {
    visitor.status = status;
    await expect(service.recordVisitorEntry(String(visitor._id))).rejects.toThrow();
    expect(visitor.save).not.toHaveBeenCalled();
  });
  it.each(['Approved', 'Left', 'Pending', 'Rejected'])('refuses exit for %s without saving', async (status) => {
    visitor.status = status;
    await expect(service.recordVisitorExit(String(visitor._id))).rejects.toThrow();
    expect(visitor.save).not.toHaveBeenCalled();
  });
  it('refuses expired entry but permits expired exit', async () => {
    visitor.expiresAt = new Date(Date.now() - 1000);
    await expect(service.recordVisitorEntry(String(visitor._id))).rejects.toThrow(/expired/);
    visitor.status = 'Inside';
    expect((await service.verifyVisitorQR(JSON.stringify({ t: visitor.passToken }))).canCheckOut).toBe(true);
    await service.recordVisitorExit(String(visitor._id)); expect(visitor.status).toBe('Left');
  });
  it.each(['ABC234', 'https://example.test/visit/pass/test_pass_token_123456789', '{"v":2,"t":"test_pass_token_123456789"}'])('resolves a departed visitor for re-entry using %s', async (code) => {
    visitor.status = 'Left';
    expect((await service.verifyVisitorQR(code)).canCheckIn).toBe(true);
  });
  it('does not offer entry before the validity window', async () => {
    visitor.validFrom = new Date(Date.now() + 3600000);
    expect((await service.verifyVisitorQR(JSON.stringify({ t: visitor.passToken }))).canCheckIn).toBe(false);
    await expect(service.recordVisitorEntry(String(visitor._id))).rejects.toThrow(/valid from/);
  });
  it('does not offer entry for a blocked visitor', async () => {
    visitor.watchlistHit = { kind: 'block', reason: 'Test block' };
    expect((await service.verifyVisitorQR(JSON.stringify({ t: visitor.passToken }))).canCheckIn).toBe(false);
    await expect(service.recordVisitorEntry(String(visitor._id))).rejects.toThrow(/watchlist/);
  });
  it('refuses entry when capacity is reached', async () => {
    jest.spyOn(rules, 'assertCapacity').mockRejectedValue(new Error('Capacity reached'));
    await expect(service.recordVisitorEntry(String(visitor._id))).rejects.toThrow(/Capacity/);
    expect(visitor.save).not.toHaveBeenCalled();
  });
  it.each(['', '{"t":{"$ne":null}}', '{"visitorId":"invalid"}', 'not a code'])('rejects malformed QR %s', async (code) => {
    await expect(service.verifyVisitorQR(code)).rejects.toThrow();
    expect(model.findOne).not.toHaveBeenCalled();
  });
  it('keeps an unexpired QR available after checkout', () => {
    visitor.status = 'Left'; visitor.qrCode = 'payload';
    expect(pass.publicView(visitor).qrPayload).toBe('payload');
  });
});

describe('Employee exit eligibility', () => {
  it.each([{ passRevokedAt: new Date() }, { isActive: false }])('allows an employee already inside to leave when pass is invalid', async (invalid) => {
    const user: any = { _id: new Types.ObjectId(), passToken: 'token', ...invalid };
    const attendance = { findOne: () => ({ exec: async () => ({ status: 'Inside' }) }) };
    const service = new EmployeeAccessService({} as any, {} as any, {} as any, attendance as any, {} as any);
    const card = await service.card(user);
    expect(card.isValid).toBe(false); expect(card.canCheckIn).toBe(false); expect(card.canCheckOut).toBe(true);
  });
});
