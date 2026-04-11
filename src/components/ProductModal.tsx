import React from 'react';
import { X, Package, CheckCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, ProductSize } from '../types/database';

interface ProductModalProps {
  product: Product | null;
  sizes: ProductSize[];
  isOpen: boolean;
  onClose: () => void;
  onAddToCart?: (product: Product, size?: ProductSize) => void;
}

export default function ProductModal({ product, sizes, isOpen, onClose, onAddToCart }: ProductModalProps) {
  if (!product) return null;

  const isAvailable = product.is_available && product.stock_quantity > 0;
  
  // Filter to show only large sizes
  const largeSizes = sizes.filter(size => 
    size.name.toLowerCase().includes('large') || 
    size.name.toLowerCase().includes('l') ||
    size.name.toLowerCase().includes('big')
  );

  const handleQuickAdd = (size?: ProductSize) => {
    if (onAddToCart && isAvailable) {
      onAddToCart(product, size);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col"
          >
            {/* Header with image */}
            <div className={`relative ${!product.has_sizes ? 'h-110' : 'h-80'} overflow-hidden`}>
              <img 
                src={product.image_url || `https://picsum.photos/seed/${product.slug}/600/400`} 
                alt={product.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <button 
                onClick={onClose}
                className="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur shadow-lg rounded-full flex items-center justify-center text-stone-600 hover:text-stone-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="absolute bottom-6 left-6 right-6">
                <h2 className="font-serif text-3xl font-bold text-white mb-2">{product.name}</h2>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xl font-semibold text-white">₱{product.price.toFixed(2)}</span>
                  <div className={`px-3 py-1 rounded-full flex items-center gap-1 ${
                    isAvailable 
                      ? 'bg-emerald-500/90 backdrop-blur-sm' 
                      : 'bg-red-500/90 backdrop-blur-sm'
                  }`}>
                    {isAvailable ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-white" />
                        <span className="text-white text-sm font-medium">In Stock</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-white" />
                        <span className="text-white text-sm font-medium">Out of Stock</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 bg-white">
              {/* Description */}
              {product.description && (
                <div className="mb-6">
                  <h3 className="font-serif text-lg font-bold text-[#7b6a6c] mb-2">Description</h3>
                  <p className="text-stone-600 leading-relaxed">{product.description}</p>
                </div>
              )}

              {/* Sizes */}
              {product.has_sizes && largeSizes.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-serif text-lg font-bold text-[#7b6a6c] mb-3">Add-ons</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {largeSizes.map((size) => (
                      <button
                        key={size.id}
                        onClick={() => handleQuickAdd(size)}
                        disabled={!isAvailable}
                        className={`bg-stone-50 border border-stone-200 rounded-2xl p-4 text-center transition-all ${
                          isAvailable 
                            ? 'hover:bg-[#7b6a6c] hover:text-white hover:border-[#7b6a6c] cursor-pointer' 
                            : 'opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="font-medium">{size.name}</div>
                        <div className="text-sm">
                          {size.price_modifier > 0 ? '+' : ''}₱{size.price_modifier.toFixed(2)}
                        </div>
                        {isAvailable && (
                          <div className="text-xs mt-1 opacity-75">Click to add</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick add button for products without sizes */}
              {!product.has_sizes && isAvailable && (
                <div className="mb-6">
                  <div className="text-left mb-4">                    
                    <span className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                      Ready to Order
                    </span>
                    <br />  
                    <br />
                  </div>
                  <button
                    onClick={() => handleQuickAdd()}
                    className="w-full bg-[#7b6a6c] text-white rounded-2xl p-4 font-medium hover:bg-[#6a5a5c] transition-colors"
                  >
                    Quick Add to Cart - ₱{product.price.toFixed(2)}
                  </button>
                </div>
              )}


              {/* Features */}
              <div className="flex flex-wrap gap-2">
                {product.has_sizes && (
                  <span className="px-3 py-1 bg-white text-[#7b6a6c] rounded-full text-sm font-large">
                    Multiple Sizes
                  </span>
                )}
                {product.has_addons && (
                  <span className="px-3 py-1 bg-white text-[#7b6a6c] rounded-full text-sm font-large">
                    Add-ons Available
                  </span>
                )}
                {product.has_sizes && isAvailable && (
                  <span className="px-3 py-1 bg-white text-emerald-600 rounded-full text-sm font-large">
                    <strong>Ready to Order</strong>
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
