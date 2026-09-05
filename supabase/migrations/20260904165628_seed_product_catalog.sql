/*
# Seed Product Catalog Data

## Overview
Inserts 15 pre-built palengke products into the product_catalog table, each with
3 image variations. Images are stored in the public/ folder and served as static assets.

## Products
- Isda (3): Bangus, Tilapia, Galunggong
- Karne (3): Liempo (pork belly), Manok (whole chicken), Baka (beef)
- Gulay (6): Repolyo, Carrots, Kamatis, Sibuyas, Ampalaya, Kalabasa, Bawang, Kangkong, Pechay, Talong, Sitaw
- Panakot (3): Patis, Toyo, Suka

## Security
- No policy changes. Data is read-only from the frontend.
*/

INSERT INTO product_catalog (name, name_fil, category, default_unit, image_url_1, image_url_2, image_url_3, sort_order) VALUES
-- ISDA
('Bangus', 'Bangus', 'isda', 'kilo', '/bangus-1.webp', '/bangus-2.webp', '/bangus-3.webp', 1),
('Tilapia', 'Tilapia', 'isda', 'kilo', '/tilapia-1.webp', '/tilapia-2.webp', '/tilapia-3.webp', 2),
('Galunggong', 'Galunggong', 'isda', 'kilo', '/galunggong-1.webp', '/galunggong-2.webp', '/galunggong-3.webp', 3),
-- KARNE
('Liempo', 'Liempo (Baboy)', 'karne', 'kilo', '/liempo-1.webp', '/liempo-2.webp', '/liempo-3.webp', 4),
('Manok', 'Manok', 'karne', 'piece', '/manok-1.webp', '/manok-2.webp', '/manok-3.webp', 5),
('Baka', 'Baka', 'karne', 'kilo', '/baka-1.webp', '/baka-2.webp', '/baka-3.webp', 6),
-- GULAY
('Repolyo', 'Repolyo', 'gulay', 'piece', '/repolyo-1.webp', '/repolyo-2.webp', '/repolyo-3.webp', 7),
('Carrots', 'Karrots', 'gulay', 'kilo', '/carrots-1.webp', '/carrots-2.webp', '/carrots-3.webp', 8),
('Kamatis', 'Kamatis', 'gulay', 'kilo', '/kamatis-1.webp', '/kamatis-2.webp', '/kamatis-3.webp', 9),
('Sibuyas', 'Sibuyas', 'gulay', 'kilo', '/sibuyas-1.webp', '/sibuyas-2.webp', '/sibuyas-3.webp', 10),
('Ampalaya', 'Ampalaya', 'gulay', 'kilo', '/ampalaya-1.webp', '/ampalaya-2.webp', '/ampalaya-3.webp', 11),
('Kalabasa', 'Kalabasa', 'gulay', 'kilo', '/kalabasa-1.webp', '/kalabasa-2.webp', '/kalabasa-3.webp', 12),
('Bawang', 'Bawang', 'gulay', 'kilo', '/bawang-1.webp', '/bawang-2.webp', '/bawang-3.webp', 13),
('Kangkong', 'Kangkong', 'gulay', 'bundle', '/kangkong-1.webp', '/kangkong-2.webp', '/kangkong-3.webp', 14),
('Pechay', 'Pechay', 'gulay', 'bundle', '/pechay-1.webp', '/pechay-2.webp', '/pechay-3.webp', 15),
('Talong', 'Talong', 'gulay', 'kilo', '/talong-1.webp', '/talong-2.webp', '/talong-3.webp', 16),
('Sitaw', 'Sitaw', 'gulay', 'kilo', '/sitaw-1.webp', '/sitaw-2.webp', '/sitaw-3.webp', 17),
-- PANAKOT
('Patis', 'Patis', 'panakot', 'bote', '/patis-1.webp', '/patis-2.webp', '/patis-3.webp', 18),
('Toyo', 'Toyo', 'panakot', 'bote', '/toyo-1.webp', '/toyo-2.webp', '/toyo-3.webp', 19),
('Suka', 'Suka', 'panakot', 'bote', '/suka-1.webp', '/suka-2.webp', '/suka-3.webp', 20)
ON CONFLICT DO NOTHING;