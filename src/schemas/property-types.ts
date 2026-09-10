import { SiteType } from './site-settings';

/** How units inside a building are laid out. */
export enum UnitModel {
  /** floors × units-per-floor, numbered 101, 102, … */
  FLOORS = 'floors',
  /** a flat list of standalone units, numbered Villa-001, Plot-001, … */
  STANDALONE = 'standalone',
}

export enum PropertyType {
  // residential
  APARTMENT = 'apartment',
  TOWER = 'tower',
  VILLA = 'villa',
  ROW_HOUSE = 'row_house',
  INDEPENDENT_HOUSE = 'independent_house',
  GATED_COMMUNITY = 'gated_community',
  PLOT = 'plot',
  // commercial
  OFFICE = 'office',
  IT_PARK = 'it_park',
  COWORKING = 'coworking',
  MALL = 'mall',
  RETAIL = 'retail',
  WAREHOUSE = 'warehouse',
}

export interface PropertyTypeInfo {
  type: PropertyType;
  label: string;
  siteType: SiteType;
  unitModel: UnitModel;
  unitLabel: string; // "Flat", "Villa", "Plot", "Office"…
  unitPrefix?: string; // standalone numbering prefix
  description: string;
}

export const PROPERTY_TYPES: PropertyTypeInfo[] = [
  { type: PropertyType.APARTMENT, label: 'Apartment', siteType: SiteType.RESIDENTIAL, unitModel: UnitModel.FLOORS, unitLabel: 'Flat', description: 'Multi-storey block of flats' },
  { type: PropertyType.TOWER, label: 'Tower', siteType: SiteType.RESIDENTIAL, unitModel: UnitModel.FLOORS, unitLabel: 'Flat', description: 'High-rise tower' },
  { type: PropertyType.VILLA, label: 'Villa', siteType: SiteType.RESIDENTIAL, unitModel: UnitModel.STANDALONE, unitLabel: 'Villa', unitPrefix: 'Villa', description: 'Villa community' },
  { type: PropertyType.ROW_HOUSE, label: 'Row House', siteType: SiteType.RESIDENTIAL, unitModel: UnitModel.STANDALONE, unitLabel: 'House', unitPrefix: 'House', description: 'Row / town houses' },
  { type: PropertyType.INDEPENDENT_HOUSE, label: 'Independent House', siteType: SiteType.RESIDENTIAL, unitModel: UnitModel.STANDALONE, unitLabel: 'House', unitPrefix: 'House', description: 'Independent houses / bungalows' },
  { type: PropertyType.GATED_COMMUNITY, label: 'Gated Community', siteType: SiteType.RESIDENTIAL, unitModel: UnitModel.STANDALONE, unitLabel: 'Unit', unitPrefix: 'Unit', description: 'Mixed township with standalone units' },
  { type: PropertyType.PLOT, label: 'Plotted Layout', siteType: SiteType.RESIDENTIAL, unitModel: UnitModel.STANDALONE, unitLabel: 'Plot', unitPrefix: 'Plot', description: 'Plots in a layout' },
  { type: PropertyType.OFFICE, label: 'Office Building', siteType: SiteType.COMMERCIAL, unitModel: UnitModel.FLOORS, unitLabel: 'Office', description: 'Office block' },
  { type: PropertyType.IT_PARK, label: 'IT Park', siteType: SiteType.COMMERCIAL, unitModel: UnitModel.FLOORS, unitLabel: 'Office', description: 'Tech / IT park' },
  { type: PropertyType.COWORKING, label: 'Co-working', siteType: SiteType.COMMERCIAL, unitModel: UnitModel.FLOORS, unitLabel: 'Suite', description: 'Co-working space' },
  { type: PropertyType.MALL, label: 'Mall', siteType: SiteType.COMMERCIAL, unitModel: UnitModel.FLOORS, unitLabel: 'Shop', description: 'Shopping mall' },
  { type: PropertyType.RETAIL, label: 'Retail', siteType: SiteType.COMMERCIAL, unitModel: UnitModel.FLOORS, unitLabel: 'Shop', description: 'Retail complex' },
  { type: PropertyType.WAREHOUSE, label: 'Warehouse', siteType: SiteType.COMMERCIAL, unitModel: UnitModel.STANDALONE, unitLabel: 'Bay', unitPrefix: 'Bay', description: 'Warehouse / logistics park' },
];

export function propertyTypeInfo(type?: string | null): PropertyTypeInfo {
  return (
    PROPERTY_TYPES.find((p) => p.type === type) ||
    PROPERTY_TYPES[0]
  );
}

/** Map the legacy free-text `Building.type` label onto the enum. */
export function propertyTypeFromLegacyLabel(label?: string | null): PropertyType {
  const l = (label || '').toLowerCase().trim();
  if (!l) return PropertyType.APARTMENT;
  const exact = PROPERTY_TYPES.find(
    (p) => p.type === l || p.label.toLowerCase() === l,
  );
  if (exact) return exact.type;
  if (/tower/.test(l)) return PropertyType.TOWER;
  if (/villa/.test(l)) return PropertyType.VILLA;
  if (/row/.test(l)) return PropertyType.ROW_HOUSE;
  if (/individual|independent|bungalow|house/.test(l)) return PropertyType.INDEPENDENT_HOUSE;
  if (/gated|township|community/.test(l)) return PropertyType.GATED_COMMUNITY;
  if (/plot|layout/.test(l)) return PropertyType.PLOT;
  if (/mall/.test(l)) return PropertyType.MALL;
  if (/retail|shop/.test(l)) return PropertyType.RETAIL;
  if (/warehouse|godown|logistic/.test(l)) return PropertyType.WAREHOUSE;
  if (/it park|tech/.test(l)) return PropertyType.IT_PARK;
  if (/cowork/.test(l)) return PropertyType.COWORKING;
  if (/commercial|office|business|corporate/.test(l)) return PropertyType.OFFICE;
  return PropertyType.APARTMENT;
}

export function isStandalone(type?: string | null): boolean {
  return propertyTypeInfo(type).unitModel === UnitModel.STANDALONE;
}

/** Unit number for the standalone model: "Villa-001", "Plot-012"… */
export function standaloneUnitNumber(type: string, index: number): string {
  const prefix = propertyTypeInfo(type).unitPrefix || 'Unit';
  return `${prefix}-${String(index).padStart(3, '0')}`;
}
