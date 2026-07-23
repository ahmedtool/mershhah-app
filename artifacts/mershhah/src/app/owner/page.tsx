'use client';
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function OwnerIndexPage() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation('/owner/dashboard');
  }, []);
  return null;
}
