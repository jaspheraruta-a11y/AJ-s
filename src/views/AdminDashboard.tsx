import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  Users, 
  ShoppingBag, 
  Package, 
  DollarSign, 
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Truck,
  Settings,
  LogOut,
  X,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  Plus,
  Search,
  Filter,
  Calendar,
  Download,
  ChevronRight,
  Coffee,
  Target,
  Zap,
  Tag,
  ImageIcon,
  Shield,
  ShieldOff,
  ShieldCheck,
  Lock,
  Timer,
  Banknote,
  Bell
} from 'lucide-react';
import { useStaffPermissions, useStatusChangeCooldown, TabId } from '../contexts/StaffPermissionsContext';

// ── PDF Export Helper ──────────────────────────────────────────────────────────
const exportOrdersToPDF = (orders: any[], users: any[]) => {
  const rows = orders.map(order => {
    const user = users.find((u: any) => u.id === order.user_id);
    const customer = user?.full_name || 'Walk-in Customer';
    return `
      <tr>
        <td>${order.order_number}</td>
        <td>${new Date(order.created_at).toLocaleDateString()}</td>
        <td>${customer}</td>
        <td>${order.order_type}</td>
        <td>&#8369;${order.total.toFixed(2)}</td>
        <td>${order.status}</td>
      </tr>`;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Orders Export</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; margin: 24px; color: #333; }
        h1 { font-size: 20px; margin-bottom: 4px; color: #7b6a6c; }
        p.sub { font-size: 11px; color: #888; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f5f0ef; color: #7b6a6c; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; }
        td { padding: 8px 12px; border-bottom: 1px solid #eee; }
        tr:hover td { background: #fafafa; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <h1>&#127829; Orders Report</h1>
      <p class="sub">Generated on ${new Date().toLocaleString()} &bull; ${orders.length} order(s)</p>
      <table>
        <thead>
          <tr>
            <th>Order #</th>
            <th>Date</th>
            <th>Customer</th>
            <th>Type</th>
            <th>Total</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
    </html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  }
};
import { useAdminController, useOrderManagement } from '../controllers/admin';
import { Order, Product, Profile } from '../types/database';

const InventoryUpdateCell = ({ item, onUpdate }: { item: any, onUpdate: (id: string, newQty: number) => void }) => {
  const [addQty, setAddQty] = useState('');

  const handleAdd = () => {
    const qty = parseInt(addQty);
    if (!isNaN(qty) && qty !== 0) {
      onUpdate(item.product_id, Math.max(0, item.quantity + qty));
      setAddQty('');
    }
  };

  return (
    <div className="flex gap-2 items-center">
      <input 
        type="number" 
        value={addQty}
        onChange={(e) => setAddQty(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        placeholder="Qty"
        className="w-20 px-2 py-1 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#7b6a6c]"
      />
      <button 
        onClick={handleAdd}
        disabled={!addQty || isNaN(parseInt(addQty)) || parseInt(addQty) === 0}
        className="px-3 py-1 bg-[#7b6a6c] text-white text-sm rounded-md hover:bg-[#6a5a5c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Add
      </button>
    </div>
  );
};

interface AdminDashboardProps {
  user: Profile;
  onLogout: () => void;
  mode?: 'admin' | 'staff';
}


const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout, mode = 'admin' }) => {
  const isStaff = mode === 'staff';
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [inventorySearchTerm, setInventorySearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState<string>('all');
  const [inventoryFilters, setInventoryFilters] = useState({ lowStock: false, optimal: false });

  // ── Modal states ────────────────────────────────────────────────────────────
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showCreatePromoModal, setShowCreatePromoModal] = useState(false);

  // Add Product form state
  const [newProduct, setNewProduct] = useState({
    name: '', description: '', price: '', category_id: '', image_url: '', is_available: true,
    stock_quantity: '', has_sizes: false,
    sizes: [
      { name: 'Small', price_modifier: '0' },
      { name: 'Medium', price_modifier: '' },
      { name: 'Large', price_modifier: '' },
    ] as { name: string; price_modifier: string }[]
  });
  const [addingProduct, setAddingProduct] = useState(false);

  // Create Promo form state
  const [newPromo, setNewPromo] = useState({
    product_name: '', description: '', points_required: '', stock: '', is_active: true, image_url: ''
  });
  const [addingPromo, setAddingPromo] = useState(false);

  // ── Staff permissions ───────────────────────────────────────────────────────
  const { isTabRestricted, toggleTabRestriction, restrictedTabs, permissionsLoading } = useStaffPermissions();

  // ── Status cooldown ─────────────────────────────────────────────────────────
  const { recordStatusChange, getRemainingCooldown, isOnCooldown } = useStatusChangeCooldown();
  const [cooldownCounters, setCooldownCounters] = useState<Record<string, number>>({});

  // ── Ready-order notifications ────────────────────────────────────────────────
  const [readyNotifications, setReadyNotifications] = useState<{ id: string; orderNumber: string; key: number }[]>([]);
  const prevOrderStatusesRef = useRef<Record<string, string>>({});
  const notifKeyRef = useRef(0);
  const dismissNotification = useCallback((key: number) => {
    setReadyNotifications(prev => prev.filter(n => n.key !== key));
  }, []);

  // Tick remaining cooldowns every second for UI update
  useEffect(() => {
    const interval = setInterval(() => {
      setCooldownCounters(prev => {
        const next: Record<string, number> = {};
        let changed = false;
        Object.keys(prev).forEach(id => {
          const rem = getRemainingCooldown(id);
          if (rem !== prev[id]) changed = true;
          if (rem > 0) next[id] = rem;
        });
        return changed ? next : prev;
      });
    }, 500);
    return () => clearInterval(interval);
  }, [getRemainingCooldown]);

  const { 
    orders, 
    products, 
    categories,
    users, 
    inventory, 
    promos, 
    adminLogs, 
    loading,
    error,
    lastUpdated,
    stats, 
    refreshData,
    updateOrderStatus,
    updateProductAvailability,
    updateInventory 
  } = useAdminController();

  const { orderItems, getOrderItems } = useOrderManagement();

  // Detect orders that just became "ready" and show toast notification
  useEffect(() => {
    const prev = prevOrderStatusesRef.current;
    const newNotifs: { id: string; orderNumber: string; key: number }[] = [];

    orders.forEach(order => {
      const wasReady = prev[order.id] === 'ready';
      const isNowReady = order.status === 'ready';
      if (!wasReady && isNowReady) {
        notifKeyRef.current += 1;
        newNotifs.push({ id: order.id, orderNumber: order.order_number, key: notifKeyRef.current });
      }
    });

    // Update snapshot
    const snapshot: Record<string, string> = {};
    orders.forEach(o => { snapshot[o.id] = o.status; });
    prevOrderStatusesRef.current = snapshot;

    if (newNotifs.length > 0) {
      setReadyNotifications(prev => [...prev, ...newNotifs]);
    }
  }, [orders]);

  // Auto-dismiss notifications after 8 s
  useEffect(() => {
    if (readyNotifications.length === 0) return;
    const latest = readyNotifications[readyNotifications.length - 1];
    const timer = setTimeout(() => dismissNotification(latest.key), 8000);
    return () => clearTimeout(timer);
  }, [readyNotifications, dismissNotification]);

  // ── Add Product handler ─────────────────────────────────────────────────────
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.price || !newProduct.category_id) return;
    setAddingProduct(true);
    try {
      const { supabase } = await import('../supabase');
      const { data: inserted, error } = await supabase.from('products').insert({
        name: newProduct.name,
        slug: newProduct.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        description: newProduct.description,
        price: parseFloat(newProduct.price),
        category_id: newProduct.category_id,
        image_url: newProduct.image_url || null,
        is_available: newProduct.is_available,
        stock_quantity: parseInt(newProduct.stock_quantity) || 0,
        has_sizes: newProduct.has_sizes,
        has_addons: false,
      }).select('id').single();
      if (error) throw error;

      // Insert size records if has_sizes is enabled
      if (newProduct.has_sizes && inserted?.id) {
        const sizeRows = newProduct.sizes
          .filter(s => s.name.trim())
          .map((s, idx) => ({
            product_id: inserted.id,
            name: s.name.trim(),
            price_modifier: parseFloat(s.price_modifier) || 0,
            sort_order: idx,
          }));
        if (sizeRows.length > 0) {
          const { error: sizeError } = await supabase.from('product_sizes').insert(sizeRows);
          if (sizeError) throw sizeError;
        }
      }

      // Also create the inventory record so the product shows up in inventory tab
      if (inserted?.id) {
        await supabase.from('inventory').insert({
          product_id: inserted.id,
          quantity: parseInt(newProduct.stock_quantity) || 0,
          low_stock_threshold: 10,
        });
      }

      setShowAddProductModal(false);
      setNewProduct({
        name: '', description: '', price: '', category_id: '', image_url: '', is_available: true,
        stock_quantity: '', has_sizes: false,
        sizes: [
          { name: 'Small', price_modifier: '0' },
          { name: 'Medium', price_modifier: '' },
          { name: 'Large', price_modifier: '' },
        ]
      });
      refreshData();
    } catch (err: any) {
      alert(`Failed to add product: ${err.message}`);
    } finally {
      setAddingProduct(false);
    }
  };

  // ── Create Promo handler ────────────────────────────────────────────────────
  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromo.product_name || !newPromo.points_required || !newPromo.stock) return;
    setAddingPromo(true);
    try {
      const { supabase } = await import('../supabase');
      const { error } = await supabase.from('promos').insert({
        product_name: newPromo.product_name,
        description: newPromo.description,
        points_required: parseInt(newPromo.points_required),
        stock: parseInt(newPromo.stock),
        is_active: newPromo.is_active,
        image_url: newPromo.image_url || null,
        redeemed_count: 0,
      });
      if (error) throw error;
      setShowCreatePromoModal(false);
      setNewPromo({ product_name: '', description: '', points_required: '', stock: '', is_active: true, image_url: '' });
      refreshData();
    } catch (err: any) {
      alert(`Failed to create promo: ${err.message}`);
    } finally {
      setAddingPromo(false);
    }
  };

  const handleOrderClick = async (order: Order) => {
    setSelectedOrder(order);
    await getOrderItems(order.id);
  };

  const [updatingStatuses, setUpdatingStatuses] = useState<Record<string, boolean>>({});

  // ── Counter Pay Modal state ──────────────────────────────────────────────
  const [payModal, setPayModal] = useState<{ order: Order } | null>(null);
  const [amountPaid, setAmountPaid] = useState('');
  const [processingPay, setProcessingPay] = useState(false);

  const handleStatusUpdate = async (orderId: string, newStatus: Order['status']) => {
    // Staff: enforce 5-second cooldown
    if (isStaff && isOnCooldown(orderId)) {
      const rem = getRemainingCooldown(orderId);
      alert(`⏱️ Please wait ${rem} more second${rem !== 1 ? 's' : ''} before changing this order's status again.`);
      return;
    }
    setUpdatingStatuses(prev => ({ ...prev, [orderId]: true }));
    try {
      await updateOrderStatus(orderId, newStatus);
      // Record the change timestamp so cooldowns are enforced
      recordStatusChange(orderId);
      if (isStaff) {
        setCooldownCounters(prev => ({ ...prev, [orderId]: 5 }));
      }
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    } finally {
      setUpdatingStatuses(prev => ({ ...prev, [orderId]: false }));
    }
  };

  // ── Counter Pay Handler ─────────────────────────────────────────────────
  const handleCounterPay = async () => {
    if (!payModal) return;
    const paid = parseFloat(amountPaid);
    if (isNaN(paid) || paid < payModal.order.total) return;

    setProcessingPay(true);
    try {
      // 1. Change order status → preparing
      await updateOrderStatus(payModal.order.id, 'preparing');

      // 2. Mark payment record as paid with the paid_at timestamp
      // Note: 'counter' is stored as 'cash' in the DB (enum: cash|card|gcash|paymaya)
      const { supabase } = await import('../supabase');
      await supabase
        .from('payments')
        .update({ status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('order_id', payModal.order.id)
        .eq('method', 'cash');

      setPayModal(null);
      setAmountPaid('');
    } catch (err: any) {
      alert(`Failed to process payment: ${err.message}`);
    } finally {
      setProcessingPay(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      preparing: 'bg-blue-100 text-blue-800',
      ready: 'bg-purple-100 text-purple-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      pending: <Clock className="w-4 h-4" />,
      preparing: <RefreshCw className="w-4 h-4" />,
      ready: <CheckCircle className="w-4 h-4" />,
      completed: <CheckCircle className="w-4 h-4" />,
      cancelled: <X className="w-4 h-4" />
    };
    return icons[status as keyof typeof icons] || <Clock className="w-4 h-4" />;
  };

  const filteredOrders = orders.filter(order => {
    const user = users.find(u => u.id === order.user_id);
    const clientName = user?.full_name || 'Walk-in Customer';
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (order.order_number || '').toLowerCase().includes(searchLower) || 
                          clientName.toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredProducts = products.filter(product => {
    return productCategoryFilter === 'all' || product.category_id === productCategoryFilter;
  });

  const filteredInventory = inventory.filter(item => {
    const product = products.find(p => p.id === item.product_id);
    if (!product) return false;
    
    const matchesCategory = inventoryCategoryFilter === 'all' || product.category_id === inventoryCategoryFilter;
    const matchesSearch = inventorySearchTerm === '' || product.name.toLowerCase().includes(inventorySearchTerm.toLowerCase());
    
    const isLowStock = item.quantity <= item.low_stock_threshold;
    const isOptimal = !isLowStock;
    
    let matchesStatus = true;
    if (inventoryFilters.lowStock || inventoryFilters.optimal) {
      matchesStatus = (inventoryFilters.lowStock && isLowStock) || (inventoryFilters.optimal && isOptimal);
    }
    
    return matchesCategory && matchesSearch && matchesStatus;
  });

  const StatCard = ({ title, value, icon: Icon, trend, color = 'blue' }: any) => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-2xl p-6 border border-stone-100 hover:shadow-lg transition-all`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 bg-${color}-50 rounded-xl flex items-center justify-center text-${color}-600`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-sm ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            <TrendingUp className={`w-4 h-4 ${trend < 0 ? 'rotate-180' : ''}`} />
            <span className="font-medium">{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-stone-800">{value}</p>
        <p className="text-sm text-stone-500 mt-1">{title}</p>
      </div>
    </motion.div>
  );

  const overviewTab = (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Today's Orders" 
          value={stats.todayOrders} 
          icon={ShoppingBag} 
          color="blue"
          trend={12}
        />
        <StatCard 
          title="Today's Revenue" 
          value={`₱${stats.todayRevenue.toFixed(2)}`} 
          icon={DollarSign} 
          color="green"
          trend={8}
        />
        <StatCard 
          title="Pending Orders" 
          value={stats.pendingOrders} 
          icon={Clock} 
          color="yellow"
        />
        <div className="relative">
          <StatCard 
            title="Low Stock Items" 
            value={stats.lowStockItems} 
            icon={AlertCircle} 
            color="red"
          />
          {stats.lowStockItems > 0 && (
            <span className="absolute top-3 right-3 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
          )}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
        <div className="p-6 border-b border-stone-100">
          <h3 className="text-lg font-bold text-stone-800">Recent Orders</h3>
        </div>
        <div className="divide-y divide-stone-100">
          {orders.slice(0, 5).map((order) => (
            <div key={order.id} className="p-4 hover:bg-stone-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center">
                    <Coffee className="w-5 h-5 text-stone-400" />
                  </div>
                  <div>
                    <p className="font-medium text-stone-800">{order.order_number}</p>
                    <p className="text-xs text-stone-400">
                      {new Date(order.created_at).toLocaleDateString()} • {new Date(order.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-stone-800">₱{order.total.toFixed(2)}</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(order.status)}`}>
                    {getStatusIcon(order.status)}
                    {order.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button className="p-6 bg-white rounded-2xl border border-stone-100 hover:shadow-lg transition-all text-left">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-4">
            <Package className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-stone-800 mb-2">Manage Products</h4>
          <p className="text-sm text-stone-500">Update product availability and pricing</p>
        </button>
        
        <button className="p-6 bg-white rounded-2xl border border-stone-100 hover:shadow-lg transition-all text-left">
          <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-600 mb-4">
            <Target className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-stone-800 mb-2">Create Promo</h4>
          <p className="text-sm text-stone-500">Set up discounts and special offers</p>
        </button>
        
        <button className="p-6 bg-white rounded-2xl border border-stone-100 hover:shadow-lg transition-all text-left">
          <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 mb-4">
            <BarChart3 className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-stone-800 mb-2">View Reports</h4>
          <p className="text-sm text-stone-500">Analyze sales and performance metrics</p>
        </button>
      </div>
    </div>
  );

  const ordersTab = (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-2xl border border-stone-100 p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-stone-400" />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7b6a6c]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7b6a6c]"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="preparing">Preparing</option>
            <option value="ready">Ready</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-stone-800">Orders ({filteredOrders.length})</h3>
          <button
            onClick={() => exportOrdersToPDF(filteredOrders, users)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 rounded-xl transition-colors border border-stone-200"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-stone-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-stone-800">{order.order_number}</p>
                      <p className="text-xs text-stone-400">{new Date(order.created_at).toLocaleDateString()}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-stone-200 rounded-full flex items-center justify-center text-stone-500 font-bold overflow-hidden">
                        {users.find(u => u.id === order.user_id)?.avatar_url ? (
                          <img src={users.find(u => u.id === order.user_id)?.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          users.find(u => u.id === order.user_id)?.full_name?.charAt(0) || 'C'
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-stone-800">{users.find(u => u.id === order.user_id)?.full_name || 'Walk-in Customer'}</p>
                        <p className="text-xs text-stone-400">ID: {order.user_id?.slice(0, 8) || 'N/A'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                      order.order_type === 'walkin' ? 'bg-green-50 text-green-600' :
                      'bg-purple-50 text-purple-600'
                    }`}>
                      {order.order_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm font-bold text-stone-800">
                    ₱{order.total.toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${getStatusColor(order.status)}`}>
                      {getStatusIcon(order.status)}
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleOrderClick(order)}
                        className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4 text-stone-600" />
                      </button>
                      {/* Counter Pay button — only for pending orders */}
                      {order.status === 'pending' && (
                        <button
                          onClick={() => { setPayModal({ order }); setAmountPaid(''); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm shadow-green-200"
                          title="Collect counter payment"
                        >
                          <Banknote className="w-3.5 h-3.5" />
                          Pay
                        </button>
                      )}
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusUpdate(order.id, e.target.value as Order['status'])}
                        disabled={updatingStatuses[order.id] || (isStaff && isOnCooldown(order.id))}
                        className={`px-2 py-1 text-xs border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7b6a6c] ${
                          (updatingStatuses[order.id] || (isStaff && isOnCooldown(order.id))) ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="preparing">Preparing</option>
                        <option value="ready">Ready</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      {isStaff && isOnCooldown(order.id) && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-1 rounded-lg whitespace-nowrap">
                          <Timer className="w-3 h-3" />
                          {getRemainingCooldown(order.id)}s
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const productsTab = (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-stone-100 p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-stone-400" />
            <select
              value={productCategoryFilter}
              onChange={(e) => setProductCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7b6a6c]"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-stone-800">Products ({filteredProducts.length})</h3>
          <button
            onClick={() => setShowAddProductModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#7b6a6c] text-white rounded-xl hover:bg-[#6a5a5c] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredProducts.map((product) => {
                const inventoryItem = inventory.find(item => item.product_id === product.id);
                const isLowStock = inventoryItem && inventoryItem.quantity <= inventoryItem.low_stock_threshold;
                
                return (
                  <tr key={product.id} className="hover:bg-stone-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-stone-200 rounded-lg overflow-hidden">
                          <img 
                            src={product.image_url || `https://picsum.photos/seed/${product.slug}/40/40`} 
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="font-medium text-stone-800">{product.name}</p>
                          <p className="text-xs text-stone-400">{product.description?.slice(0, 50)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-600">
                      {categories.find(c => c.id === product.category_id)?.name || 'Uncategorized'}
                    </td>
                    <td className="px-6 py-4 font-mono text-sm font-bold text-stone-800">
                      ₱{product.price.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${isLowStock ? 'text-red-600' : 'text-stone-800'}`}>
                          {inventoryItem?.quantity || 0}
                        </span>
                        {isLowStock && (
                          <span className="flex items-center gap-1">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => updateProductAvailability(product.id, !product.is_available)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          product.is_available 
                            ? 'bg-green-50 text-green-600 hover:bg-green-100' 
                            : 'bg-red-50 text-red-600 hover:bg-red-100'
                        }`}
                      >
                        {product.is_available ? 'Available' : 'Unavailable'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button className="p-2 hover:bg-stone-100 rounded-lg transition-colors">
                          <Edit className="w-4 h-4 text-stone-600" />
                        </button>
                        <button className="p-2 hover:bg-stone-100 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const usersTab = (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-stone-800">Users ({users.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-stone-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-stone-200 rounded-full flex items-center justify-center text-stone-500 font-bold overflow-hidden">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          u.full_name?.charAt(0) || u.email?.substring(0, 1).toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-stone-800">{u.full_name || 'No Name'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-stone-600">
                    {u.email}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                      u.role === 'admin' ? 'bg-purple-50 text-purple-600' :
                      'bg-blue-50 text-blue-600'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-stone-600">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const inventoryTab = (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-stone-100 p-6">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-stone-400" />
            <input
              type="text"
              placeholder="Search inventory..."
              value={inventorySearchTerm}
              onChange={(e) => setInventorySearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7b6a6c]"
            />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={inventoryFilters.lowStock}
                onChange={(e) => setInventoryFilters(prev => ({ lowStock: e.target.checked, optimal: e.target.checked ? false : prev.optimal }))}
                className="w-4 h-4 rounded border-stone-300 text-[#7b6a6c] focus:ring-[#7b6a6c]"
              />
              <span className="text-sm font-medium text-stone-700">Low Stock</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={inventoryFilters.optimal}
                onChange={(e) => setInventoryFilters(prev => ({ optimal: e.target.checked, lowStock: e.target.checked ? false : prev.lowStock }))}
                className="w-4 h-4 rounded border-stone-300 text-[#7b6a6c] focus:ring-[#7b6a6c]"
              />
              <span className="text-sm font-medium text-stone-700">Optimal</span>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-stone-400" />
            <select
              value={inventoryCategoryFilter}
              onChange={(e) => setInventoryCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7b6a6c]"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-stone-800">Inventory ({filteredInventory.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Threshold</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredInventory.map((item) => {
                const product = products.find(p => p.id === item.product_id);
                const isLowStock = item.quantity <= item.low_stock_threshold;
                return (
                  <tr key={item.product_id} className="hover:bg-stone-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-stone-800">{product?.name || 'Unknown Product'}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-800 font-bold">
                      {item.quantity}
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-600">
                      {item.low_stock_threshold}
                    </td>
                    <td className="px-6 py-4">
                      {isLowStock ? (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 px-2.5 py-1.5 rounded-lg w-fit border border-red-200">
                          <span className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                          </span>
                          <AlertCircle className="w-3 h-3" /> Low Stock
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-lg w-fit">
                          <CheckCircle className="w-3 h-3" /> Optimal
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <InventoryUpdateCell item={item} onUpdate={updateInventory} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const promosTab = (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-stone-800">Promos</h3>
          <button
            onClick={() => setShowCreatePromoModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#7b6a6c] text-white rounded-xl hover:bg-[#6a5a5c] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Promo
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Discount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Usage</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {promos.map((promo) => (
                <tr key={promo.id} className="hover:bg-stone-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-stone-800">{promo.product_name}</p>
                    <p className="text-xs text-stone-400">{promo.description}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-2.5 py-1 text-sm font-bold">
                        ⭐ {promo.points_required} pts
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 mt-1">needed to redeem</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-bold ${promo.stock === 0 ? 'text-red-600' : promo.stock <= 5 ? 'text-orange-500' : 'text-green-600'}`}>
                          {promo.stock}
                        </span>
                        <span className="text-xs text-stone-500">stocks left</span>
                        {promo.stock === 0 && (
                          <span className="ml-1 text-xs font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Out</span>
                        )}
                        {promo.stock > 0 && promo.stock <= 5 && (
                          <span className="ml-1 text-xs font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">Low</span>
                        )}
                      </div>
                      <p className="text-xs text-stone-400">{promo.redeemed_count} redeemed</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                      promo.is_active ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                    }`}>
                      {promo.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ── Rollback Permissions Tab (admin-only) ─────────────────────────────────────────
  const MANAGEABLE_TABS: { id: TabId; label: string; icon: any; description: string }[] = [
    { id: 'overview',   label: 'Overview',   icon: BarChart3,   description: 'Dashboard overview, stats & quick actions' },
    { id: 'orders',     label: 'Orders',     icon: ShoppingBag, description: 'View & manage customer orders, update statuses' },
    { id: 'products',   label: 'Products',   icon: Package,     description: 'Add, edit, and toggle product availability' },
    { id: 'users',      label: 'Users',      icon: Users,       description: 'View registered users and their roles' },
    { id: 'inventory',  label: 'Inventory',  icon: Target,      description: 'Track stock levels and update inventory' },
    { id: 'promos',     label: 'Promos',     icon: Zap,         description: 'Create and manage loyalty point promos' },
  ];

  const rollbackPermissionsTab = (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-gradient-to-r from-[#7b6a6c] to-[#9a8688] rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Rollback Permissions</h2>
            <p className="text-white/80 text-sm mt-0.5">Control which dashboard tabs staff members can access. Restricted tabs will show a blocked message to staff.</p>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Time Interval Policy</p>
          <p className="text-xs text-amber-700 mt-0.5">After any user (admin or staff) changes an order status, staff members must wait <strong>5 seconds</strong> before changing that same order's status again. Admins have no cooldown restriction.</p>
        </div>
      </div>

      {/* Permission cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MANAGEABLE_TABS.map(tab => {
          const restricted = restrictedTabs.has(tab.id);
          return (
            <motion.div
              key={tab.id}
              layout
              className={`bg-white rounded-2xl border-2 p-5 transition-all ${
                restricted ? 'border-red-200 bg-red-50/40' : 'border-stone-100 hover:border-stone-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                    restricted ? 'bg-red-100 text-red-500' : 'bg-stone-100 text-stone-500'
                  }`}>
                    <tab.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={`font-bold ${ restricted ? 'text-red-700' : 'text-stone-800'}`}>{tab.label}</p>
                    <p className="text-xs text-stone-500 max-w-[200px]">{tab.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleTabRestriction(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                    restricted
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {restricted ? (
                    <><ShieldOff className="w-4 h-4" />Restricted</>
                  ) : (
                    <><ShieldCheck className="w-4 h-4" />Allow</>
                  )}
                </button>
              </div>
              {restricted && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 pt-3 border-t border-red-200 flex items-center gap-2"
                >
                  <Lock className="w-3 h-3 text-red-500 shrink-0" />
                  <p className="text-xs text-red-600 font-medium">Staff will see a "Restricted by Admin" message on this tab</p>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'inventory', label: 'Inventory', icon: Target },
    { id: 'promos', label: 'Promos', icon: Zap },
    ...(!isStaff ? [{ id: 'permissions', label: 'Rollback Permissions', icon: Shield }] : []),
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-stone-200 border-t-[#7b6a6c] rounded-full animate-spin" />
          <p className="font-serif italic text-stone-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <h2 className="text-xl font-bold text-stone-800">Connection Error</h2>
          <p className="text-stone-500">{error}</p>
          <button 
            onClick={refreshData}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-stone-200 hover:bg-stone-300 rounded-xl transition-colors font-medium text-stone-700"
          >
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">

      {/* ── Ready Order Toast Notifications ──────────────────────────────────── */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {readyNotifications.map(notif => (
            <motion.div
              key={notif.key}
              initial={{ opacity: 0, x: 80, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="pointer-events-auto flex items-start gap-3 bg-white border-l-4 border-green-500 rounded-2xl shadow-2xl shadow-green-100 p-4 pr-5 w-80 max-w-[calc(100vw-2.5rem)]"
            >
              {/* Animated bell icon */}
              <motion.div
                animate={{ rotate: [-15, 15, -10, 10, -5, 5, 0] }}
                transition={{ duration: 0.7, repeat: Infinity, repeatDelay: 2 }}
                className="w-10 h-10 bg-green-50 border border-green-200 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
              >
                <Bell className="w-5 h-5 text-green-600" />
              </motion.div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-stone-800">Order Ready! 🎉</p>
                <p className="text-xs text-stone-500 mt-0.5 truncate">
                  <span className="font-mono font-semibold text-green-700">{notif.orderNumber}</span>
                  {' '}is ready for pickup
                </p>
                {/* Progress bar */}
                <motion.div
                  className="mt-2 h-1 bg-green-100 rounded-full overflow-hidden"
                >
                  <motion.div
                    className="h-full bg-green-500 rounded-full"
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: 8, ease: 'linear' }}
                  />
                </motion.div>
              </div>
              <button
                onClick={() => dismissNotification(notif.key)}
                className="p-1 hover:bg-stone-100 rounded-lg transition-colors text-stone-400 hover:text-stone-600 flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-50">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-[#7b6a6c] rounded-lg flex items-center justify-center">
              <span className="text-white text-[10px]">🍴</span>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-[#7b6a6c]">
                  {isStaff ? 'Staff Dashboard' : 'Admin Dashboard'}
                </h1>
                {/* Role badge */}
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  isStaff
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-purple-50 text-purple-700 border-purple-200'
                }`}>
                  {isStaff ? 'Staff' : 'Admin'}
                </span>
                {/* Live indicator */}
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Live</span>
                </span>
              </div>
              <p className="text-sm text-stone-500">
                Welcome back, {user.full_name || (isStaff ? 'Staff' : 'Admin')}
                {lastUpdated && (
                  <span className="ml-2 text-xs text-stone-400">
                    · Last updated {lastUpdated.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={refreshData}
              className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
              title="Refresh data"
            >
              <RefreshCw className="w-5 h-5 text-stone-600" />
            </button>
            <button className="p-2 hover:bg-stone-100 rounded-lg transition-colors">
              <Settings className="w-5 h-5 text-stone-600" />
            </button>
            <button 
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-stone-200">
        <div className="px-6">
          <nav className="flex gap-8 overflow-x-auto">
            {tabs.map((tab) => {
              const restricted = isStaff && isTabRestricted(tab.id as TabId);
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-4 border-b-2 transition-colors shrink-0 ${
                    activeTab === tab.id
                      ? 'border-[#7b6a6c] text-[#7b6a6c]'
                      : 'border-transparent text-stone-500 hover:text-stone-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="font-medium">{tab.label}</span>
                  {restricted && (
                    <Lock className="w-3 h-3 text-red-500" />
                  )}
                  {tab.id === 'permissions' && (
                    <span className="ml-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-full">Admin</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Restriction guard for staff */}
            {isStaff && permissionsLoading ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
                <div className="w-12 h-12 border-4 border-stone-200 border-t-[#7b6a6c] rounded-full animate-spin" />
                <p className="text-stone-500 text-sm">Checking permissions...</p>
              </div>
            ) : isStaff && isTabRestricted(activeTab as TabId) ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-24 h-24 bg-red-50 rounded-3xl flex items-center justify-center border-2 border-red-100"
                >
                  <Lock className="w-10 h-10 text-red-400" />
                </motion.div>
                <div>
                  <h2 className="text-2xl font-bold text-stone-800 mb-2">Tab Restricted</h2>
                  <p className="text-stone-500 max-w-sm">
                    Access to this tab has been restricted by the admin. Please contact your administrator if you need access.
                  </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl">
                  <Shield className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-semibold text-red-700">Restricted by Admin</span>
                </div>
              </div>
            ) : (
              <>
                {activeTab === 'overview' && overviewTab}
                {activeTab === 'orders' && ordersTab}
                {activeTab === 'products' && productsTab}
                {activeTab === 'users' && usersTab}
                {activeTab === 'inventory' && inventoryTab}
                {activeTab === 'promos' && promosTab}
                {activeTab === 'permissions' && !isStaff && rollbackPermissionsTab}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Counter Pay Modal ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {payModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => { setPayModal(null); setAmountPaid(''); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-green-50 rounded-xl flex items-center justify-center">
                    <Banknote className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-stone-800">Counter Payment</h3>
                    <p className="text-xs text-stone-500 font-medium">{payModal.order.order_number}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setPayModal(null); setAmountPaid(''); }}
                  className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-stone-600" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Order Total */}
                <div className="bg-stone-50 rounded-xl p-4 flex items-center justify-between border border-stone-100">
                  <span className="text-sm font-semibold text-stone-500">Order Total</span>
                  <span className="font-mono text-2xl font-bold text-stone-800">₱{payModal.order.total.toFixed(2)}</span>
                </div>

                {/* Amount Paid Input */}
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-2">Amount Paid by Customer</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-lg select-none">₱</span>
                    <input
                      type="number"
                      min={payModal.order.total}
                      step="0.01"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      placeholder={`Min. ₱${payModal.order.total.toFixed(2)}`}
                      className="w-full pl-9 pr-4 py-3.5 text-xl font-mono font-bold border-2 border-stone-200 rounded-xl focus:outline-none focus:border-green-500 transition-colors"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Change Calculation */}
                <AnimatePresence>
                  {amountPaid !== '' && !isNaN(parseFloat(amountPaid)) && (
                    <motion.div
                      key="change-display"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className={`rounded-xl p-4 flex items-center justify-between border ${
                        parseFloat(amountPaid) >= payModal.order.total
                          ? 'bg-green-50 border-green-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {parseFloat(amountPaid) >= payModal.order.total ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        )}
                        <span className={`text-sm font-bold ${
                          parseFloat(amountPaid) >= payModal.order.total ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {parseFloat(amountPaid) >= payModal.order.total ? 'Change Due' : 'Insufficient Amount'}
                        </span>
                      </div>
                      <span className={`font-mono text-2xl font-bold ${
                        parseFloat(amountPaid) >= payModal.order.total ? 'text-green-700' : 'text-red-600'
                      }`}>
                        {parseFloat(amountPaid) >= payModal.order.total
                          ? `₱${(parseFloat(amountPaid) - payModal.order.total).toFixed(2)}`
                          : `-₱${(payModal.order.total - parseFloat(amountPaid)).toFixed(2)}`}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Actions */}
              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => { setPayModal(null); setAmountPaid(''); }}
                  className="flex-1 py-3 border-2 border-stone-200 text-stone-600 rounded-xl font-semibold hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCounterPay}
                  disabled={
                    processingPay ||
                    !amountPaid ||
                    isNaN(parseFloat(amountPaid)) ||
                    parseFloat(amountPaid) < payModal.order.total
                  }
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-stone-300 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-200"
                >
                  {processingPay ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Processing…</>
                  ) : (
                    <><Banknote className="w-4 h-4" /> Confirm Payment</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => setSelectedOrder(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-stone-800">Order Details</h3>
                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-stone-600" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-stone-500">Order Number</p>
                    <p className="font-medium text-stone-800">{selectedOrder.order_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-stone-500">Status</p>
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedOrder.status)}`}>
                      {getStatusIcon(selectedOrder.status)}
                      {selectedOrder.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-stone-500">Order Type</p>
                    <p className="font-medium text-stone-800 capitalize">{selectedOrder.order_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-stone-500">Total Amount</p>
                    <p className="font-mono font-bold text-stone-800">₱{selectedOrder.total.toFixed(2)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-stone-500 mb-3">Order Items</p>
                  <div className="space-y-2">
                    {orderItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                        <div>
                          <p className="font-medium text-stone-800">{item.product_name}</p>
                          <p className="text-xs text-stone-500">Qty: {item.quantity} • ₱{item.unit_price.toFixed(2)} each</p>
                        </div>
                        <p className="font-mono font-bold text-stone-800">₱{item.line_total.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add Product Modal ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddProductModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => setShowAddProductModal(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#f5f0ef] rounded-xl flex items-center justify-center">
                    <Package className="w-5 h-5 text-[#7b6a6c]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-stone-800">Add New Product</h3>
                    <p className="text-xs text-stone-500">Fill in the product details below</p>
                  </div>
                </div>
                <button onClick={() => setShowAddProductModal(false)} className="p-2 hover:bg-stone-100 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-stone-600" />
                </button>
              </div>

              <form onSubmit={handleAddProduct} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-1">Product Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={newProduct.name}
                      onChange={(e) => setNewProduct(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Caramel Macchiato"
                      className="w-full px-3 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7b6a6c] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Base Price (₱) <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={newProduct.price}
                      onChange={(e) => setNewProduct(p => ({ ...p, price: e.target.value }))}
                      placeholder="0.00"
                      className="w-full px-3 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7b6a6c] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Initial Stock <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={newProduct.stock_quantity}
                      onChange={(e) => setNewProduct(p => ({ ...p, stock_quantity: e.target.value }))}
                      placeholder="e.g. 50"
                      className="w-full px-3 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7b6a6c] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Category <span className="text-red-500">*</span></label>
                    <select
                      required
                      value={newProduct.category_id}
                      onChange={(e) => setNewProduct(p => ({ ...p, category_id: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7b6a6c] text-sm"
                    >
                      <option value="">Select category...</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Has Sizes toggle */}
                  <div className="col-span-2">
                    <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200">
                      <div>
                        <p className="text-sm font-medium text-stone-700">Has Sizes</p>
                        <p className="text-xs text-stone-500">Enable size variants (e.g. Small / Medium / Large)</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newProduct.has_sizes}
                          onChange={(e) => setNewProduct(p => ({ ...p, has_sizes: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#7b6a6c]"></div>
                      </label>
                    </div>
                  </div>

                  {/* Size rows – shown when has_sizes is enabled */}
                  {newProduct.has_sizes && (
                    <div className="col-span-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-stone-700">Size Options & Additional Price</p>
                        <button
                          type="button"
                          onClick={() => setNewProduct(p => ({ ...p, sizes: [...p.sizes, { name: '', price_modifier: '' }] }))}
                          className="flex items-center gap-1 text-xs text-[#7b6a6c] hover:text-[#6a5a5c] font-medium"
                        >
                          <Plus className="w-3 h-3" /> Add Size
                        </button>
                      </div>
                      <div className="bg-stone-50 rounded-xl border border-stone-200 p-3 space-y-2">
                        {newProduct.sizes.map((size, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={size.name}
                              onChange={(e) => setNewProduct(p => {
                                const sizes = [...p.sizes];
                                sizes[idx] = { ...sizes[idx], name: e.target.value };
                                return { ...p, sizes };
                              })}
                              placeholder={`Size name (e.g. ${idx === 0 ? 'Small' : idx === 1 ? 'Medium' : 'Large'})`}
                              className="flex-1 px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7b6a6c] text-sm"
                            />
                            <div className="relative w-32 shrink-0">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">+₱</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={size.price_modifier}
                                onChange={(e) => setNewProduct(p => {
                                  const sizes = [...p.sizes];
                                  sizes[idx] = { ...sizes[idx], price_modifier: e.target.value };
                                  return { ...p, sizes };
                                })}
                                placeholder="0.00"
                                className="w-full pl-8 pr-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7b6a6c] text-sm"
                              />
                            </div>
                            {newProduct.sizes.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setNewProduct(p => ({ ...p, sizes: p.sizes.filter((_, i) => i !== idx) }))}
                                className="p-1 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <X className="w-4 h-4 text-red-400" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-stone-400">The base price above applies to the first / smallest size. Additional price is added on top for bigger sizes.</p>
                    </div>
                  )}

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
                    <textarea
                      value={newProduct.description}
                      onChange={(e) => setNewProduct(p => ({ ...p, description: e.target.value }))}
                      placeholder="Brief product description..."
                      rows={2}
                      className="w-full px-3 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7b6a6c] text-sm resize-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-1">Image URL</label>
                    <div className="flex gap-2">
                      <ImageIcon className="w-4 h-4 text-stone-400 mt-3 shrink-0" />
                      <input
                        type="url"
                        value={newProduct.image_url}
                        onChange={(e) => setNewProduct(p => ({ ...p, image_url: e.target.value }))}
                        placeholder="https://..."
                        className="flex-1 px-3 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7b6a6c] text-sm"
                      />
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newProduct.is_available}
                        onChange={(e) => setNewProduct(p => ({ ...p, is_available: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#7b6a6c]"></div>
                    </label>
                    <span className="text-sm font-medium text-stone-700">Available for ordering</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddProductModal(false)}
                    className="flex-1 px-4 py-2.5 border border-stone-200 text-stone-700 rounded-xl hover:bg-stone-50 transition-colors text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addingProduct}
                    className="flex-1 px-4 py-2.5 bg-[#7b6a6c] text-white rounded-xl hover:bg-[#6a5a5c] transition-colors text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {addingProduct ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> Adding...</>
                    ) : (
                      <><Plus className="w-4 h-4" /> Add Product</>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Create Promo Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCreatePromoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => setShowCreatePromoModal(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                    <Tag className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-stone-800">Create Promo</h3>
                    <p className="text-xs text-stone-500">Set up a new redeemable promo using points</p>
                  </div>
                </div>
                <button onClick={() => setShowCreatePromoModal(false)} className="p-2 hover:bg-stone-100 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-stone-600" />
                </button>
              </div>

              <form onSubmit={handleCreatePromo} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-1">Product Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={newPromo.product_name}
                      onChange={(e) => setNewPromo(p => ({ ...p, product_name: e.target.value }))}
                      placeholder="e.g. Free Iced Latte"
                      className="w-full px-3 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Points Required ⭐ <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={newPromo.points_required}
                      onChange={(e) => setNewPromo(p => ({ ...p, points_required: e.target.value }))}
                      placeholder="e.g. 100"
                      className="w-full px-3 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Stock / Quantity <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={newPromo.stock}
                      onChange={(e) => setNewPromo(p => ({ ...p, stock: e.target.value }))}
                      placeholder="e.g. 50"
                      className="w-full px-3 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
                    <textarea
                      value={newPromo.description}
                      onChange={(e) => setNewPromo(p => ({ ...p, description: e.target.value }))}
                      placeholder="Brief promo description..."
                      rows={2}
                      className="w-full px-3 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm resize-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-1">Image URL</label>
                    <div className="flex gap-2">
                      <ImageIcon className="w-4 h-4 text-stone-400 mt-3 shrink-0" />
                      <input
                        type="url"
                        value={newPromo.image_url}
                        onChange={(e) => setNewPromo(p => ({ ...p, image_url: e.target.value }))}
                        placeholder="https://..."
                        className="flex-1 px-3 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                      />
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPromo.is_active}
                        onChange={(e) => setNewPromo(p => ({ ...p, is_active: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                    <span className="text-sm font-medium text-stone-700">Active immediately</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreatePromoModal(false)}
                    className="flex-1 px-4 py-2.5 border border-stone-200 text-stone-700 rounded-xl hover:bg-stone-50 transition-colors text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addingPromo}
                    className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {addingPromo ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> Creating...</>
                    ) : (
                      <><Zap className="w-4 h-4" /> Create Promo</>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboard;
