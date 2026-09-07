'use client';

import { GatewayRequestForm } from '@/components/support/GatewayRequestForm';
import { FRANCHISE_FIELDS } from '@/lib/gateway-service-types';

export default function FranchisePage() {
  return <GatewayRequestForm serviceType="franchise" titleKey="ownerGateway.franchiseTitle" fields={FRANCHISE_FIELDS} />;
}
