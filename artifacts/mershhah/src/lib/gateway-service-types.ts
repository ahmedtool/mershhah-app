import {
  Building2, Package, Users, Star, Gift, Calendar, ShoppingBag, Truck, Wrench, Camera, Music2, Coffee, FileQuestion,
} from 'lucide-react';
import type { BusinessGatewayField } from '@/lib/types';

// Fixed icon palette owners pick from when creating a custom gateway type -
// stored as the icon's name (a key of this map) in config.icon, since raw
// SVG/components can't be persisted to the DB.
export const CUSTOM_TYPE_ICONS: Record<string, any> = {
  Building2, Package, Users, Star, Gift, Calendar, ShoppingBag, Truck, Wrench, Camera, Music2, Coffee, FileQuestion,
};
export const DEFAULT_CUSTOM_TYPE_ICON = 'FileQuestion';
export function getCustomTypeIcon(name?: string | null) {
  return CUSTOM_TYPE_ICONS[name || ''] || CUSTOM_TYPE_ICONS[DEFAULT_CUSTOM_TYPE_ICON];
}

// Default field lists for the "just a form" gateway service types. Owner
// customization of these (per-restaurant field editing) is a follow-up —
// for now every restaurant that enables franchise/wholesale gets the same
// sensible default questions, submitted into business_requests.fields
// keyed by each field's id.
export const FRANCHISE_FIELDS: BusinessGatewayField[] = [
  { id: 'city', labelKey: 'ownerGateway.franchiseFieldCity', type: 'text' },
  { id: 'budget', labelKey: 'ownerGateway.franchiseFieldBudget', type: 'text' },
  { id: 'experience', labelKey: 'ownerGateway.franchiseFieldExperience', type: 'textarea' },
];

export const WHOLESALE_FIELDS: BusinessGatewayField[] = [
  { id: 'businessType', labelKey: 'ownerGateway.wholesaleFieldBusinessType', type: 'text' },
  { id: 'product', labelKey: 'ownerGateway.wholesaleFieldProduct', type: 'text' },
  { id: 'quantity', labelKey: 'ownerGateway.wholesaleFieldQuantity', type: 'text' },
];

export const CORPORATE_FIELDS: BusinessGatewayField[] = [
  { id: 'eventType', labelKey: 'ownerGateway.corporateFieldEventType', type: 'text' },
  { id: 'guestCount', labelKey: 'ownerGateway.corporateFieldGuestCount', type: 'number' },
  { id: 'eventDate', labelKey: 'ownerGateway.corporateFieldEventDate', type: 'text' },
  { id: 'notes', labelKey: 'ownerGateway.corporateFieldNotes', type: 'textarea' },
];

export const PARTNERSHIP_FIELDS: BusinessGatewayField[] = [
  { id: 'companyName', labelKey: 'ownerGateway.partnershipFieldCompanyName', type: 'text' },
  { id: 'partnershipType', labelKey: 'ownerGateway.partnershipFieldType', type: 'text' },
  { id: 'details', labelKey: 'ownerGateway.partnershipFieldDetails', type: 'textarea' },
];

export const GATEWAY_FIELD_DEFS: Record<string, BusinessGatewayField[]> = {
  franchise: FRANCHISE_FIELDS,
  wholesale: WHOLESALE_FIELDS,
  corporate: CORPORATE_FIELDS,
  partnership: PARTNERSHIP_FIELDS,
};
