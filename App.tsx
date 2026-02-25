import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Search, Store, Tag, Calculator, Receipt, Trash2, LogOut, LayoutGrid, Package, Shield, AlertTriangle, RefreshCw, FileText, CloudOff, CloudUpload } from 'lucide-react';
import { Product, Category, CartItem, Order, Branch, User, Customer, Reward, LoyaltyData, ReceiptSettings } from './types';
import { Plus, X } from 'lucide-react';
import { ProductCard } from './components/ProductCard';
import { CartItemRow } from './components/CartItemRow';
import { PaymentModal } from './components/PaymentModal';
import { ReceiptModal } from './components/ReceiptModal';
import { WeightScaleModal } from './components/WeightScaleModal';
import { Inventory } from './components/Inventory';
import { SuperAdmin } from './components/SuperAdmin';
import { LoginScreen } from './components/LoginScreen';
import { ConfirmModal } from './components/ConfirmModal';
import { LoyaltyModal } from './components/LoyaltyModal';
import { ReceiptSettingsModal } from './components/ReceiptSettingsModal';
import { safeFetch } from './utils/api';
import { saveInvoice, syncData } from './utils/sync';
import { db } from './utils/db';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranchId, setCurrentBranchId] = useState<number>(1);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  // Multi-cart state
  const [cartSessions, setCartSessions] = useState<{ id: number; name: string; items: CartItem[] }[]>([
    { id: 1, name: 'عميل 1', items: [] }
  ]);
  const [activeCartId, setActiveCartId] = useState<number>(1);

  // Derived state for active cart
  const activeSession = cartSessions.find(c => c.id === activeCartId) || cartSessions[0];
  const cart = activeSession.items;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [selectedWeightProduct, setSelectedWeightProduct] = useState<Product | null>(null);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [lastOrderLoyaltyData, setLastOrderLoyaltyData] = useState<LoyaltyData | null>(null);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [deleteCategoryModal, setDeleteCategoryModal] = useState<{isOpen: boolean, categoryId: number | null}>({isOpen: false, categoryId: null});
  const [isLoyaltyModalOpen, setIsLoyaltyModalOpen] = useState(false);
  const [scannedCustomer, setScannedCustomer] = useState<Customer | null>(null);
  const [availableRewards, setAvailableRewards] = useState<Reward[]>([]);
  const [isReceiptSettingsModalOpen, setIsReceiptSettingsModalOpen] = useState(false);
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);

  const [activeView, setActiveView] = useState<'pos' | 'inventory' | 'admin' | 'loyalty'>('pos');
  const [isServerHealthy, setIsServerHealthy] = useState<boolean | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  const updatePendingCount = async () => {
    const count = await db.syncQueue.count();
    setPendingSyncCount(count);
  };

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      await syncData();
      updatePendingCount();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial check
    updatePendingCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchData = async (includeReceiptSettings = true) => {
    if (!navigator.onLine) {
      // Offline mode: load from Dexie
      setIsServerHealthy(true); // Assume healthy if offline to allow UI to render
      const localBranches = await db.branches.toArray();
      const localCategories = await db.categories.toArray();
      const localProducts = await db.products.toArray();
      
      if (localBranches.length > 0) {
        setBranches(localBranches);
        if (!currentBranchId || currentBranchId === 1) {
          setCurrentBranchId(localBranches[0].id);
        }
      }
      if (localCategories.length > 0) setCategories(localCategories);
      if (localProducts.length > 0) setProducts(localProducts);
      
      // Load receipt settings from localStorage as a fallback
      const cachedSettings = localStorage.getItem('receiptSettings');
      if (cachedSettings) setReceiptSettings(JSON.parse(cachedSettings));
      
      return;
    }

    // Check server health first
    const health = await safeFetch<{ status: string }>('/api/health');
    if (health) {
      setIsServerHealthy(true);
      await syncData();
      updatePendingCount();
    } else {
      setIsServerHealthy(false);
      return;
    }

    if (includeReceiptSettings) {
      try {
        const settingsResponse = await safeFetch<{ success: boolean; settings: ReceiptSettings }>('/api/receipt-settings');
        if (settingsResponse?.success) {
          setReceiptSettings(settingsResponse.settings);
          localStorage.setItem('receiptSettings', JSON.stringify(settingsResponse.settings));
        }
      } catch (err) {
        console.error('Failed to fetch receipt settings:', err);
      }
    }

    const branchesData = await safeFetch<Branch[]>('/api/branches');
    if (branchesData) {
      setBranches(branchesData);
      await db.branches.clear();
      await db.branches.bulkAdd(branchesData);
      // If we don't have a branch ID or it's the initial default, set it to the first available branch
      if (branchesData.length > 0 && (!currentBranchId || currentBranchId === 1)) {
        const firstBranchId = branchesData[0].id;
        if (currentBranchId !== firstBranchId) {
          console.log(`[CLIENT] Setting branch ID to ${firstBranchId}`);
          setCurrentBranchId(firstBranchId);
        }
      }
    }

    const categoriesData = await safeFetch<Category[]>('/api/categories');
    if (categoriesData) {
      setCategories(categoriesData);
      await db.categories.clear();
      await db.categories.bulkAdd(categoriesData);
    }
      
    const usersData = await safeFetch<User[]>('/api/users');
    if (usersData) {
      await db.users.clear();
      await db.users.bulkAdd(usersData);
    }

    if (currentBranchId) {
      const productsData = await safeFetch<Product[]>(`/api/products?branch_id=${currentBranchId}`);
      if (productsData) {
        console.log(`[CLIENT] Fetched ${productsData.length} products for branch ${currentBranchId}`);
        setProducts(productsData);
        await db.products.clear();
        await db.products.bulkAdd(productsData);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentBranchId]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.includes(searchQuery) || p.barcode.includes(searchQuery);
      const matchesCategory = selectedCategory ? p.category_id === selectedCategory : true;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const addToCart = (product: Product, scannedWeight?: number) => {
    if (product.unit === 'kg' && scannedWeight === undefined) {
      setSelectedWeightProduct(product);
      setIsWeightModalOpen(true);
      return;
    }

    const quantityToAdd = scannedWeight !== undefined ? scannedWeight : 1;

    setCartSessions(prev => prev.map(session => {
      if (session.id === activeCartId) {
        const existing = session.items.find(item => item.product.id === product.id);
        let newItems;
        if (existing) {
          const newQuantity = existing.quantity + quantityToAdd;
          newItems = session.items.map(item => 
            item.product.id === product.id 
              ? { ...item, quantity: newQuantity, total: newQuantity * product.price }
              : item
          );
        } else {
          newItems = [...session.items, { product, quantity: quantityToAdd, total: quantityToAdd * product.price }];
        }
        return { ...session, items: newItems };
      }
      return session;
    }));
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const query = searchQuery.trim();
      if (!query) return;

      // Check for scale barcode (Format: 20 + PPPPP + WWWWW + C)
      // Example: 20 10001 01250 5 -> Product 10001, Weight 1.250 kg
      if (query.length === 13 && query.startsWith('20')) {
        const productCode = query.substring(2, 7);
        const weightStr = query.substring(7, 12);
        const weight = parseInt(weightStr, 10) / 1000;

        const product = products.find(p => p.barcode === productCode || p.barcode.padStart(5, '0') === productCode);
        
        if (product) {
          addToCart(product, weight);
          setSearchQuery('');
          return;
        }
      }

      // Normal barcode scan
      const product = products.find(p => p.barcode === query);
      if (product) {
        addToCart(product);
        setSearchQuery('');
      }
    }
  };

  const handleWeightConfirm = (weight: number) => {
    if (!selectedWeightProduct) return;
    
    setCartSessions(prev => prev.map(session => {
      if (session.id === activeCartId) {
        const existing = session.items.find(item => item.product.id === selectedWeightProduct.id);
        let newItems;
        if (existing) {
          const newQuantity = existing.quantity + weight;
          newItems = session.items.map(item => 
            item.product.id === selectedWeightProduct.id 
              ? { ...item, quantity: newQuantity, total: newQuantity * selectedWeightProduct.price }
              : item
          );
        } else {
          newItems = [...session.items, { product: selectedWeightProduct, quantity: weight, total: weight * selectedWeightProduct.price }];
        }
        return { ...session, items: newItems };
      }
      return session;
    }));
    
    setIsWeightModalOpen(false);
    setSelectedWeightProduct(null);
  };

  const updateQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCartSessions(prev => prev.map(session => {
      if (session.id === activeCartId) {
        const newItems = session.items.map(item => {
          if (item.product.id === productId) {
            return { ...item, quantity: newQuantity, total: newQuantity * item.product.price };
          }
          return item;
        });
        return { ...session, items: newItems };
      }
      return session;
    }));
  };

  const removeFromCart = (productId: number) => {
    setCartSessions(prev => prev.map(session => {
      if (session.id === activeCartId) {
        return { ...session, items: session.items.filter(item => item.product.id !== productId) };
      }
      return session;
    }));
  };

  const clearCart = () => {
    if (window.confirm('هل أنت متأكد من إفراغ السلة الحالية؟')) {
      setCartSessions(prev => prev.map(session => {
        if (session.id === activeCartId) {
          return { ...session, items: [] };
        }
        return session;
      }));
      setDiscountPercent(0);
    }
  };

  // Multi-cart management functions
  const addNewSession = () => {
    const newId = Math.max(...cartSessions.map(s => s.id)) + 1;
    setCartSessions([...cartSessions, { id: newId, name: `عميل ${newId}`, items: [] }]);
    setActiveCartId(newId);
  };

  const removeSession = (e: React.MouseEvent, sessionId: number) => {
    e.stopPropagation();
    if (cartSessions.length <= 1) return;
    
    const sessionToRemove = cartSessions.find(s => s.id === sessionId);
    if (sessionToRemove && sessionToRemove.items.length > 0) {
      if (!window.confirm(`سلة "${sessionToRemove.name}" تحتوي على منتجات. هل أنت متأكد من إغلاقها؟`)) {
        return;
      }
    }

    const newSessions = cartSessions.filter(s => s.id !== sessionId);
    setCartSessions(newSessions);
    if (activeCartId === sessionId) {
      setActiveCartId(newSessions[newSessions.length - 1].id);
    }
  };

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const discountAmount = (subtotal * discountPercent) / 100;
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * 0.15; // 15% VAT
  const totalAmount = taxableAmount + taxAmount;

  const handlePaymentConfirm = async (method: string) => {
    try {
      const orderData = {
        branch_id: currentBranchId,
        total_amount: totalAmount,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        payment_method: method,
        items: cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          price: item.product.price,
          cost_price: item.product.cost_price,
          total: item.total
        })),
        customer_id: scannedCustomer?.id || undefined, // Pass customer ID if scanned
      };

      const result = await saveInvoice(orderData);
      
      if (result && result.success) {
        if (result.offline) {
          updatePendingCount();
        }
        
        const newOrder: Order = {
          id: result.orderId || -Date.now(),
          ...orderData,
          created_at: new Date().toISOString(),
          items: cart
        };
        
        // Loyalty points calculation and update
        let loyaltyDataForReceipt: LoyaltyData | null = null;
        if (scannedCustomer) {
          const pointsEarned = Math.floor(totalAmount / 10); // 1 point per 10 units of total amount
          const addPointsResponse = await safeFetch<{ success: boolean; new_points?: number; error?: string }>(
            `/api/loyalty/add-points`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                customer_id: scannedCustomer.id,
                points_to_add: pointsEarned,
                order_id: newOrder.id,
              }),
            }
          );

          let newTotalPoints = scannedCustomer.total_points + pointsEarned;
          let suggestedReward: string | null = null;
          if (addPointsResponse?.success && addPointsResponse.new_points !== undefined) {
            newTotalPoints = addPointsResponse.new_points;
            // Example: Suggest a reward if close to a certain threshold
            if (newTotalPoints >= 200 && newTotalPoints < 500) {
              suggestedReward = `تبقي لك ${500 - newTotalPoints} نقطة للحصول على خصم 10% على الفاتورة!`;
            } else if (newTotalPoints >= 100 && newTotalPoints < 200) {
              suggestedReward = `تبقي لك ${200 - newTotalPoints} نقطة للحصول على 1 كجم تفاح أحمر مجاناً!`;
            }
          }

          loyaltyDataForReceipt = {
            pointsEarned: pointsEarned,
            newTotalPoints: newTotalPoints,
            suggestedReward: suggestedReward,
            qrCodeLink: 'https://example.com/app-download', // Placeholder for app download link
          };
          setLastOrderLoyaltyData(loyaltyDataForReceipt);
        }

        setCurrentOrder(newOrder);
        setIsPaymentOpen(false);
        setIsReceiptOpen(true);
        
        // Clear only the active cart
        setCartSessions(prev => prev.map(session => {
          if (session.id === activeCartId) {
            return { ...session, items: [] };
          }
          return session;
        }));
        setDiscountPercent(0);
        fetchData(); // Refresh products to update stock
      } else {
        alert('حدث خطأ أثناء إتمام الدفع');
      }
    } catch (error) {
      console.error('Payment failed', error);
      alert('حدث خطأ أثناء إتمام الدفع');
    }
  };

  const currentBranch = branches.find(b => b.id === currentBranchId);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    if (user.branch_id) {
      setCurrentBranchId(user.branch_id);
    }
    setActiveView('pos');
  };

  const handleLogout = () => {
    setIsLogoutModalOpen(true);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    const data = await safeFetch<{ success: boolean, id: number }>('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCategoryName }),
    });
    if (data && data.success) {
      setCategories([...categories, { id: data.id, name: newCategoryName }]);
      setNewCategoryName('');
      setIsAddCategoryModalOpen(false);
    }
  };

  const handleDeleteCategory = (categoryId: number) => {
    setDeleteCategoryModal({isOpen: true, categoryId});
  };

  const confirmDeleteCategory = async () => {
    if (!deleteCategoryModal.categoryId) return;
    
    const categoryId = deleteCategoryModal.categoryId;
    try {
      const data = await safeFetch<{ success: boolean, error?: string }>(`/api/categories/${categoryId}`, {
        method: 'DELETE',
      });
      if (data && data.success) {
        setCategories(categories.filter(c => c.id !== categoryId));
        if (selectedCategory === categoryId) {
          setSelectedCategory(null);
        }
      } else {
        alert(data?.error || 'حدث خطأ أثناء حذف التصنيف');
      }
    } catch (error) {
      alert('حدث خطأ في الاتصال بالخادم أثناء حذف التصنيف');
    }
    setDeleteCategoryModal({isOpen: false, categoryId: null});
  };

  const confirmLogout = () => {
    setCurrentUser(null);
    setCartSessions([{ id: 1, name: 'عميل 1', items: [] }]);
    setActiveCartId(1);
    setSearchQuery('');
    setIsLogoutModalOpen(false);
  };

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (isServerHealthy === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center" dir="rtl">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
          <div className="bg-red-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6 text-red-600">
            <AlertTriangle size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">خطأ في الاتصال بالخادم</h1>
          <p className="text-gray-600 mb-8">لا يمكن الوصول إلى النظام حالياً. يرجى التأكد من تشغيل الخادم والمحاولة مرة أخرى.</p>
          <button 
            onClick={() => {
              setIsServerHealthy(null);
              fetchData();
            }}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw size={20} />
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
              <Store size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">نظام نقاط البيع</h1>
              <p className="text-xs text-gray-500">{currentBranch?.name || 'جاري التحميل...'}</p>
            </div>
          </div>
          
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button 
              onClick={() => setActiveView('pos')}
              className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                activeView === 'pos' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <ShoppingCart size={18} />
              نقطة البيع
            </button>
            {currentUser.role !== 'cashier' && (
              <button 
                onClick={() => setActiveView('inventory')}
                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                  activeView === 'inventory' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Package size={18} />
                المخزون
              </button>
            )}
            {currentUser.role !== 'cashier' && (
              <button 
                onClick={() => setActiveView('admin')}
                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                  activeView === 'admin' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Shield size={18} />
                {currentUser.role === 'admin' ? 'الإدارة العليا' : 'إدارة الفرع'}
              </button>
            )}
            {currentUser.role === 'admin' && (
              <button 
                onClick={() => setIsReceiptSettingsModalOpen(true)}
                className="px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-all"
              >
                <FileText size={18} />
                إعدادات الفاتورة
              </button>
            )}
            <button 
              onClick={() => setActiveView('loyalty')}
              className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                activeView === 'loyalty' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <LayoutGrid size={18} />
              الولاء
            </button>
          </div>
        </div>
        
        {activeView === 'pos' && (
          <div className="flex-1 max-w-xl mx-8 relative">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="ابحث عن منتج أو امسح الباركود (يدعم باركود الميزان)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="block w-full pl-3 pr-10 py-2.5 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm transition-colors shadow-inner"
            />
          </div>
        )}

          <div className="flex items-center gap-4">
            {!isOnline && (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg text-sm font-medium" title="الوضع غير المتصل">
                <CloudOff size={18} />
                <span>غير متصل</span>
              </div>
            )}
            {pendingSyncCount > 0 && (
              <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg text-sm font-medium" title="فواتير بانتظار المزامنة">
                <CloudUpload size={18} />
                <span>{pendingSyncCount} بانتظار المزامنة</span>
              </div>
            )}
          {activeView !== 'admin' && currentUser.role === 'admin' && (
            <select
              value={currentBranchId}
              onChange={(e) => setCurrentBranchId(Number(e.target.value))}
              className="bg-gray-50 border border-gray-200 text-gray-700 py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <div className="text-left">
            <p className="text-sm font-medium text-gray-800">{currentUser.name}</p>
            <p className="text-xs text-gray-500">{currentUser.role === 'admin' ? 'مدير النظام' : currentUser.role === 'branch_manager' ? 'مدير فرع' : 'كاشير'}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            title="تسجيل الخروج"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {activeView === 'admin' ? (
        <SuperAdmin branches={branches} onRefresh={fetchData} currentUser={currentUser} />
      ) : activeView === 'inventory' ? (
        <Inventory products={products} branches={branches} currentBranchId={currentBranchId} onRefresh={fetchData} categories={categories} currentUser={currentUser} />
      ) : activeView === 'loyalty' ? (
        <LoyaltyModal 
          scannedCustomer={scannedCustomer}
          setScannedCustomer={setScannedCustomer}
          availableRewards={availableRewards}
          setAvailableRewards={setAvailableRewards}
          currentBranchId={currentBranchId}
          cart={cart}
          setCartSessions={setCartSessions}
          activeCartId={activeCartId}
          fetchData={fetchData}
        />
      ) : (
        <main className="flex-1 flex overflow-hidden">
          {/* Left Side: Products Grid */}
          <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/50">
            {/* Categories */}
            <div className="p-4 overflow-x-auto whitespace-nowrap border-b border-gray-100 bg-white">
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedCategory === null
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  الكل
                </button>
                {categories.map(cat => (
                  <div key={cat.id} className="flex items-center gap-1 relative group">
                    <button
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        selectedCategory === cat.id
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {cat.name}
                    </button>
                    {currentUser.role === 'admin' && (
                      <div className="relative z-50">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }}
                          className="bg-red-500 text-white rounded-full p-2 hover:bg-red-600 transition-colors flex items-center justify-center shadow-lg"
                          title="حذف التصنيف"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                ))}
                {currentUser.role === 'admin' && (
                  <button 
                    onClick={() => setIsAddCategoryModalOpen(true)}
                    className="px-3 py-2 rounded-full text-sm font-medium transition-colors bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center gap-1"
                  >
                    <Plus size={14} />
                    إضافة
                  </button>
                )}
              </div>
            </div>

            {isAddCategoryModalOpen && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                  <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800">إضافة تصنيف جديد</h2>
                    <button onClick={() => setIsAddCategoryModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    <input 
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="اسم التصنيف الجديد..."
                      className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white"
                    />
                    <button 
                      onClick={handleAddCategory}
                      className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                    >
                      إضافة
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Products */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-20">
                {filteredProducts.map(product => (
                  <ProductCard key={product.id} product={product} onAdd={() => addToCart(product)} />
                ))}
                {filteredProducts.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-400">
                    <LayoutGrid size={48} className="mb-4 opacity-20" />
                    <p className="text-lg">لا توجد منتجات مطابقة للبحث</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Side: Cart */}
          <div className="w-96 bg-white border-r border-gray-200 flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-10">
            
            {/* Cart Tabs */}
            <div className="flex overflow-x-auto border-b border-gray-200 bg-gray-50 scrollbar-hide">
              {cartSessions.map(session => (
                <div 
                  key={session.id}
                  onClick={() => setActiveCartId(session.id)}
                  className={`
                    relative group flex items-center gap-2 px-4 py-3 text-sm font-medium cursor-pointer transition-colors min-w-[100px] justify-between border-l border-gray-100
                    ${activeCartId === session.id 
                      ? 'bg-white text-emerald-700 border-t-2 border-t-emerald-500' 
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}
                  `}
                >
                  <div className="flex flex-col">
                    <span>{session.name}</span>
                    <span className="text-[10px] opacity-70">{session.items.length} منتج</span>
                  </div>
                  {cartSessions.length > 1 && (
                    <button
                      onClick={(e) => removeSession(e, session.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 hover:text-red-600 rounded-full transition-all"
                      title="إغلاق السلة"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
              <button 
                onClick={addNewSession}
                className="px-3 py-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors flex items-center justify-center border-l border-gray-200"
                title="سلة جديدة"
              >
                <Plus size={20} />
              </button>
            </div>

            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <ShoppingCart size={20} className="text-emerald-600" />
                سلة المشتريات
                <span className="bg-emerald-100 text-emerald-700 text-xs py-0.5 px-2 rounded-full ml-2">
                  {cart.length}
                </span>
              </h2>
              {cart.length > 0 && (
                <button 
                  onClick={clearCart}
                  className="text-sm text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Trash2 size={14} />
                  إفراغ
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                  <div className="bg-gray-50 p-6 rounded-full">
                    <ShoppingCart size={48} className="text-gray-300" />
                  </div>
                  <p className="text-sm font-medium">السلة فارغة</p>
                  <p className="text-xs text-gray-400 text-center max-w-[200px]">
                    قم بإضافة منتجات من القائمة أو امسح الباركود للبدء
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {cart.map(item => (
                    <CartItemRow 
                      key={item.product.id} 
                      item={item} 
                      onUpdateQuantity={updateQuantity}
                      onRemove={removeFromCart}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Cart Summary */}
            <div className="bg-gray-50 border-t border-gray-200 p-4 space-y-3">
              <div className="flex justify-between text-sm text-gray-600">
                <span>المجموع الفرعي</span>
                <span className="font-medium text-gray-800">{subtotal.toFixed(2)} ج.م</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Tag size={16} />
                  <span>الخصم</span>
                  <select 
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Number(e.target.value))}
                    className="bg-white border border-gray-200 rounded-md text-xs py-1 px-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={10}>10%</option>
                    <option value={15}>15%</option>
                    <option value={20}>20%</option>
                  </select>
                </div>
                <span className="font-medium text-red-500">
                  -{discountAmount.toFixed(2)} ج.م
                </span>
              </div>

              <div className="flex justify-between text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Calculator size={16} />
                  الضريبة (15%)
                </span>
                <span className="font-medium text-gray-800">{taxAmount.toFixed(2)} ج.م</span>
              </div>

              <div className="pt-3 border-t border-gray-200 flex justify-between items-end">
                <div>
                  <span className="block text-sm text-gray-500 mb-1">الإجمالي المطلوب</span>
                  <span className="text-2xl font-bold text-emerald-600">{totalAmount.toFixed(2)}</span>
                  <span className="text-sm font-medium text-emerald-600 mr-1">ج.م</span>
                </div>
              </div>

              <button
                disabled={cart.length === 0}
                onClick={() => setIsPaymentOpen(true)}
                className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold text-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Receipt size={20} />
                الدفع
              </button>
            </div>
          </div>
        </main>
      )}

      <PaymentModal 
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        onConfirm={handlePaymentConfirm}
        totalAmount={totalAmount}
      />

      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        order={currentOrder}
        branchName={currentBranch?.name}
        loyaltyData={lastOrderLoyaltyData}
        receiptSettings={receiptSettings}
      />

      <WeightScaleModal
        isOpen={isWeightModalOpen}
        onClose={() => {
          setIsWeightModalOpen(false);
          setSelectedWeightProduct(null);
        }}
        product={selectedWeightProduct}
        onConfirm={handleWeightConfirm}
      />

      <ConfirmModal
        isOpen={isLogoutModalOpen}
        title="تسجيل الخروج"
        message="هل أنت متأكد من تسجيل الخروج من النظام؟"
        onConfirm={confirmLogout}
        onClose={() => setIsLogoutModalOpen(false)}
      />

      <ConfirmModal
        isOpen={deleteCategoryModal.isOpen}
        title="حذف التصنيف"
        message="هل أنت متأكد من حذف هذا التصنيف؟ سيتم إلغاء تصنيف المنتجات الموجودة فيه ولن يتم حذف المنتجات نفسها."
        onConfirm={confirmDeleteCategory}
        onClose={() => setDeleteCategoryModal({isOpen: false, categoryId: null})}
      />

      <ReceiptSettingsModal
        isOpen={isReceiptSettingsModalOpen}
        onClose={() => setIsReceiptSettingsModalOpen(false)}
        currentSettings={receiptSettings}
        onSettingsSaved={() => fetchData(true)} // Refresh all data including receipt settings
      />
    </div>
  );
}
