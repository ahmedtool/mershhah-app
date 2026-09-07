'use client';

import { GatewayRequestForm } from '@/components/support/GatewayRequestForm';
import { PARTNERSHIP_FIELDS } from '@/lib/gateway-service-types';

export default function PartnershipPage() {
  return <GatewayRequestForm serviceType="partnership" titleKey="ownerGateway.partnershipTitle" fields={PARTNERSHIP_FIELDS} />;
}
