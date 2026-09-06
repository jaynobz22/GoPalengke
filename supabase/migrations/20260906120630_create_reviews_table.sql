/*
# Create reviews table

1. New Tables
- `reviews`
  - `id` (uuid, primary key)
  - `order_id` (uuid, references orders, not null)
  - `reviewer_id` (uuid, references profiles, not null) — the buyer who wrote the review
  - `reviewee_id` (uuid, references profiles, not null) — the seller or rider being reviewed
  - `review_type` (text, not null) — 'seller' or 'rider'
  - `rating` (integer, 1-5, not null)
  - `comment` (text, not null)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())
- Unique constraint on (order_id, review_type) — one review per type per order

2. Security
- Enable RLS on `reviews`.
- SELECT: all authenticated users can read reviews (public reputation)
- INSERT: only the buyer of the order can insert a review
- UPDATE/DELETE: only the reviewer can modify their own review

3. Indexes
- Index on `reviewee_id` for fetching a user's reviews
- Index on `order_id` for checking if an order has been reviewed
*/

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  review_type text NOT NULL CHECK (review_type IN ('seller', 'rider')),
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (order_id, review_type)
);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_order_id ON reviews(order_id);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select_all" ON reviews;
CREATE POLICY "reviews_select_all" ON reviews FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "reviews_insert_own" ON reviews;
CREATE POLICY "reviews_insert_own" ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = reviews.order_id
      AND orders.buyer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "reviews_update_own" ON reviews;
CREATE POLICY "reviews_update_own" ON reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = reviewer_id)
  WITH CHECK (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "reviews_delete_own" ON reviews;
CREATE POLICY "reviews_delete_own" ON reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = reviewer_id);
