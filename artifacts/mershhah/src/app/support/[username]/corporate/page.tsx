'use client';

import { GatewayRequestForm } from '@/components/support/GatewayRequestForm';
import { CORPORATE_FIELDS } from '@/lib/gateway-service-types';

export default function CorporatePage() {
  return <GatewayRequestForm serviceType="corporate" titleKey="ownerGateway.corporateTitle" fields={CORPORATE_FIELDS} />;
}
