-- Allow a new transaction type for image-credit-pack purchases.
ALTER TABLE public.transactions DROP CONSTRAINT transactions_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('subscription', 'tool_purchase', 'refund', 'adjustment', 'credit_pack'));
