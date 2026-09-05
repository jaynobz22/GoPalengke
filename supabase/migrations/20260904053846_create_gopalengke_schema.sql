/*
# GoPalengke - Online Wet Market Platform Schema

## Overview
Complete database schema for GoPalengke, the first online wet market platform in the Philippines.
Supports three user roles: buyers, sellers, and riders.

## New Tables
1. `profiles` - Extends auth.users with role, name, phone, and location (barangay, district, city, region)
2. `categories` - Product categories (isda, karne, gulay, etc.)
3. `stores` - Seller stores with name, description, location, banner, logo, QR code for payments
4. `products` - Items sold by stores (name, price, unit, image, stock, category)
5. `orders` - Buyer orders with status, payment method, delivery address, rider assignment
6. `order_items` - Individual items within an order
7. `cart_items` - Shopping cart for buyers (pre-checkout)

## Security
- RLS enabled on all tables
- Owner-scoped policies for authenticated users
- Public read for storefront browsing (products, stores, categories)
- Buyers can only see/manage their own orders and cart
- Sellers can only manage their own stores and products
- Riders can only see orders assigned to them
*/

-- ============= PROFILES =============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid(),
  email text NOT NULL,
  full_name text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer', 'seller', 'rider')),
  barangay text,
  district text,
  city text,
  region text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============= CATEGORIES =============
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_fil text NOT NULL,
  slug text UNIQUE NOT NULL,
  icon text,
  image_url text,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_read_all" ON categories;
CREATE POLICY "categories_read_all" ON categories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "categories_insert_auth" ON categories;
CREATE POLICY "categories_insert_auth" ON categories FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "categories_update_auth" ON categories;
CREATE POLICY "categories_update_auth" ON categories FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- ============= STORES =============
CREATE TABLE IF NOT EXISTS stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  barangay text NOT NULL,
  district text,
  city text NOT NULL,
  region text NOT NULL,
  logo_url text,
  banner_url text,
  qr_code_url text,
  payment_method text DEFAULT 'gcash',
  is_open boolean DEFAULT true,
  rating numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- Public can browse stores
DROP POLICY IF EXISTS "stores_select_all" ON stores;
CREATE POLICY "stores_select_all" ON stores FOR SELECT
  TO anon, authenticated USING (true);

-- Only owner can insert/update/delete
DROP POLICY IF EXISTS "stores_insert_own" ON stores;
CREATE POLICY "stores_insert_own" ON stores FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "stores_update_own" ON stores;
CREATE POLICY "stores_update_own" ON stores FOR UPDATE
  TO authenticated USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "stores_delete_own" ON stores;
CREATE POLICY "stores_delete_own" ON stores FOR DELETE
  TO authenticated USING (auth.uid() = seller_id);

-- ============= PRODUCTS =============
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'kilo',
  image_url text,
  stock int NOT NULL DEFAULT 0,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Public can browse products
DROP POLICY IF EXISTS "products_select_all" ON products;
CREATE POLICY "products_select_all" ON products FOR SELECT
  TO anon, authenticated USING (true);

-- Only store owner can insert/update/delete
DROP POLICY IF EXISTS "products_insert_own" ON products;
CREATE POLICY "products_insert_own" ON products FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM stores WHERE stores.id = products.store_id AND stores.seller_id = auth.uid())
  );

DROP POLICY IF EXISTS "products_update_own" ON products;
CREATE POLICY "products_update_own" ON products FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = products.store_id AND stores.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM stores WHERE stores.id = products.store_id AND stores.seller_id = auth.uid()));

DROP POLICY IF EXISTS "products_delete_own" ON products;
CREATE POLICY "products_delete_own" ON products FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM stores WHERE stores.id = products.store_id AND stores.seller_id = auth.uid())
  );

-- ============= CART ITEMS =============
CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  quantity int NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cart_select_own" ON cart_items;
CREATE POLICY "cart_select_own" ON cart_items FOR SELECT
  TO authenticated USING (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "cart_insert_own" ON cart_items;
CREATE POLICY "cart_insert_own" ON cart_items FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "cart_update_own" ON cart_items;
CREATE POLICY "cart_update_own" ON cart_items FOR UPDATE
  TO authenticated USING (auth.uid() = buyer_id) WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "cart_delete_own" ON cart_items;
CREATE POLICY "cart_delete_own" ON cart_items FOR DELETE
  TO authenticated USING (auth.uid() = buyer_id);

-- ============= ORDERS =============
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  rider_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'preparing', 'ready_for_pickup', 'picked_up', 'delivered', 'cancelled')),
  payment_method text DEFAULT 'qr_code' CHECK (payment_method IN ('qr_code', 'cod')),
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  total numeric NOT NULL DEFAULT 0,
  delivery_fee numeric DEFAULT 0,
  delivery_barangay text,
  delivery_district text,
  delivery_city text,
  delivery_region text,
  delivery_address text,
  delivery_lat numeric,
  delivery_lng numeric,
  buyer_note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Buyer can see their own orders, seller can see orders for their store, rider can see assigned orders
DROP POLICY IF EXISTS "orders_select_own" ON orders;
CREATE POLICY "orders_select_own" ON orders FOR SELECT
  TO authenticated USING (
    auth.uid() = buyer_id
    OR EXISTS (SELECT 1 FROM stores WHERE stores.id = orders.store_id AND stores.seller_id = auth.uid())
    OR auth.uid() = rider_id
  );

-- Only buyer can insert their order
DROP POLICY IF EXISTS "orders_insert_own" ON orders;
CREATE POLICY "orders_insert_own" ON orders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = buyer_id);

-- Buyer can update their own orders (cancel), seller can update status, rider can update status
DROP POLICY IF EXISTS "orders_update_own" ON orders;
CREATE POLICY "orders_update_own" ON orders FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = buyer_id
    OR EXISTS (SELECT 1 FROM stores WHERE stores.id = orders.store_id AND stores.seller_id = auth.uid())
    OR auth.uid() = rider_id
  )
  WITH CHECK (
    auth.uid() = buyer_id
    OR EXISTS (SELECT 1 FROM stores WHERE stores.id = orders.store_id AND stores.seller_id = auth.uid())
    OR auth.uid() = rider_id
  );

-- ============= ORDER ITEMS =============
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  product_image text,
  price numeric NOT NULL DEFAULT 0,
  quantity int NOT NULL DEFAULT 1,
  unit text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_items_select_own" ON order_items;
CREATE POLICY "order_items_select_own" ON order_items FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.buyer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM orders JOIN stores ON stores.id = orders.store_id WHERE orders.id = order_items.order_id AND stores.seller_id = auth.uid())
    OR EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.rider_id = auth.uid())
  );

DROP POLICY IF EXISTS "order_items_insert_own" ON order_items;
CREATE POLICY "order_items_insert_own" ON order_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.buyer_id = auth.uid())
  );

-- ============= INDEXES =============
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_stores_city ON stores(city);
CREATE INDEX IF NOT EXISTS idx_stores_barangay ON stores(barangay);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_rider_id ON orders(rider_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_cart_buyer_id ON cart_items(buyer_id);

-- ============= UPDATED_AT TRIGGER =============
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_profiles_updated ON profiles;
CREATE TRIGGER trigger_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_stores_updated ON stores;
CREATE TRIGGER trigger_stores_updated BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_products_updated ON products;
CREATE TRIGGER trigger_products_updated BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_orders_updated ON orders;
CREATE TRIGGER trigger_orders_updated BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
