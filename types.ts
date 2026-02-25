export interface Category {
  id: number;
  name: string;
}

export interface Branch {
  id: number;
  name: string;
  location: string;
}

export interface User {
  id: number;
  name: string;
  pin: string;
  role: 'admin' | 'branch_manager' | 'cashier';
  branch_id: number | null;
  branch_name?: string;
}

export interface Product {
  id: number;
  category_id: number;
  name: string;
  price: number;
  cost_price: number;
  unit: 'kg' | 'piece';
  barcode: string;
  image_url: string;
  stock_quantity: number;
  low_stock_threshold: number;
}

export interface Supplier {
  id: number;
  name: string;
  contact_info: string;
}

export interface WasteLog {
  id: number;
  branch_id: number;
  product_id: number;
  product_name?: string;
  branch_name?: string;
  quantity: number;
  reason: string;
  created_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  total: number;
}

export interface Order {
  id: number;
  branch_id: number;
  total_amount: number;
  tax_amount: number;
  discount_amount: number;
  payment_method: string;
  created_at: string;
  items: CartItem[];
  customer_id?: number; // Optional customer ID for loyalty tracking
}

export interface LoyaltyData {
  pointsEarned: number;
  newTotalPoints: number;
  suggestedReward: string | null;
  qrCodeLink: string;
}

export interface Customer {
  id: number;
  name: string; // Display name, e.g., "عميل مميز"
  total_points: number;
  tier: 'برونزي' | 'فضي' | 'ذهبي'; // Customer category/tier
}

export interface Reward {
  id: number;
  name: string; // e.g., "1 كجم تفاح"
  points_required: number;
  product_id?: number; // Optional: if reward is a specific product
  product_quantity?: number; // Quantity of product if applicable
  is_available: boolean;
}

export interface PointsTransaction {
  id: number;
  customer_id: number;
  order_id: number; // Link to the POS order
  points_added: number;
  points_redeemed: number;
  transaction_date: string;
}

export interface ValidationToken {
  token: string; // The encrypted QR code content
  customer_id: number;
  generated_at: string;
  expires_at: string;
  is_used: boolean;
}

export interface ReceiptSettings {
  id: number;
  store_name: string;
  branch_default_name: string;
  tax_number: string;
  invoice_type: string;
  thank_you_message: string;
  return_policy: string;
  qr_code_image_url: string | null;
}
