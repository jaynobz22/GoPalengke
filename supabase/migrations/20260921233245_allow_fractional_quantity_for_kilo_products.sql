ALTER TABLE cart_items ALTER COLUMN quantity TYPE numeric(10,2) USING quantity::numeric;
ALTER TABLE order_items ALTER COLUMN quantity TYPE numeric(10,2) USING quantity::numeric;
