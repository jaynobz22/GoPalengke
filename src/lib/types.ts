export type UserRole = 'buyer' | 'seller' | 'rider' | 'admin';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  barangay: string | null;
  district: string | null;
  city: string | null;
  region: string | null;
  avatar_url: string | null;
  slug: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  name_fil: string;
  slug: string;
  icon: string | null;
  image_url: string | null;
  sort_order: number;
}

export interface Store {
  id: string;
  seller_id: string;
  name: string;
  description: string | null;
  barangay: string;
  district: string | null;
  city: string;
  region: string;
  logo_url: string | null;
  banner_url: string | null;
  qr_code_url: string | null;
  payment_method: string;
  is_open: boolean;
  rating: number;
  palengke_name: string | null;
  slug: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  store_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  unit: string;
  image_url: string | null;
  stock: number;
  is_available: boolean;
  catalog_id: string | null;
  selected_image_index: number | null;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  id: string;
  buyer_id: string;
  product_id: string;
  store_id: string;
  quantity: number;
  created_at: string;
  product?: Product;
  store?: Store;
}

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 'qr_code' | 'cod';
export type PaymentStatus = 'pending' | 'paid' | 'failed';

export interface Order {
  id: string;
  buyer_id: string;
  store_id: string;
  rider_id: string | null;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  total: number;
  delivery_fee: number;
  delivery_barangay: string | null;
  delivery_district: string | null;
  delivery_city: string | null;
  delivery_region: string | null;
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  buyer_note: string | null;
  payment_reference: string | null;
  rider_lat: number | null;
  rider_lng: number | null;
  picked_up_at: string | null;
  created_at: string;
  updated_at: string;
  store?: Store;
  buyer?: Profile;
  rider?: Profile;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_image: string | null;
  price: number;
  quantity: number;
  unit: string | null;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Naghihintay ng confirm',
  accepted: 'Na-confirm na',
  preparing: 'Inihahanda na',
  ready_for_pickup: 'Ready for pickup',
  picked_up: 'Naka-pick up na',
  delivered: 'Na-deliver na',
  cancelled: 'Nakansela',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  accepted: 'bg-blue-100 text-blue-700 border-blue-200',
  preparing: 'bg-blue-100 text-blue-700 border-blue-200',
  ready_for_pickup: 'bg-purple-100 text-purple-700 border-purple-200',
  picked_up: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  delivered: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
};

export type ConversationType = 'buyer_seller' | 'buyer_rider';

export interface Conversation {
  id: string;
  order_id: string;
  buyer_id: string;
  seller_id: string | null;
  rider_id: string | null;
  type: ConversationType;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  message: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const REGIONS = [
  'NCR', 'CAR', 'Region I', 'Region II', 'Region III', 'Region IV-A', 'Region IV-B',
  'Region V', 'Region VI', 'Region VII', 'Region VIII', 'Region IX', 'Region X',
  'Region XI', 'Region XII', 'Region XIII', 'BARMM',
];

export const MARKET_NAMES: Record<string, string[]> = {
  'Davao City': [
    'Agdao Public Market',
    'Bankerohan Public Market',
    'Buhangin Public Market',
    'Bunawan Public Market',
    'Calinan Public Market',
    'Matina Public Market',
    'Mintal Public Market',
    'Toril Public Market',
    'Cabaguio Public Market',
    'Lanang Public Market',
  ],
  'Quezon City': [
    'Balintawak Public Market',
    'Commonwealth Public Market',
    'Farmers Market (Cubao)',
    'Muñoz Public Market',
    'Novaliches Public Market',
    'Tandang Sora Public Market',
  ],
  'Manila': [
    'Divisoria Public Market',
    'Quintuple Public Market',
    'Pritil Public Market',
    'Santa Ana Public Market',
    'Dagupan-Binondo Market',
  ],
  'Makati City': [
    'Guadalupe Public Market',
    'Poblacion Public Market',
    'Bangkal Public Market',
  ],
  'Pasig City': [
    'Pasig Palengke',
    'Kapasigan Public Market',
    'Pinagbuhatan Public Market',
  ],
  'Taguig City': [
    'Taguig Public Market',
    'Lower Bicutan Public Market',
    'Tipas Public Market',
  ],
  'Cebu City': [
    'Carbon Public Market',
    'Pasil Fish Port & Market',
    'Mambaling Public Market',
    'Taboan Public Market',
  ],
  'Iloilo City': [
    'La Paz Public Market',
    'Jaro Public Market',
    'Central Market (Super)',
    'Mandurriao Public Market',
  ],
  'Cagayan de Oro': [
    'Cogon Public Market',
    'Carmen Public Market',
    'Bulua Public Market',
    'Macabalan Fish Port',
  ],
  'Zamboanga City': [
    'Barasta Public Market',
    'Putik Public Market',
    'Veterans Public Market',
  ],
  'General Santos': [
    'Gensan Public Market',
    'Labangal Fish Port & Market',
    'Fatima Public Market',
  ],
  'Baguio City': [
    'Baguio City Public Market',
    'Hangar Market',
    'Hilltop Market',
  ],
  'Naga City': [
    'Naga City People\'s Mall',
    'Naga Central Market',
  ],
  'Legazpi City': [
    'Legazpi City Public Market',
    'Albay Public Market',
  ],
};
