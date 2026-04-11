import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { 
  Order, 
  OrderItem, 
  Product, 
  Category, 
  Profile, 
  Payment, 
  Inventory, 
  Promo, 
  SalesReport, 
  AdminLog 
} from '../types/database';

export const useAdminController = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [salesReports, setSalesReports] = useState<SalesReport[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // ── Individual fetch helpers (used by real-time callbacks) ─────────────────
  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) {
      setOrders(data || []);
      setLastUpdated(new Date());
    }
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setProducts(data || []);
  };

  const fetchInventory = async () => {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('updated_at', { ascending: false });
    if (!error) setInventory(data || []);
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setUsers(data || []);
  };

  const fetchPromos = async () => {
    const { data, error } = await supabase
      .from('redeemable_products')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setPromos(data || []);
  };

  useEffect(() => {
    fetchDashboardData();

    // ── Real-time: orders ────────────────────────────────────────────────────
    const ordersChannel = supabase
      .channel('admin-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    // ── Real-time: products ──────────────────────────────────────────────────
    const productsChannel = supabase
      .channel('admin-products-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchProducts();
      })
      .subscribe();

    // ── Real-time: inventory ─────────────────────────────────────────────────
    const inventoryChannel = supabase
      .channel('admin-inventory-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
        fetchInventory();
      })
      .subscribe();

    // ── Real-time: profiles (users) ──────────────────────────────────────────
    const usersChannel = supabase
      .channel('admin-users-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchUsers();
      })
      .subscribe();

    // ── Real-time: promos ────────────────────────────────────────────────────
    const promosChannel = supabase
      .channel('admin-promos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'redeemable_products' }, () => {
        fetchPromos();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(inventoryChannel);
      supabase.removeChannel(usersChannel);
      supabase.removeChannel(promosChannel);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [
        ordersRes,
        productsRes,
        categoriesRes,
        usersRes,
        paymentsRes,
        inventoryRes,
        promosRes,
        salesReportsRes,
        adminLogsRes
      ] = await Promise.all([
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        supabase.from('categories').select('*').order('sort_order', { ascending: true }),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('payments').select('*').order('created_at', { ascending: false }),
        supabase.from('inventory').select('*').order('updated_at', { ascending: false }),
        supabase.from('redeemable_products').select('*').order('created_at', { ascending: false }),
        supabase.from('sales_reports').select('*').order('report_date', { ascending: false }),
        supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(50)
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (productsRes.error) throw productsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (usersRes.error) throw usersRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (inventoryRes.error) throw inventoryRes.error;
      if (promosRes.error) throw promosRes.error;
      if (salesReportsRes.error) throw salesReportsRes.error;
      if (adminLogsRes.error) throw adminLogsRes.error;

      setOrders(ordersRes.data || []);
      setProducts(productsRes.data || []);
      setCategories(categoriesRes.data || []);
      setUsers(usersRes.data || []);
      setPayments(paymentsRes.data || []);
      setInventory(inventoryRes.data || []);
      setPromos(promosRes.data || []);
      setSalesReports(salesReportsRes.data || []);
      setAdminLogs(adminLogsRes.data || []);
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes('jwt')) {
        await supabase.auth.signOut();
        window.location.href = '/';
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;

      setOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, status, updated_at: new Date().toISOString() } : order
      ));

      await logAdminAction('update_order_status', 'order', orderId, { status });
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  const updateProductAvailability = async (productId: string, isAvailable: boolean) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_available: isAvailable, updated_at: new Date().toISOString() })
        .eq('id', productId);

      if (error) throw error;

      setProducts(prev => prev.map(product => 
        product.id === productId ? { ...product, is_available: isAvailable, updated_at: new Date().toISOString() } : product
      ));

      await logAdminAction('update_product_availability', 'product', productId, { is_available: isAvailable });
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  const updateInventory = async (productId: string, quantity: number) => {
    try {
      const { error } = await supabase
        .from('inventory')
        .update({ quantity, updated_at: new Date().toISOString() })
        .eq('product_id', productId);

      if (error) throw error;

      setInventory(prev => prev.map(item => 
        item.product_id === productId ? { ...item, quantity, updated_at: new Date().toISOString() } : item
      ));

      await logAdminAction('update_inventory', 'inventory', productId, { quantity });
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  const createPromo = async (promo: Omit<Promo, 'id' | 'created_at' | 'used_count'>) => {
    try {
      const { data, error } = await supabase
        .from('redeemable_products')
        .insert([{ ...promo, used_count: 0 }])
        .select()
        .single();

      if (error) throw error;

      setPromos(prev => [data, ...prev]);
      await logAdminAction('create_promo', 'promo', data.id, promo);
      return data;
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  const logAdminAction = async (action: string, entityType?: string, entityId?: string, details?: any) => {
    try {
      const { error } = await supabase
        .from('admin_logs')
        .insert([{
          action,
          entity_type: entityType,
          entity_id: entityId,
          details: details || {},
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to log admin action:', err);
    }
  };

  // Dashboard statistics
  const getStats = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = orders.filter(order => order.created_at.startsWith(today));
    const pendingOrders = orders.filter(order => order.status === 'pending');
    const preparingOrders = orders.filter(order => order.status === 'preparing');
    const completedOrders = orders.filter(order => order.status === 'completed');
    
    const todayRevenue = todayOrders.reduce((sum, order) => sum + order.total, 0);
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    
    const lowStockItems = inventory.filter(item => item.quantity <= item.low_stock_threshold);
    const activePromos = promos.filter(promo => promo.is_active);
    
    const walkinOrders = orders.filter(order => order.order_type === 'walkin');

    return {
      todayOrders: todayOrders.length,
      totalOrders: orders.length,
      pendingOrders: pendingOrders.length,
      preparingOrders: preparingOrders.length,
      completedOrders: completedOrders.length,
      todayRevenue,
      totalRevenue,
      lowStockItems: lowStockItems.length,
      activePromos: activePromos.length,
      walkinOrders: walkinOrders.length,
      totalProducts: products.length,
      availableProducts: products.filter(p => p.is_available).length,
      totalUsers: users.length,
      adminUsers: users.filter(u => u.role === 'admin').length,
      clientUsers: users.filter(u => u.role === 'client').length
    };
  };

  return {
    orders,
    products,
    categories,
    users,
    payments,
    inventory,
    promos,
    salesReports,
    adminLogs,
    loading,
    error,
    lastUpdated,
    stats: getStats(),
    refreshData: fetchDashboardData,
    updateOrderStatus,
    updateProductAvailability,
    updateInventory,
    createPromo,
    logAdminAction
  };
};

export const useOrderManagement = () => {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);

  const getOrderItems = async (orderId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrderItems(data || []);
      return data;
    } catch (err: any) {
      throw new Error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    orderItems,
    loading,
    getOrderItems
  };
};
