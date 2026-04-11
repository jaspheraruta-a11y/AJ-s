import { supabase } from '../supabase';
import { Category, Product, ProductSize, ProductAddon, Order, OrderItem } from '../types/database';

export const CategoryModel = {
  async getAll(): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });
    
    if (error) throw error;
    return data || [];
  }
};

export const ProductModel = {
  async getAll(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_available', true)
      .order('sort_order', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  async getByCategory(categoryId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('category_id', categoryId)
      .eq('is_available', true)
      .order('sort_order', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  async getSizes(productId: string): Promise<ProductSize[]> {
    const { data, error } = await supabase
      .from('product_sizes')
      .select('*')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  async getAddons(productId: string): Promise<ProductAddon[]> {
    const { data, error } = await supabase
      .from('product_addons')
      .select('*')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true });
    
    if (error) throw error;
    return data || [];
  }
};

export const OrderModel = {
  async create(order: Partial<Order>, items: Partial<OrderItem>[]): Promise<string> {
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([order])
      .select()
      .single();

    if (orderError) throw orderError;

    const orderItems = items.map(item => ({
      ...item,
      order_id: orderData.id
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) throw itemsError;

    return orderData.id;
  },

  async getByUserId(userId: string): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }
};
