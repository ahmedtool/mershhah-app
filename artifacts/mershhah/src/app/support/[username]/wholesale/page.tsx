'use client';

import { GatewayRequestForm } from '@/components/support/GatewayRequestForm';
import { WHOLESALE_FIELDS } from '@/lib/gateway-service-types';

export default function WholesalePage() {
  return <GatewayRequestForm serviceType="wholesale" titleKey="ownerGateway.wholesaleTitle" fields={WHOLESALE_FIELDS} />;
}
