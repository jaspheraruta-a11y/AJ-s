import { useState, useEffect } from 'react';
import { Category, Product, Profile, ProductSize } from '../types/database';
import { CategoryModel, ProductModel } from '../models';
import { supabase } from '../supabase';

export const useShopController = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const fetchProducts = async () => {
    try {
      const prods = await ProductModel.getAll();
      setProducts(prods);
    } catch (err: any) {
      console.error('[Shop] fetchProducts error:', err.message);
    }
  };

  const fetchCategories = async () => {
    try {
      const cats = await CategoryModel.getAll();
      setCategories(cats);
    } catch (err: any) {
      console.error('[Shop] fetchCategories error:', err.message);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [cats, prods] = await Promise.all([
          CategoryModel.getAll(),
          ProductModel.getAll()
        ]);
        setCategories(cats);
        setProducts(prods);
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

    fetchData();

    // ── Real-time: products (availability, price, new items) ─────────────────
    const productsChannel = supabase
      .channel('shop-products-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchProducts();
      })
      .subscribe();

    // ── Real-time: categories (new categories, sort order changes) ───────────
    const categoriesChannel = supabase
      .channel('shop-categories-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
        fetchCategories();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(categoriesChannel);
    };
  }, []);

  const filteredProducts = selectedCategory
    ? products.filter(p => p.category_id === selectedCategory)
    : products;

  return {
    categories,
    products: filteredProducts,
    loading,
    error,
    selectedCategory,
    setSelectedCategory
  };
};

export interface CartItem extends Product {
  quantity: number;
  selectedSize?: ProductSize;
  selectedAddons?: string[];
  totalPrice: number;
}

export const useCartController = () => {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (product: Product, selectedSize?: ProductSize, quantity: number = 1) => {
    setCart(prev => {
      // Create a unique key for the item (product + size combination)
      const itemKey = selectedSize ? `${product.id}-${selectedSize.id}` : product.id;
      const existing = prev.find(item => {
        if (selectedSize) {
          return item.id === product.id && item.selectedSize?.id === selectedSize.id;
        }
        return item.id === product.id && !item.selectedSize;
      });
      
      if (existing) {
        return prev.map(item =>
          (itemKey === (item.selectedSize ? `${item.id}-${item.selectedSize.id}` : item.id))
            ? { ...item, quantity, totalPrice: quantity * (item.price + (item.selectedSize?.price_modifier || 0)) }
            : item
        );
      }
      
      const cartItem: CartItem = {
        ...product,
        quantity,
        selectedSize,
        selectedAddons: [],
        totalPrice: quantity * (product.price + (selectedSize?.price_modifier || 0))
      };
      
      return [...prev, cartItem];
    });
  };

  const removeFromCart = (productId: string, sizeId?: string) => {
    setCart(prev => prev.filter(item => {
      if (sizeId) {
        return !(item.id === productId && item.selectedSize?.id === sizeId);
      }
      return item.id !== productId;
    }));
  };

  const updateQuantity = (productId: string, quantity: number, sizeId?: string) => {
    if (quantity <= 0) {
      removeFromCart(productId, sizeId);
      return;
    }
    setCart(prev => prev.map(item => {
      const matches = sizeId 
        ? item.id === productId && item.selectedSize?.id === sizeId
        : item.id === productId && !item.selectedSize;
      
      if (matches) {
        return { 
          ...item, 
          quantity, 
          totalPrice: quantity * (item.price + (item.selectedSize?.price_modifier || 0)) 
        };
      }
      return item;
    }));
  };

  const clearCart = () => setCart([]);

  const totalAmount = cart.reduce((sum, item) => sum + item.totalPrice, 0);

  return {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    totalAmount
  };
};
