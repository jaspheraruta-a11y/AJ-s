import React, { useState, useEffect, useRef, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coffee, ShoppingCart, User, Menu as MenuIcon, X, Plus, Minus, Trash2, ChevronRight, LogOut, UserCircle, AlertCircle, Gift, Star, ClipboardList, Clock, CheckCircle, ChefHat, XCircle, RefreshCw, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useShopController, useCartController, CartItem } from '../controllers';
import { Category, Product, Profile, ProductSize } from '../types/database';
import Logo from '../components/Logo';
import { supabase } from '../supabase';
import LoginModal from '../components/LoginModal';
import ProductModal from '../components/ProductModal';
import UserAgreementModal, { useAgreementModal } from '../components/UserAgreementModal';

// --- Types ---
interface RedeemableProduct {
  id: string;
  product_name: string;
  description: string | null;
  points_required: number;
  stock: number;
  max_per_user: number | null;
  redeemed_count: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  image_url: string | null;
}

// --- Order Types ---
interface OrderItem {
  id: string;
  product_name: string;
  size: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  addons: { name: string; price: number }[];
  notes: string | null;
}

interface ClientOrder {
  id: string;
  order_number: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'cancelled';
  order_type: string;
  subtotal: number;
  total: number;
  delivery_fee: number;
  discount_amount: number;
  customer_notes: string | null;
  table_number: string | null;
  created_at: string;
  updated_at: string;
  order_items: OrderItem[];
}

// --- Status Config ---
const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode; animated: boolean }> = {
  pending:    { label: 'Pending',    color: 'text-stone-600',  bg: 'bg-stone-100',   icon: <Clock className="w-4 h-4" />,        animated: false },
  confirmed:  { label: 'Confirmed',  color: 'text-blue-600',   bg: 'bg-blue-50',     icon: <CheckCircle className="w-4 h-4" />, animated: false },
  preparing:  { label: 'Preparing',  color: 'text-orange-600', bg: 'bg-orange-50',   icon: <ChefHat className="w-4 h-4" />,     animated: true  },
  ready:      { label: 'Ready!',     color: 'text-green-600',  bg: 'bg-green-50',    icon: <CheckCircle className="w-4 h-4" />, animated: true  },
  cancelled:  { label: 'Cancelled',  color: 'text-red-500',    bg: 'bg-red-50',      icon: <XCircle className="w-4 h-4" />,    animated: false },
};

