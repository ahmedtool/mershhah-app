'use client';

import { useParams } from 'wouter';
import { GatewayRequestForm } from '@/components/support/GatewayRequestForm';

export default function CustomServicePage() {
  const params = useParams();
  const slug = params.slug as string;
  return <GatewayRequestForm serviceType={`custom:${slug}`} />;
}
