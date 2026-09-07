import type { BusinessGatewayField } from '@/lib/types';

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

export const GATEWAY_FIELD_DEFS: Record<string, BusinessGatewayField[]> = {
  franchise: FRANCHISE_FIELDS,
  wholesale: WHOLESALE_FIELDS,
};