// --- Fancy Animated Status Badge ---
const StatusBadge = ({ status }: { status: string }) => {
  const cfg = ORDER_STATUS_CONFIG[status] ?? ORDER_STATUS_CONFIG['preparing'];

  if (status === 'preparing') {
    return (
      <div className="relative inline-flex items-center gap-2">
        {/* pulsing ring */}
        <motion.span
          className="absolute inset-0 rounded-full bg-orange-300 opacity-40"
          animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <span className={`relative flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold ${cfg.bg} ${cfg.color} border border-orange-200 shadow-sm`}>
          {/* flame emoji pulses */}
          <motion.span
            animate={{ rotate: [-8, 8, -8], scale: [1, 1.2, 1] }}
            transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut' }}
            className="text-base leading-none"
          >🔥</motion.span>
          {cfg.label}
        </span>
      </div>
    );
  }

  if (status === 'ready') {
    return (
      <div className="relative inline-flex items-center gap-2">
        <motion.span
          className="absolute inset-0 rounded-full bg-green-400 opacity-30"
          animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.span
          className={`relative flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold ${cfg.bg} ${cfg.color} border border-green-300 shadow-sm`}
          animate={{ boxShadow: ['0 0 0px #4ade80', '0 0 16px #4ade80', '0 0 0px #4ade80'] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <motion.span
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
            className="text-base leading-none"
          >🍽️</motion.span>
          {cfg.label}
        </motion.span>
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${cfg.bg} ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
};

// --- Order Card ---
const OrderCard = ({ order }: { order: ClientOrder }) => {
  const [expanded, setExpanded] = useState(false);
  const cfg = ORDER_STATUS_CONFIG[order.status] ?? ORDER_STATUS_CONFIG['preparing'];
  const date = new Date(order.created_at);
  const dateStr = date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  const isActive = order.status === 'preparing' || order.status === 'ready';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-3xl border overflow-hidden transition-all duration-300 ${
        isActive
          ? 'border-orange-200 shadow-lg shadow-orange-100/60'
          : 'border-stone-100 hover:shadow-md'
      }`}
    >
      {/* Active status glow bar */}
      {isActive && (
        <motion.div
          className={`h-1 w-full ${
            order.status === 'preparing' ? 'bg-gradient-to-r from-orange-400 via-yellow-300 to-orange-400' : 'bg-gradient-to-r from-green-400 via-emerald-300 to-green-400'
          }`}
          animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          style={{ backgroundSize: '200%' }}
        />
      )}

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-0.5">Order</p>
            <h3 className="font-mono font-bold text-[#7b6a6c] text-lg">{order.order_number}</h3>
            <p className="text-[11px] text-stone-400 mt-0.5">{dateStr} · {timeStr}</p>
          </div>
          <StatusBadge status={order.status} />
        </div>

        {/* Quick summary */}
        <div className="flex items-center gap-4 text-xs text-stone-500 mb-4">
          <span className="capitalize">{order.order_type} order</span>
          {order.table_number && <span>Table #{order.table_number}</span>}
          <span className="ml-auto font-bold text-[#7b6a6c] text-sm">₱{order.total.toFixed(2)}</span>
        </div>

        {/* Items preview (collapsed) */}
        {!expanded && (
          <div className="flex flex-wrap gap-1 mb-3">
            {order.order_items.slice(0, 3).map(item => (
              <span key={item.id} className="text-xs bg-stone-50 border border-stone-100 text-stone-600 px-2.5 py-1 rounded-full">
                {item.quantity}× {item.product_name}{item.size ? ` (${item.size})` : ''}
              </span>
            ))}
            {order.order_items.length > 3 && (
              <span className="text-xs bg-stone-50 border border-stone-100 text-stone-400 px-2.5 py-1 rounded-full">
                +{order.order_items.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Expanded items */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="border-t border-stone-100 pt-3 mb-3 space-y-2">
                {order.order_items.map(item => (
                  <div key={item.id} className="flex justify-between items-start text-sm">
                    <div>
                      <span className="font-medium text-[#7b6a6c]">{item.quantity}× {item.product_name}</span>
                      {item.size && <span className="text-stone-400 text-xs ml-1">({item.size})</span>}
                      {item.addons?.length > 0 && (
                        <p className="text-[11px] text-stone-400 mt-0.5">+ {item.addons.map(a => a.name).join(', ')}</p>
                      )}
                      {item.notes && <p className="text-[11px] text-amber-600 italic mt-0.5">Note: {item.notes}</p>}
                    </div>
                    <span className="font-mono text-stone-500 text-xs">₱{item.line_total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              {/* Totals breakdown */}
              <div className="border-t border-stone-100 pt-3 space-y-1 text-xs text-stone-500">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>₱{order.subtotal.toFixed(2)}</span>
                </div>
                {order.delivery_fee > 0 && (
                  <div className="flex justify-between">
                    <span>Delivery Fee</span>
                    <span>₱{order.delivery_fee.toFixed(2)}</span>
                  </div>
                )}
                {order.discount_amount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-₱{order.discount_amount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-[#7b6a6c] text-sm pt-1 border-t border-stone-100">
                  <span>Total</span>
                  <span>₱{order.total.toFixed(2)}</span>
                </div>
              </div>
              {order.customer_notes && (
                <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 italic">📝 {order.customer_notes}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toggle button */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-center gap-1 text-xs font-semibold text-stone-400 hover:text-[#7b6a6c] transition-colors pt-1"
        >
          {expanded ? 'Show less' : 'View details'}
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expanded ? '-rotate-90' : 'rotate-90'}`} />
        </button>
      </div>
    </motion.div>
  );
};

// --- Components ---

const Navbar = ({ 
  cartCount, 
  onCartClick, 
  user, 
  onLogin, 
  onLogout,
  clientPoints
}: { 
  cartCount: number, 
  onCartClick: () => void,
  user: Profile | null,
  onLogin: () => void,
  onLogout: () => void,
  clientPoints: number
}) => (
  <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-200 px-6 py-4 flex items-center justify-between">
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-[#7b6a6c] rounded-lg flex items-center justify-center">
           <span className="text-white text-[10px]">🍴</span>
        </div>
        <span className="font-serif text-xl font-bold tracking-tight text-[#7b6a6c]">AJ's Café</span>
      </div>
      
      {user && user.role === 'client' && (
        <div className="hidden sm:flex items-center pl-4 border-l border-stone-200">
          <span className="text-sm font-medium text-stone-500">
            Welcome, <span className="text-[#7b6a6c] font-bold">{user.full_name || 'Guest'}</span>!
          </span>
        </div>
      )}
    </div>
    
    <div className="flex items-center gap-4">
      <button 
        onClick={onCartClick}
        className="relative p-2 hover:bg-stone-100 rounded-full transition-colors"
      >
        <ShoppingCart className="w-6 h-6 text-stone-600" />
        {cartCount > 0 && (
          <span className="absolute top-0 right-0 bg-[#7b6a6c] text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
            {cartCount}
          </span>
        )}
      </button>
      
      {user ? (
        <div className="flex items-center gap-2">
          {user.role === 'client' && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-full border border-amber-200 shadow-sm" title="Loyalty points — every ₱1 spent = 0.01 pts">
              <span className="text-amber-500 text-sm">⭐</span>
              <span className="text-sm font-bold text-amber-700">{Number(clientPoints).toFixed(1)} pts</span>
            </div>
          )}
          <button 
            onClick={onLogout}
            className="p-2 hover:bg-red-50 text-red-500 rounded-full transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <button 
          onClick={onLogin}
          className="flex items-center gap-2 px-4 py-2 bg-[#7b6a6c] hover:bg-[#6a5a5c] text-white rounded-full transition-colors text-sm font-medium"
        >
          <User className="w-4 h-4" />
          Login
        </button>
      )}
    </div>
  </nav>
);

const CategoryPill = ({ category, isActive, onClick }: { category: Category, isActive: boolean, onClick: () => void, key?: string }) => (
  <button
    onClick={onClick}
    className={`px-6 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
      isActive 
        ? 'bg-[#7b6a6c] text-white shadow-md' 
        : 'bg-white text-stone-600 border border-stone-200 hover:border-stone-400'
    }`}
  >
    {category.name}
  </button>
);

const ProductCard = ({ product, onAdd, onClick }: { product: Product, onAdd: (p: Product) => void, onClick: (p: Product) => void, key?: string }) => (
  <motion.div 
    layout
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="group bg-white rounded-3xl border border-stone-100 overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer"
    onClick={() => onClick(product)}
  >
    <div className="aspect-square overflow-hidden bg-stone-50 relative">
      <img 
        src={product.image_url || `https://picsum.photos/seed/${product.slug}/400/400`} 
        alt={product.name}
        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        referrerPolicy="no-referrer"
      />
      <div className="absolute top-4 right-4">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onAdd(product);
          }}
          className="w-10 h-10 bg-white/90 backdrop-blur shadow-lg rounded-full flex items-center justify-center text-[#7b6a6c] hover:bg-[#7b6a6c] hover:text-white transition-all"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </div>
    <div className="p-5">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-serif text-lg font-bold text-[#7b6a6c]">{product.name}</h3>
        <span className="font-mono text-sm font-semibold text-[#7b6a6c]">₱{product.price.toFixed(2)}</span>
      </div>
      <p className="text-stone-500 text-sm line-clamp-2 mb-4">{product.description}</p>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-stone-400">
        <span>{product.has_sizes ? 'Sizes Available' : 'Standard Size'}</span>
        {product.has_addons && (
          <>
            <span className="w-1 h-1 bg-stone-300 rounded-full" />
            <span>Add-ons</span>
          </>
        )}
      </div>
    </div>
  </motion.div>
);

// --- Redeemable Product Card ---
const RedeemableProductCard = ({ item, userPoints }: { item: RedeemableProduct, userPoints: number }) => {
  const canRedeem = userPoints >= item.points_required && item.stock > 0 && item.is_active;
  const isOutOfStock = item.stock <= 0;
  const isExpired = item.valid_until ? new Date(item.valid_until) < new Date() : false;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group bg-white rounded-3xl border overflow-hidden transition-all duration-300 ${
        canRedeem
          ? 'border-amber-200 hover:shadow-xl hover:shadow-amber-100 cursor-pointer'
          : 'border-stone-100 opacity-70'
      }`}
    >
      <div className="aspect-square overflow-hidden bg-gradient-to-br from-amber-50 to-stone-100 relative">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.product_name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Gift className="w-20 h-20 text-amber-200" />
          </div>
        )}
        {/* Points badge */}
        <div className="absolute top-4 left-4">
          <div className="flex items-center gap-1 bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
            <Star className="w-3 h-3 fill-white" />
            {item.points_required} pts
          </div>
        </div>
        {/* Status badge */}
        {(isOutOfStock || isExpired) && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white/90 text-stone-700 text-sm font-bold px-4 py-2 rounded-full">
              {isOutOfStock ? 'Out of Stock' : 'Expired'}
            </span>
          </div>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-serif text-lg font-bold text-[#7b6a6c] mb-1">{item.product_name}</h3>
        {item.description && (
          <p className="text-stone-500 text-sm line-clamp-2 mb-4">{item.description}</p>
        )}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-stone-400">
            <span>{item.stock} left</span>
            {item.max_per_user && (
              <>
                <span className="w-1 h-1 bg-stone-300 rounded-full" />
                <span>Max {item.max_per_user}/user</span>
              </>
            )}
          </div>
          <div className={`flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full ${
            canRedeem
              ? 'bg-amber-50 text-amber-600 border border-amber-200'
              : 'bg-stone-100 text-stone-400'
          }`}>
            <Star className={`w-3 h-3 ${canRedeem ? 'text-amber-500 fill-amber-500' : 'text-stone-400'}`} />
            {canRedeem ? 'Redeemable' : `Need ${(item.points_required - userPoints).toFixed(1)} more pts`}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const CartDrawer = ({ 
  isOpen, 
  onClose, 
  cart, 
  onUpdateQuantity, 
  onRemove, 
  total,
  onCheckout
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  cart: CartItem[], 
  onUpdateQuantity: (id: string, q: number, sizeId?: string) => void,
  onRemove: (id: string, sizeId?: string) => void,
  total: number,
  onCheckout: () => void | Promise<void>
}) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#7b6a6c]/20 backdrop-blur-sm z-[60]"
        />
        <motion.div 
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-stone-50 z-[70] shadow-2xl flex flex-col"
        >
          <div className="p-6 border-b border-stone-200 flex items-center justify-between bg-white">
            <h2 className="font-serif text-2xl font-bold text-[#7b6a6c]">Your Order</h2>
            <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full">
              <X className="w-6 h-6 text-stone-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center">
                  <ShoppingCart className="w-10 h-10 text-stone-300" />
                </div>
                <div>
                  <p className="text-[#7b6a6c] font-medium">Your cart is empty</p>
                  <p className="text-stone-500 text-sm">Add some delicious coffee to get started!</p>
                </div>
                <button 
                  onClick={onClose}
                  className="px-6 py-2 bg-[#7b6a6c] text-white rounded-full text-sm font-medium"
                >
                  Browse Menu
                </button>
              </div>
            ) : (
              cart.map((item) => (
                <div key={`${item.id}-${item.selectedSize?.id || 'no-size'}`} className="flex gap-4 group">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden bg-stone-200 flex-shrink-0">
                    <img 
                      src={item.image_url || `https://picsum.photos/seed/${item.slug}/200/200`} 
                      alt={item.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className="font-serif font-bold text-[#7b6a6c] truncate">{item.name}</h4>
                      <button 
                        onClick={() => onRemove(item.id, item.selectedSize?.id)}
                        className="text-stone-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {item.selectedSize && (
                      <p className="text-[#7b6a6c] text-xs font-medium mb-1">{item.selectedSize.name}</p>
                    )}
                    <p className="text-stone-500 text-xs mb-3">
                      ₱{(item.price + (item.selectedSize?.price_modifier || 0)).toFixed(2)} each
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 bg-white border border-stone-200 rounded-full px-2 py-1">
                        <button 
                          onClick={() => onUpdateQuantity(item.id, item.quantity - 1, item.selectedSize?.id)}
                          className="p-1 hover:bg-stone-50 rounded-full"
                        >
                          <Minus className="w-3 h-3 text-stone-600" />
                        </button>
                        <span className="text-sm font-bold text-[#7b6a6c] w-4 text-center">{item.quantity}</span>
                        <button 
                          onClick={() => onUpdateQuantity(item.id, item.quantity + 1, item.selectedSize?.id)}
                          className="p-1 hover:bg-stone-50 rounded-full"
                        >
                          <Plus className="w-3 h-3 text-stone-600" />
                        </button>
                      </div>
                      <span className="font-mono font-bold text-[#7b6a6c]">₱{item.totalPrice.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {cart.length > 0 && (
            <div className="p-6 bg-white border-t border-stone-200 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-[#7b6a6c] font-bold text-lg pt-2 border-t border-stone-100">
                  <span>Total</span>
                  <span>₱{total.toFixed(2)}</span>
                </div>
              </div>
              <button 
                onClick={onCheckout}
                className="w-full py-4 bg-[#7b6a6c] hover:bg-[#6a5b5d] text-white rounded-2xl font-bold shadow-lg shadow-[#7b6a6c]/20 transition-all flex items-center justify-center gap-2"
              >
                Checkout
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// ── Web Audio alarm (repeating, loud, noticeable) ────────────────────────
const playOrderReadyChime = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    const noteDur    = 0.16;
    const noteGap    = 0.04;
    const passDur    = notes.length * (noteDur + noteGap); // ~0.8 s per pass
    const passGap    = 0.22;
    const totalPasses = 3;

    for (let pass = 0; pass < totalPasses; pass++) {
      const passOffset = pass * (passDur + passGap);
      notes.forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'square';          // sharper, more piercing
        osc.frequency.value = freq;
        const start = ctx.currentTime + passOffset + i * (noteDur + noteGap);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.7, start + 0.02); // loud
        gain.gain.setValueAtTime(0.7, start + noteDur - 0.03);
        gain.gain.linearRampToValueAtTime(0, start + noteDur);
        osc.start(start);
        osc.stop(start + noteDur + 0.01);
      });
    }
  } catch (_) {}
};

