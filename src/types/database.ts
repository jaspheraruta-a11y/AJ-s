export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  sort_order: number;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  image_url?: string;
  is_available: boolean;
  stock_quantity: number;
  has_sizes: boolean;
  has_addons: boolean;
}

export interface ProductSize {
  id: string;
  product_id: string;
  name: string;
  price_modifier: number;
}

export interface ProductAddon {
  id: string;
  product_id: string;
  name: string;
  price: number;
}



export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  phone?: string;
  role: 'client' | 'admin' | 'staff';
  address?: string;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  user_id?: string;
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  order_type: 'walkin' | 'qr';
  subtotal: number;
  discount_amount: number;
  promo_code?: string;
  total: number;
  customer_notes?: string;
  table_number?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  size?: string;
  quantity: number;
  unit_price: number;
  addons?: any[];
  notes?: string;
  line_total: number;
}

export interface Payment {
  id: string;
  order_id: string;
  method: 'cash' | 'card' | 'gcash' | 'paymaya';
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  amount: number;
  reference_number?: string;
  paid_at?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface Inventory {
  product_id: string;
  quantity: number;
  low_stock_threshold: number;
  updated_at: string;
}

export interface Promo {
  id: string;
  product_name: string;
  description?: string;
  points_required: number;
  stock: number;
  max_per_user?: number;
  redeemed_count: number;
  valid_from?: string;
  valid_until?: string;
  is_active: boolean;
  image_url?: string;
  created_at: string;
}

export interface SalesReport {
  id: string;
  report_date: string;
  total_orders: number;
  total_revenue: number;
  walkin_count: number;
  created_at: string;
}

export interface AdminLog {
  id: string;
  user_id?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: any;
  created_at: string;
}

