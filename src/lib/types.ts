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
  is_approved: boolean;
  is_active: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  rider_age: number | null;
  rider_family_status: string | null;
  rider_residence_address: string | null;
  rider_valid_id_url: string | null;
  rider_plate_number: string | null;
  rider_motor_model: string | null;
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
  latitude: number | null;
  longitude: number | null;
  logo_url: string | null;
  banner_url: string | null;
  qr_code_url: string | null;
  payment_method: string;
  is_open: boolean;
  is_verified: boolean;
  rating: number;
  palengke_name: string | null;
  seller_type: string | null;
  farm_type: string | null;
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
  commission_amount: number;
  rider_lat: number | null;
  rider_lng: number | null;
  picked_up_at: string | null;
  delivery_group_id: string | null;
  cod_payment_reference: string | null;
  cod_payment_accepted_at: string | null;
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

export type MessageType = 'text' | 'video_call';
export type CallStatus = 'pending' | 'accepted' | 'declined' | 'ended';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
  message_type: MessageType;
  call_room_id: string | null;
  call_status: CallStatus | null;
}

export type AdminCallStatus = 'pending' | 'accepted' | 'declined' | 'ended';

export interface AdminCall {
  id: string;
  admin_id: string;
  target_user_id: string;
  room_id: string;
  status: AdminCallStatus;
  created_at: string;
  updated_at: string;
}

export interface AdminConversation {
  id: string;
  admin_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface AdminMessage {
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

export interface SellerFee {
  id: string;
  seller_id: string;
  commission_balance: number;
  total_sales: number;
  subscription_active: boolean;
  subscription_activated_at: string | null;
  subscription_balance: number;
  last_subscription_charge_at: string | null;
  total_payable: number;
  grace_deadline: string | null;
  frozen_at: string | null;
  created_at: string;
  updated_at: string;
}

export type FeePaymentStatus = 'pending' | 'approved' | 'rejected';

export interface FeePayment {
  id: string;
  seller_id: string;
  amount: number;
  reference_number: string;
  status: FeePaymentStatus;
  approved_by: string | null;
  approved_at: string | null;
  commission_paid: number;
  subscription_paid: number;
  created_at: string;
  updated_at: string;
}

export interface PlatformSetting {
  key: string;
  value: string;
  updated_by: string | null;
  updated_at: string;
}

export type ReviewType = 'seller' | 'rider';

export interface Review {
  id: string;
  order_id: string;
  reviewer_id: string;
  reviewee_id: string;
  review_type: ReviewType;
  rating: number;
  comment: string;
  created_at: string;
  updated_at: string;
  reviewer?: { full_name: string; avatar_url: string | null };
}

export const COMMISSION_RATE = 0.03;
export const SUBSCRIPTION_FEE = 499;
export const SUBSCRIPTION_THRESHOLD = 5000;
export const PAYMENT_THRESHOLD = 1000;

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