// ── Vibration alert for mobile phones ─────────────────────────────────────
// Pattern: short-pause-short-pause-long  (mirrors the 3-pass audio alarm)
const vibrateAlert = () => {
  if ('vibrate' in navigator) {
    navigator.vibrate([300, 100, 300, 100, 600]);
  }
};

const stopVibration = () => {
  if ('vibrate' in navigator) {
    navigator.vibrate(0); // cancel any ongoing vibration
  }
};

// --- Main View ---

export default function ShopView() {
  const navigate = useNavigate();
  const { 
    categories, 
    products, 
    loading: shopLoading, 
    error, 
    selectedCategory, 
    setSelectedCategory 
  } = useShopController();

  const {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    totalAmount
  } = useCartController();

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productSizes, setProductSizes] = useState<ProductSize[]>([]);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [user, setUser] = useState<Profile | null>(null);
  const [clientPoints, setClientPoints] = useState<number>(0);
  const [authLoading, setAuthLoading] = useState(true);

  // --- User Agreement Modal ---
  const { showAgreement, handleAccept } = useAgreementModal();

  // --- Ready-order notifications ---
  const [readyNotifs, setReadyNotifs] = useState<{ id: string; orderNumber: string; key: number }[]>([]);
  const prevStatuses = useRef<Record<string, string>>({});
  const notifKey = useRef(0);
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const dismissClientNotif = useCallback((key: number) => {
    setReadyNotifs(prev => prev.filter(n => n.key !== key));
  }, []);

  const stopAlarm = useCallback(() => {
    if (alarmIntervalRef.current !== null) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    stopVibration(); // cancel any ongoing vibration immediately
  }, []);

  const startAlarm = useCallback(() => {
    if (alarmIntervalRef.current !== null) return;
    playOrderReadyChime();
    vibrateAlert();                              // vibrate on first trigger
    alarmIntervalRef.current = setInterval(() => {
      playOrderReadyChime();
      vibrateAlert();                            // vibrate on each repeat
    }, 5000);
  }, []);

  // Stop alarm on unmount
  useEffect(() => { return () => stopAlarm(); }, [stopAlarm]);

  // --- Tab state ---
  const [activeTab, setActiveTab] = useState<'menu' | 'redeem' | 'orders'>('menu');
  const [redeemableProducts, setRedeemableProducts] = useState<RedeemableProduct[]>([]);
  const [redeemLoading, setRedeemLoading] = useState(false);

  // --- Orders state ---
  const [clientOrders, setClientOrders] = useState<ClientOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const fetchRedeemableProducts = async () => {
    setRedeemLoading(true);
    try {
      const { data, error } = await supabase
        .from('redeemable_products')
        .select('*')
        .eq('is_active', true)
        .order('points_required', { ascending: true });
      if (error) throw error;
      setRedeemableProducts(data || []);
    } catch (err) {
      console.error('Error fetching redeemable products:', err);
    } finally {
      setRedeemLoading(false);
    }
  };

  const fetchClientOrders = async (userId: string) => {
    setOrdersLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('user_id', userId)
        .neq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      setClientOrders((data as ClientOrder[]) || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'redeem') {
      fetchRedeemableProducts();
    }
    if (activeTab === 'orders' && user) {
      fetchClientOrders(user.id);
    }
  }, [activeTab, user]);

  // Real-time order status updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('client-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` },
        (_payload) => {
          fetchClientOrders(user.id);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Real-time profile updates (keep loyalty points in sync after purchases)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('client-profile-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          const updated = payload.new as any;
          if (typeof updated?.points === 'number') {
            setClientPoints(updated.points);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Detect new "ready" orders → show toast; keep alarm alive while any order is ready
  useEffect(() => {
    const prev = prevStatuses.current;
    const newNotifs: { id: string; orderNumber: string; key: number }[] = [];
    let anyReady = false;

    clientOrders.forEach(order => {
      if (order.status === 'ready') anyReady = true;
      const wasReady = prev[order.id] === 'ready';
      if (!wasReady && order.status === 'ready') {
        notifKey.current += 1;
        newNotifs.push({ id: order.id, orderNumber: order.order_number, key: notifKey.current });
      }
    });

    const snapshot: Record<string, string> = {};
    clientOrders.forEach(o => { snapshot[o.id] = o.status; });
    prevStatuses.current = snapshot;

    if (newNotifs.length > 0) {
      setReadyNotifs(prev => [...prev, ...newNotifs]);
    }

    // Loop alarm while any order is ready; stop as soon as none are
    if (anyReady) {
      startAlarm();
    } else {
      stopAlarm();
    }
  }, [clientOrders, startAlarm, stopAlarm]);

  // Auto-dismiss client notifications after 8 s
  useEffect(() => {
    if (readyNotifs.length === 0) return;
    const latest = readyNotifs[readyNotifs.length - 1];
    const t = setTimeout(() => dismissClientNotif(latest.key), 8000);
    return () => clearTimeout(t);
  }, [readyNotifs, dismissClientNotif]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setAuthLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setAuthLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      
      const profile = data as Profile;

      if (profile.role === 'admin') {
        navigate('/admin');
        return;
      }

      if (profile.role === 'staff') {
        navigate('/staff');
        return;
      }

      setUser(profile);

      // Read points directly from the profile (updated after every successful payment)
      if (profile.role === 'client') {
        setClientPoints(Number((profile as any).points) || 0);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const fetchProductSizes = async (productId: string) => {
    try {
      const { data, error } = await supabase
        .from('product_sizes')
        .select('*')
        .eq('product_id', productId)
        .order('name');

      if (error) throw error;
      setProductSizes(data || []);
    } catch (err) {
      console.error('Error fetching product sizes:', err);
      setProductSizes([]);
    }
  };

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setIsProductModalOpen(true);
    
    if (product.has_sizes) {
      fetchProductSizes(product.id);
    } else {
      setProductSizes([]);
    }
  };

  const closeProductModal = () => {
    setIsProductModalOpen(false);
    setSelectedProduct(null);
    setProductSizes([]);
  };

  const handleAddToCartFromModal = (product: Product, size?: ProductSize) => {
    addToCart(product, size);
    closeProductModal();
    setIsCartOpen(true);
  };

  if (shopLoading || authLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-stone-200 border-t-[#7b6a6c] rounded-full animate-spin" />
          <p className="font-serif italic text-stone-500">Brewing your experience...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#7b6a6c] mb-2">Something went wrong</h2>
          <p className="text-stone-500 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-[#7b6a6c] text-white rounded-full font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-[#7b6a6c] selection:bg-[#7b6a6c] selection:text-white">

      {/* ── User Agreement Modal ────────────────────────────────────────────── */}
      <UserAgreementModal isOpen={showAgreement} onAccept={handleAccept} />

      {/* ── Client Ready-Order Toast Notifications ─────────────────────────── */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {readyNotifs.map(notif => (
            <motion.div
              key={notif.key}
              initial={{ opacity: 0, y: -30, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="pointer-events-auto flex items-start gap-3 bg-white border-l-4 border-green-500 rounded-2xl shadow-2xl shadow-green-100/60 p-4 pr-5 w-80 max-w-[calc(100vw-2.5rem)]"
            >
              <motion.div
                animate={{ rotate: [-15, 15, -10, 10, -5, 5, 0] }}
                transition={{ duration: 0.7, repeat: Infinity, repeatDelay: 2.5 }}
                className="w-10 h-10 bg-green-50 border border-green-200 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
              >
                <Bell className="w-5 h-5 text-green-600" />
              </motion.div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-stone-800">Your Order is Ready! 🎉</p>
                <p className="text-xs text-stone-500 mt-0.5">
                  <span className="font-mono font-semibold text-green-700">{notif.orderNumber}</span>
                  {' '}— please pick it up!
                </p>
                <motion.div className="mt-2 h-1 bg-green-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-green-500 rounded-full"
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: 8, ease: 'linear' }}
                  />
                </motion.div>
              </div>
              <button
                onClick={() => dismissClientNotif(notif.key)}
                className="p-1 hover:bg-stone-100 rounded-lg transition-colors text-stone-400 hover:text-stone-600 flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
        <Navbar 
          cartCount={cart.length} 
          onCartClick={() => setIsCartOpen(true)}
          user={user}
          onLogin={() => setIsLoginModalOpen(true)}
          onLogout={handleLogout}
          clientPoints={clientPoints}
        />
      
      <main className="pt-28 pb-20 px-6 max-w-7xl mx-auto">
        {/* Hero Section */}
        <section className="mb-12">
          <div className="relative rounded-[40px] overflow-hidden bg-[#7b6a6c] h-[500px] flex items-center px-12">
            <img 
              src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=2000" 
              alt="Hero"
              className="absolute inset-0 w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-black/30" />
            <div className="relative z-10 max-w-2xl">
              <motion.span 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="inline-block px-4 py-1 bg-white/10 backdrop-blur-md rounded-full text-white text-xs font-bold uppercase tracking-widest mb-6"
              >
                Laligan, Valencia, Bukidnon
              </motion.span>
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="font-serif text-5xl md:text-7xl text-white font-bold leading-[0.9] mb-6"
              >
                Welcome to <br />
                <span className="italic text-stone-200">AJ's Café</span>
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-stone-100 text-lg mb-8 max-w-lg"
              >
                Experience the finest coffee and local flavors in the heart of Mindanao. Your home away from home.
              </motion.p>
              <motion.button 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="px-8 py-4 bg-white text-[#7b6a6c] rounded-2xl font-bold hover:bg-stone-100 transition-colors"
              >
                Order Now
              </motion.button>
            </div>
          </div>
        </section>

        {/* Tab Switcher */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <h2 className="font-serif text-3xl font-bold">
              {activeTab === 'menu' ? 'Explore Menu' : activeTab === 'redeem' ? '🎁 Redeem Points' : '📋 My Orders'}
            </h2>
            <div className="h-px flex-1 bg-stone-200 mx-8 hidden md:block" />
            {/* Tab pills */}
            <div className="flex gap-2 bg-stone-100 p-1 rounded-full">
              <button
                onClick={() => setActiveTab('menu')}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                  activeTab === 'menu'
                    ? 'bg-[#7b6a6c] text-white shadow-md'
                    : 'text-stone-500 hover:text-[#7b6a6c]'
                }`}
              >
                Menu
              </button>
              <button
                onClick={() => setActiveTab('redeem')}
                className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                  activeTab === 'redeem'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'text-stone-500 hover:text-amber-600'
                }`}
              >
                <Star className="w-3.5 h-3.5" />
                Redeem
              </button>
              {user && user.role === 'client' && (
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                    activeTab === 'orders'
                      ? 'bg-[#7b6a6c] text-white shadow-md'
                      : 'text-stone-500 hover:text-[#7b6a6c]'
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  My Orders
                  {clientOrders.filter(o => o.status === 'preparing' || o.status === 'ready').length > 0 && (
                    <motion.span
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="w-2 h-2 rounded-full bg-orange-400 ml-0.5"
                    />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Category filter — only shown on menu tab */}
          {activeTab === 'menu' && (
            <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
              <CategoryPill 
                category={{ id: '', name: 'All Items', slug: 'all', sort_order: 0 }}
                isActive={selectedCategory === null}
                onClick={() => setSelectedCategory(null)}
              />
              {categories.map(cat => (
                <CategoryPill 
                  key={cat.id}
                  category={cat}
                  isActive={selectedCategory === cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                />
              ))}
            </div>
          )}

          {/* Points banner — shown on redeem tab */}
          {activeTab === 'redeem' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl px-6 py-4"
            >
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
              </div>
              <div>
                <p className="text-sm text-amber-700 font-medium">Your Available Points</p>
                <p className="text-2xl font-bold text-amber-600">{Number(clientPoints).toFixed(1)} pts</p>
              </div>
              <div className="ml-auto text-xs text-amber-500 text-right hidden sm:block">
                <p>Earn 0.01 pts</p>
                <p>per ₱1 spent</p>
              </div>
            </motion.div>
          )}
        </section>

        {/* Menu Products Grid */}
        {activeTab === 'menu' && (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              <AnimatePresence mode="popLayout">
                {products.map(product => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    onAdd={(p) => {
                      addToCart(p);
                      setIsCartOpen(true);
                    }}
                    onClick={handleProductClick}
                  />
                ))}
              </AnimatePresence>
            </section>
            {products.length === 0 && (
              <div className="py-20 text-center">
                <p className="text-stone-500 font-serif italic text-xl">No products found in this category.</p>
              </div>
            )}
          </>
        )}

        {/* Redeemable Products Grid */}
        {activeTab === 'redeem' && (
          <>
            {redeemLoading ? (
              <div className="py-20 flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
                <p className="font-serif italic text-stone-500">Loading rewards...</p>
              </div>
            ) : redeemableProducts.length === 0 ? (
              <div className="py-20 text-center">
                <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Gift className="w-10 h-10 text-amber-300" />
                </div>
                <p className="text-stone-500 font-serif italic text-xl">No rewards available right now.</p>
                <p className="text-stone-400 text-sm mt-2">Check back soon for exciting redeemable items!</p>
              </div>
            ) : (
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                <AnimatePresence mode="popLayout">
                  {redeemableProducts.map(item => (
                    <RedeemableProductCard
                      key={item.id}
                      item={item}
                      userPoints={clientPoints}
                    />
                  ))}
                </AnimatePresence>
              </section>
            )}
          </>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <>
            {!user ? (
              <div className="py-20 text-center">
                <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ClipboardList className="w-10 h-10 text-stone-300" />
                </div>
                <p className="text-stone-500 font-serif italic text-xl">Please log in to view your orders.</p>
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="mt-4 px-6 py-2.5 bg-[#7b6a6c] text-white rounded-full text-sm font-medium"
                >
                  Log In
                </button>
              </div>
            ) : ordersLoading ? (
              <div className="py-20 flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-stone-200 border-t-[#7b6a6c] rounded-full animate-spin" />
                <p className="font-serif italic text-stone-500">Loading your orders...</p>
              </div>
            ) : clientOrders.length === 0 ? (
              <div className="py-20 text-center">
                <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ClipboardList className="w-10 h-10 text-stone-300" />
                </div>
                <p className="text-stone-500 font-serif italic text-xl">No orders yet.</p>
                <p className="text-stone-400 text-sm mt-2">Your order history will appear here once you place an order.</p>
                <button
                  onClick={() => setActiveTab('menu')}
                  className="mt-4 px-6 py-2.5 bg-[#7b6a6c] text-white rounded-full text-sm font-medium"
                >
                  Browse Menu
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Active orders callout */}
                {clientOrders.some(o => o.status === 'preparing' || o.status === 'ready') && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-4 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-2xl px-6 py-4 mb-6"
                  >
                    <motion.div
                      animate={{ rotate: [-5, 5, -5] }}
                      transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
                      className="text-3xl"
                    >🔔</motion.div>
                    <div>
                      <p className="font-bold text-orange-700">You have active orders!</p>
                      <p className="text-sm text-orange-500">Your food is being prepared. Updates appear in real-time.</p>
                    </div>
                    <button
                      onClick={() => user && fetchClientOrders(user.id)}
                      className="ml-auto p-2 rounded-full hover:bg-orange-100 text-orange-500 transition-colors"
                      title="Refresh orders"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}

                {/* Order status legend */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {Object.entries(ORDER_STATUS_CONFIG).map(([key, cfg]) => (
                    <span key={key} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                  ))}
                </div>

                {/* Orders grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  <AnimatePresence mode="popLayout">
                    {clientOrders.map(order => (
                      <OrderCard key={order.id} order={order} />
                    ))}
                  </AnimatePresence>
                </div>

                {/* Refresh button */}
                <div className="flex justify-center mt-6">
                  <button
                    onClick={() => user && fetchClientOrders(user.id)}
                    className="flex items-center gap-2 px-6 py-2.5 border border-stone-200 text-stone-500 hover:border-[#7b6a6c] hover:text-[#7b6a6c] rounded-full text-sm font-medium transition-all"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh Orders
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <AnimatePresence>
        {isCartOpen && (
          <CartDrawer 
            isOpen={isCartOpen}
            onClose={() => setIsCartOpen(false)}
            cart={cart}
            onUpdateQuantity={updateQuantity}
            onRemove={removeFromCart}
            total={totalAmount}
            onCheckout={async () => {
              const { data: { session } } = await supabase.auth.getSession();
              if (session) {
                setIsCartOpen(false);
                navigate('/payment', { state: { cart, total: totalAmount } });
              } else {
                setIsCartOpen(false);
                setIsLoginModalOpen(true);
              }
            }}
          />
        )}
        <LoginModal 
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
        />
        <ProductModal
          product={selectedProduct}
          sizes={productSizes}
          isOpen={isProductModalOpen}
          onClose={closeProductModal}
          onAddToCart={handleAddToCartFromModal}
        />
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200 py-12 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-[#7b6a6c] rounded-lg flex items-center justify-center">
                 <span className="text-white text-[10px]">🍴</span>
              </div>
              <span className="font-serif text-lg font-bold tracking-tight text-[#7b6a6c]">AJ's Café</span>
            </div>
            <p className="text-stone-500 max-w-sm">
              Your favorite local café in Laligan, Valencia, Bukidnon. Serving fresh coffee and delicious meals with a touch of Mindanaoan hospitality.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-[#7b6a6c] mb-6">Quick Links</h4>
            <ul className="space-y-4 text-stone-500 text-sm">
              <li><a href="#" className="hover:text-[#7b6a6c] transition-colors">Our Story</a></li>
              <li><a href="#" className="hover:text-[#7b6a6c] transition-colors">Menu</a></li>
              <li><a href="#" className="hover:text-[#7b6a6c] transition-colors">Locations</a></li>
              <li><a href="#" className="hover:text-[#7b6a6c] transition-colors">Contact</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-[#7b6a6c] mb-6">Connect</h4>
            <ul className="space-y-4 text-stone-500 text-sm">
              <li><a href="#" className="hover:text-[#7b6a6c] transition-colors">Instagram</a></li>
              <li><a href="#" className="hover:text-[#7b6a6c] transition-colors">Twitter</a></li>
              <li><a href="#" className="hover:text-[#7b6a6c] transition-colors">Facebook</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-stone-100 flex flex-col md:flex-row justify-between items-center gap-4 text-stone-400 text-xs font-medium uppercase tracking-widest">
          <p>© 2024 AJ's Café. Laligan, Valencia, Bukidnon, Mindanao.</p>
          <div className="flex gap-8">
            <a href="#" className="hover:text-stone-600">Privacy Policy</a>
            <a href="#" className="hover:text-stone-600">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
