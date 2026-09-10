import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  WatchlistEntry,
  WatchlistEntryDocument,
  WatchlistKind,
} from '../schemas/watchlist.schema';
import { TenantContext } from '../tenancy/tenant-context';
import { CreateWatchlistDto, UpdateWatchlistDto } from './dto/watchlist.dto';

export interface WatchlistHit {
  kind: WatchlistKind;
  reason: string;
  name?: string;
  matchedOn: 'phone' | 'id' | 'vehicle' | 'name';
  entryId: string;
}

const digits = (v?: string | null) => (v || '').replace(/\D/g, '');
const last10 = (v?: string | null) => digits(v).slice(-10);

/** Per-builder blacklist / watchlist with fuzzy-enough matching for a desk. */
@Injectable()
export class WatchlistService {
  constructor(
    @InjectModel(WatchlistEntry.name)
    private model: Model<WatchlistEntryDocument>,
  ) {}

  findAll() {
    return this.model.find().sort({ createdAt: -1 }).exec();
  }

  async create(dto: CreateWatchlistDto) {
    const scope = TenantContext.current();
    return new this.model({
      ...dto,
      phoneNumber: dto.phoneNumber ? last10(dto.phoneNumber) : undefined,
      vehicleNumber: dto.vehicleNumber ? dto.vehicleNumber.replace(/\s+/g, '').toUpperCase() : undefined,
      buildingIds: (dto.buildingIds || []).map((b) => new Types.ObjectId(b)),
      organizationId: scope.organizationId || undefined,
      addedBy: scope.name || scope.email || scope.principalId,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    }).save();
  }

  async update(id: string, dto: UpdateWatchlistDto) {
    const entry = await this.model.findById(id).exec();
    if (!entry) throw new NotFoundException('Watchlist entry not found');
    const patch: any = { ...dto };
    if (dto.phoneNumber !== undefined) patch.phoneNumber = dto.phoneNumber ? last10(dto.phoneNumber) : undefined;
    if (dto.vehicleNumber !== undefined) patch.vehicleNumber = dto.vehicleNumber ? dto.vehicleNumber.replace(/\s+/g, '').toUpperCase() : undefined;
    if (dto.buildingIds !== undefined) patch.buildingIds = dto.buildingIds.map((b) => new Types.ObjectId(b));
    if (dto.expiresAt !== undefined) patch.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    Object.assign(entry, patch);
    return entry.save();
  }

  async remove(id: string) {
    const res = await this.model.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException('Watchlist entry not found');
    return { deleted: true };
  }

  /**
   * Strongest active hit for a visitor at a building. Runs unscoped when
   * called from the public form (anonymous), so the organization must be
   * passed explicitly.
   */
  async match(input: {
    organizationId?: Types.ObjectId | string | null;
    buildingId?: Types.ObjectId | string | null;
    phoneNumber?: string | null;
    idProofLast4?: string | null;
    vehicleNumber?: string | null;
    name?: string | null;
  }): Promise<WatchlistHit | null> {
    const or: any[] = [];
    const phone = last10(input.phoneNumber);
    if (phone.length >= 6) or.push({ phoneNumber: phone });
    const idl = (input.idProofLast4 || '').trim().toUpperCase();
    if (idl.length >= 3) or.push({ idProofLast4: new RegExp(`^${idl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    const veh = (input.vehicleNumber || '').replace(/\s+/g, '').toUpperCase();
    if (veh.length >= 4) or.push({ vehicleNumber: veh });
    const name = (input.name || '').trim();
    if (name.length >= 3) {
      or.push({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    }
    if (!or.length) return null;

    const filter: any = {
      isActive: true,
      $or: or,
      $and: [
        { $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }] },
      ],
    };
    if (input.organizationId) filter.organizationId = new Types.ObjectId(String(input.organizationId));
    if (input.buildingId) {
      filter.$and.push({
        $or: [{ buildingIds: { $size: 0 } }, { buildingIds: new Types.ObjectId(String(input.buildingId)) }],
      });
    }
    const entries = await this.model.find(filter).lean().exec();
    if (!entries.length) return null;
    // block beats warn; phone/id matches beat a name-only match
    const rank = (e: any) => {
      let r = e.kind === WatchlistKind.BLOCK ? 100 : 0;
      if (phone && e.phoneNumber === phone) r += 30;
      if (idl && e.idProofLast4 && e.idProofLast4.toUpperCase() === idl) r += 20;
      if (veh && e.vehicleNumber === veh) r += 15;
      return r;
    };
    const best: any = entries.sort((a, b) => rank(b) - rank(a))[0];
    const matchedOn: WatchlistHit['matchedOn'] =
      phone && best.phoneNumber === phone ? 'phone'
      : idl && best.idProofLast4 && best.idProofLast4.toUpperCase() === idl ? 'id'
      : veh && best.vehicleNumber === veh ? 'vehicle'
      : 'name';
    return { kind: best.kind, reason: best.reason, name: best.name, matchedOn, entryId: String(best._id) };
  }
}
