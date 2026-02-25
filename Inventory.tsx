import React, { useState, useEffect } from 'react';
import { Product, Supplier, WasteLog, Branch, Category, User } from '../types';
import { AlertTriangle, Package, Trash2, Truck, Plus, RefreshCw, ArrowRightLeft, Edit2, Check, X, Coins, Pencil } from 'lucide-react';
import { AddProductModal } from './AddProductModal';
import { ConfirmModal } from './ConfirmModal';
import { AddSupplierModal } from './AddSupplierModal';
import { safeFetch } from '../utils/api';

interface InventoryProps {
  products: Product[];
  branches: Branch[];
  currentBranchId: number;
  onRefresh: () => void;
  categories: Category[];
  currentUser: User;
}

export const Inventory: React.FC<InventoryProps> = ({ products, branches, currentBranchId, onRefresh, categories, currentUser }) => {
  console.log('[CLIENT] Inventory rendering. User Role:', currentUser?.role);
  console.log('[CLIENT] Inventory rendering with products:', products.length);
  const [activeTab, setActiveTab] = useState<'stock' | 'waste' | 'purchases' | 'transfers'>('stock');
  const [wasteLogs, setWasteLogs] = useState<WasteLog[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [tempPrice, setTempPrice] = useState<string>('');
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
  const [editingThresholdId, setEditingThresholdId] = useState<number | null>(null);
  const [tempThreshold, setTempThreshold] = useState<string>('');

  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [tempName, setTempName] = useState('');

  const [editingCostPriceId, setEditingCostPriceId] = useState<number | null>(null);
  const [tempCostPrice, setTempCostPrice] = useState('');

  const [editingStockId, setEditingStockId] = useState<number | null>(null);
  const [tempStock, setTempStock] = useState('');

  // Waste Form State
  const [wasteProduct, setWasteProduct] = useState<number | ''>('');
  const [wasteQuantity, setWasteQuantity] = useState<number | ''>('');
  const [wasteReason, setWasteReason] = useState('');

  // Purchase Form State
  const [purchaseSupplier, setPurchaseSupplier] = useState<number | ''>('');
  const [purchaseItems, setPurchaseItems] = useState<{product_id: number, quantity: number, cost_price: number}[]>([]);
  const [newItemProduct, setNewItemProduct] = useState<number | ''>('');
  const [newItemQuantity, setNewItemQuantity] = useState<number | ''>('');
  const [newItemCost, setNewItemCost] = useState<number | ''>('');

  // Transfer Form State
  const [transferToBranch, setTransferToBranch] = useState<number | ''>('');
  const [transferProduct, setTransferProduct] = useState<number | ''>('');
  const [transferQuantity, setTransferQuantity] = useState<number | ''>('');
  
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  
  // Confirmation state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    fetchWasteLogs();
    fetchSuppliers();
  }, [currentBranchId]);

  const fetchWasteLogs = async () => {
    const data = await safeFetch<WasteLog[]>(`/api/waste?branch_id=${currentBranchId}`);
    if (data) setWasteLogs(data);
  };

  const fetchSuppliers = async () => {
    const data = await safeFetch<Supplier[]>('/api/suppliers');
    if (data) setSuppliers(data);
  };

  const handleLogWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wasteProduct || !wasteQuantity || !wasteReason) return;

    try {
      const res = await fetch('/api/waste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: currentBranchId,
          product_id: wasteProduct,
          quantity: Number(wasteQuantity),
          reason: wasteReason
        })
      });
      
      if (res.ok) {
        setWasteProduct('');
        setWasteQuantity('');
        setWasteReason('');
        fetchWasteLogs();
        onRefresh();
        alert('تم تسجيل الهالك بنجاح');
      }
    } catch (error) {
      console.error('Failed to log waste', error);
      alert('حدث خطأ أثناء تسجيل الهالك');
    }
  };

  const handleAddPurchaseItem = () => {
    if (!newItemProduct || !newItemQuantity || !newItemCost) return;
    
    setPurchaseItems([...purchaseItems, {
      product_id: Number(newItemProduct),
      quantity: Number(newItemQuantity),
      cost_price: Number(newItemCost)
    }]);
    
    setNewItemProduct('');
    setNewItemQuantity('');
    setNewItemCost('');
  };

  const handleRemovePurchaseItem = (index: number) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  };

  const handleSubmitPurchase = async () => {
    if (!purchaseSupplier || purchaseItems.length === 0) return;

    const totalAmount = purchaseItems.reduce((sum, item) => sum + (item.quantity * item.cost_price), 0);

    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: currentBranchId,
          supplier_id: purchaseSupplier,
          total_amount: totalAmount,
          items: purchaseItems
        })
      });

      if (res.ok) {
        setPurchaseSupplier('');
        setPurchaseItems([]);
        onRefresh();
        alert('تم تسجيل فاتورة المشتريات بنجاح');
      }
    } catch (error) {
      console.error('Failed to submit purchase', error);
      alert('حدث خطأ أثناء تسجيل المشتريات');
    }
  };

  const handleTransferStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferToBranch || !transferProduct || !transferQuantity) return;

    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_branch_id: currentBranchId,
          to_branch_id: transferToBranch,
          product_id: transferProduct,
          quantity: Number(transferQuantity)
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTransferToBranch('');
        setTransferProduct('');
        setTransferQuantity('');
        onRefresh();
        alert('تم تحويل المخزون بنجاح');
      } else {
        alert(data.error || 'حدث خطأ أثناء تحويل المخزون');
      }
    } catch (error) {
      console.error('Failed to transfer stock', error);
      alert('حدث خطأ أثناء تحويل المخزون');
    }
  };

  const handleUpdatePrice = async (productId: number) => {
    if (isUpdatingPrice) return;
    
    const priceNum = parseFloat(tempPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      alert('الرجاء إدخال سعر صحيح');
      return;
    }

    setIsUpdatingPrice(true);
    try {
      const res = await fetch(`/api/products/${productId}/price`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: priceNum })
      });

      if (res.ok) {
        setEditingPriceId(null);
        onRefresh();
      } else {
        const data = await res.json();
        alert(data.error || 'فشل تحديث السعر');
      }
    } catch (error) {
      console.error('Failed to update price', error);
      alert('حدث خطأ أثناء تحديث السعر');
    } finally {
      setIsUpdatingPrice(false);
    }
  };

  const startEditingPrice = (product: Product) => {
    setEditingPriceId(product.id);
    setTempPrice(product.price.toString());
  };

  const handleSupplierAdded = () => {
    fetchSuppliers(); // Refetch suppliers to update the dropdown
  };

  const startEditingThreshold = (product: Product) => {
    setEditingThresholdId(product.id);
    setTempThreshold(product.low_stock_threshold?.toString() || '0');
  };

  const cancelEditingThreshold = () => {
    setEditingThresholdId(null);
    setTempThreshold('');
  };

  const startEditingName = (product: Product) => {
    setEditingNameId(product.id);
    setTempName(product.name);
  };

  const cancelEditingName = () => {
    setEditingNameId(null);
    setTempName('');
  };

  const handleUpdateName = async (productId: number) => {
    try {
      const response = await fetch(`/api/products/${productId}/name`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tempName }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update name');
      }
      onRefresh();
      cancelEditingName();
    } catch (error) { 
      console.error('Failed to update name:', error);
      // You might want to show a toast notification here
    }
  };

  const startEditingCostPrice = (product: Product) => {
    setEditingCostPriceId(product.id);
    setTempCostPrice(product.cost_price.toString());
  };

  const cancelEditingCostPrice = () => {
    setEditingCostPriceId(null);
    setTempCostPrice('');
  };

  const handleUpdateCostPrice = async (productId: number) => {
    try {
      const response = await fetch(`/api/products/${productId}/cost-price`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cost_price: parseFloat(tempCostPrice) }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update cost price');
      }
      onRefresh();
      cancelEditingCostPrice();
    } catch (error) {
      console.error('Failed to update cost price:', error);
    }
  };

  const startEditingStock = (product: Product) => {
    setEditingStockId(product.id);
    setTempStock(product.stock_quantity.toString());
  };

  const cancelEditingStock = () => {
    setEditingStockId(null);
    setTempStock('');
  };

  const handleUpdateStock = async (productId: number) => {
    try {
      const response = await fetch(`/api/inventory/${currentBranchId}/${productId}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock_quantity: parseFloat(tempStock) }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update stock');
      }
      onRefresh();
      cancelEditingStock();
    } catch (error) {
      console.error('Failed to update stock:', error);
    }
  };

  const handleUpdateThreshold = async (productId: number) => {
    const newThreshold = parseFloat(tempThreshold);
    if (isNaN(newThreshold) || newThreshold < 0) {
      alert('الرجاء إدخال قيمة صالحة للحد الأدنى');
      return;
    }

    const res = await safeFetch(`/api/products/${productId}/threshold`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threshold: newThreshold })
    });

    if (res) {
      onRefresh();
      cancelEditingThreshold();
    } else {
      alert('فشل تحديث الحد الأدنى');
    }
  };

  const handleDeleteProduct = (productId: number, productName: string) => {
    setConfirmState({
      isOpen: true,
      title: 'حذف منتج',
      message: `هل أنت متأكد من حذف المنتج "${productName}"؟ سيتم حذفه من جميع الفروع وسجلات المبيعات والمخزون المرتبطة به.`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
          if (res.ok) {
            onRefresh();
          } else {
            alert('حدث خطأ أثناء حذف المنتج');
          }
        } catch (error) {
          console.error('Failed to delete product', error);
          alert('حدث خطأ أثناء حذف المنتج');
        }
      }
    });
  };

  const lowStockProducts = products.filter(p => p.stock_quantity <= (p.low_stock_threshold || 0));

  return (
    <div className="flex-1 bg-gray-50 flex flex-col overflow-hidden">
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Package className="text-emerald-600" />
            إدارة المخزون
          </h2>
          {currentUser.role === 'admin' && (
            <button
              onClick={() => setIsAddProductModalOpen(true)}
              className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm"
            >
              <Plus size={20} />
              إضافة منتج جديد
            </button>
          )}
        </div>
        <div className="flex gap-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('stock')}
            className={`px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'stock' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Package size={20} />
            المخزون
            {lowStockProducts.length > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {lowStockProducts.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('waste')}
            className={`px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'waste' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Trash2 size={20} />
            تسجيل الهالك
          </button>
          <button
            onClick={() => setActiveTab('purchases')}
            className={`px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'purchases' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Truck size={20} />
            المشتريات
          </button>
          <button
            onClick={() => setActiveTab('transfers')}
            className={`px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'transfers' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ArrowRightLeft size={20} />
            تحويل مخزون
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'stock' && (
          <div className="space-y-6">
            {lowStockProducts.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h3 className="text-red-800 font-bold flex items-center gap-2 mb-3">
                  <AlertTriangle size={20} />
                  تنبيهات انخفاض المخزون
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {lowStockProducts.map(p => (
                    <div key={p.id} className="bg-white p-3 rounded-lg border border-red-100 flex justify-between items-center">
                      <div>
                        <p className="font-medium text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-500">الحد الأدنى: {p.low_stock_threshold || 0}</p>
                      </div>
                      <div className="text-red-600 font-bold">
                        {p.stock_quantity} {p.unit === 'kg' ? 'كجم' : 'حبة'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-bold text-gray-800">جميع المنتجات</h3>
                <button onClick={onRefresh} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                  <RefreshCw size={18} />
                </button>
              </div>
              <table className="w-full text-right text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="p-4 font-medium">المنتج</th>
                    <th className="p-4 font-medium">الباركود</th>
                    <th className="p-4 font-medium">سعر البيع</th>
                    {currentUser?.role === 'admin' && <th className="p-4 font-medium">سعر التكلفة</th>}
                    <th className="p-4 font-medium">الكمية المتوفرة</th>
                    <th className="p-4 font-medium">الوحدة</th>
                    <th className="p-4 font-medium">الحالة</th>
                    <th className="p-4 font-medium">الحد الأدنى</th>
                    <th className="p-4 font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="p-4 font-medium text-gray-800">
                        <div className="flex items-center gap-2">
                          {editingNameId === p.id ? (
                            <div className="flex items-center gap-1">
                              <input 
                                type="text"
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                className="input input-bordered input-sm w-40"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleUpdateName(p.id)}
                              />
                              <button onClick={() => handleUpdateName(p.id)} className="btn btn-ghost btn-xs text-emerald-600"><Check size={16} /></button>
                              <button onClick={cancelEditingName} className="btn btn-ghost btn-xs text-red-600"><X size={16} /></button>
                            </div>
                          ) : (
                            <>
                              {p.name}
                                                            {currentUser?.role === 'admin' && <button onClick={() => startEditingName(p)} className="btn btn-ghost btn-xs"><Pencil size={14} /></button>}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-gray-500">{p.barcode}</td>
                      <td className="p-4">
                        {editingPriceId === p.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              value={tempPrice}
                              onChange={(e) => setTempPrice(e.target.value)}
                              className="w-20 border border-emerald-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdatePrice(p.id);
                                if (e.key === 'Escape') setEditingPriceId(null);
                              }}
                            />
                            <button 
                              onClick={() => handleUpdatePrice(p.id)}
                              disabled={isUpdatingPrice}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            >
                              <Check size={16} />
                            </button>
                            <button 
                              onClick={() => setEditingPriceId(null)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            <span className="font-bold text-emerald-600">{p.price.toFixed(2)} ج.م</span>
                            {currentUser?.role === 'admin' && (
                              <button 
                                onClick={() => startEditingPrice(p)}
                                className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                title="تعديل السعر"
                              >
                                <Edit2 size={14} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      {currentUser?.role === 'admin' && <td className="p-4">
                        {editingCostPriceId === p.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              value={tempCostPrice}
                              onChange={(e) => setTempCostPrice(e.target.value)}
                              className="w-20 border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateCostPrice(p.id);
                                if (e.key === 'Escape') cancelEditingCostPrice();
                              }}
                            />
                            <button onClick={() => handleUpdateCostPrice(p.id)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Check size={16} /></button>
                            <button onClick={cancelEditingCostPrice} className="p-1 text-red-500 hover:bg-red-50 rounded"><X size={16} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            <span>{p.cost_price.toFixed(2)} ج.م</span>
                            {currentUser?.role === 'admin' && (
                              <button onClick={() => startEditingCostPrice(p)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="تعديل سعر التكلفة">
                                <Edit2 size={14} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>}
                      <td className="p-4 font-bold text-gray-800">
                        {editingStockId === p.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              value={tempStock}
                              onChange={(e) => setTempStock(e.target.value)}
                              className="w-20 border border-purple-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateStock(p.id);
                                if (e.key === 'Escape') cancelEditingStock();
                              }}
                            />
                            <button onClick={() => handleUpdateStock(p.id)} className="p-1 text-purple-600 hover:bg-purple-50 rounded"><Check size={16} /></button>
                            <button onClick={cancelEditingStock} className="p-1 text-red-500 hover:bg-red-50 rounded"><X size={16} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            <span>{p.stock_quantity}</span>
                            {(currentUser?.role === 'admin' || currentUser?.role === 'branch_manager') && (
                              <button onClick={() => startEditingStock(p)} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all" title="تعديل الكمية المتوفرة">
                                <Edit2 size={14} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-gray-500">{p.unit === 'kg' ? 'كجم' : 'حبة'}</td>
                      <td className="p-4">
                        {p.stock_quantity <= (p.low_stock_threshold || 0) ? (
                          <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-medium">منخفض</span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-medium">متوفر</span>
                        )}
                      </td>
                      <td className="p-4 text-gray-500">
                        {editingThresholdId === p.id ? (
                          <div className="flex items-center gap-2">
                            <input 
                              type="number"
                              value={tempThreshold}
                              onChange={(e) => setTempThreshold(e.target.value)}
                              className="w-20 border-gray-300 rounded-md shadow-sm p-1.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                              autoFocus
                              onKeyDown={(e) => e.key === 'Enter' && handleUpdateThreshold(p.id)}
                            />
                            <button onClick={() => handleUpdateThreshold(p.id)} className="p-1 text-yellow-600 hover:bg-yellow-50 rounded"><Check size={16} /></button>
                            <button onClick={cancelEditingThreshold} className="p-1 text-red-500 hover:bg-red-50 rounded"><X size={16} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            <span>{p.low_stock_threshold || 0}</span>
                            {(currentUser?.role === 'admin' || currentUser?.role === 'branch_manager') && (
                              <button onClick={() => startEditingThreshold(p)} className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-all" title="تعديل الحد الأدنى">
                                <Edit2 size={14} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        {currentUser.role === 'admin' && (
                          <button
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="حذف المنتج"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'waste' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-bold text-gray-800 mb-4">تسجيل هالك جديد</h3>
                <form onSubmit={handleLogWaste} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">المنتج</label>
                    <select 
                      value={wasteProduct}
                      onChange={(e) => setWasteProduct(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      required
                    >
                      <option value="">اختر المنتج...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (متوفر: {p.stock_quantity})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الكمية التالفة</label>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0.01"
                      value={wasteQuantity}
                      onChange={(e) => setWasteQuantity(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">السبب</label>
                    <textarea 
                      value={wasteReason}
                      onChange={(e) => setWasteReason(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      rows={3}
                      placeholder="مثال: انتهاء الصلاحية، تلف أثناء النقل..."
                      required
                    ></textarea>
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-colors"
                  >
                    تسجيل الهالك وخصم من المخزون
                  </button>
                </form>
              </div>
            </div>
            
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-bold text-gray-800">سجل التوالف</h3>
                </div>
                <table className="w-full text-right text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="p-4 font-medium">التاريخ</th>
                      <th className="p-4 font-medium">المنتج</th>
                      <th className="p-4 font-medium">الكمية</th>
                      <th className="p-4 font-medium">السبب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {wasteLogs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-500">لا يوجد سجلات</td>
                      </tr>
                    ) : (
                      wasteLogs.map(log => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="p-4 text-gray-500">{new Date(log.created_at).toLocaleString('ar-SA')}</td>
                          <td className="p-4 font-medium text-gray-800">{log.product_name}</td>
                          <td className="p-4 font-bold text-red-600">{log.quantity}</td>
                          <td className="p-4 text-gray-600">{log.reason}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'purchases' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-4xl mx-auto">
            <h3 className="font-bold text-gray-800 mb-6 text-xl">تسجيل فاتورة مشتريات جديدة</h3>
            
            <div className="mb-6">
              <div className="flex items-end gap-3">
                <div className="flex-grow">
                  <label className="block text-sm font-medium text-gray-700 mb-1">المورد</label>
                <div className="flex-grow flex items-center gap-2">
                  <select 
                    value={purchaseSupplier}
                    onChange={(e) => setPurchaseSupplier(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">اختر المورد...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  {currentUser.role === 'admin' && purchaseSupplier && (
                    <button 
                      onClick={() => {
                        const supplierName = suppliers.find(s => s.id === purchaseSupplier)?.name;
                        setConfirmState({
                          isOpen: true,
                          title: 'حذف مورد',
                          message: `هل أنت متأكد من حذف المورد "${supplierName}"؟`,
                          onConfirm: async () => {
                            const res = await fetch(`/api/suppliers/${purchaseSupplier}`, { method: 'DELETE' });
                            if (res.ok) {
                              fetchSuppliers();
                              setPurchaseSupplier('');
                            } else {
                              const data = await res.json();
                              alert(data.error || 'فشل حذف المورد');
                            }
                          }
                        });
                      }}
                      className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                      title="حذف المورد المحدد"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
                </div>
                <button 
                  onClick={() => setIsAddSupplierModalOpen(true)}
                  className="bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center gap-2 shadow-sm border border-gray-200"
                >
                  <Plus size={18} />
                  إضافة مورد
                </button>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6">
              <h4 className="font-medium text-gray-800 mb-3">إضافة منتجات للفاتورة</h4>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs text-gray-500 mb-1">المنتج</label>
                  <select 
                    value={newItemProduct}
                    onChange={(e) => setNewItemProduct(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">اختر...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="w-32">
                  <label className="block text-xs text-gray-500 mb-1">الكمية</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0.01"
                    value={newItemQuantity}
                    onChange={(e) => setNewItemQuantity(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div className="w-32">
                  <label className="block text-xs text-gray-500 mb-1">سعر التكلفة للوحدة</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    value={newItemCost}
                    onChange={(e) => setNewItemCost(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <button 
                  type="button"
                  onClick={handleAddPurchaseItem}
                  className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 p-2 rounded-lg font-medium transition-colors flex items-center gap-1"
                >
                  <Plus size={20} />
                  إضافة
                </button>
              </div>
            </div>

            {purchaseItems.length > 0 && (
              <div className="mb-6">
                <table className="w-full text-right text-sm border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-100 text-gray-600">
                    <tr>
                      <th className="p-3 font-medium">المنتج</th>
                      <th className="p-3 font-medium">الكمية</th>
                      <th className="p-3 font-medium">سعر التكلفة</th>
                      <th className="p-3 font-medium">الإجمالي</th>
                      <th className="p-3 font-medium w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {purchaseItems.map((item, index) => {
                      const product = products.find(p => p.id === item.product_id);
                      return (
                        <tr key={index}>
                          <td className="p-3">{product?.name}</td>
                          <td className="p-3">{item.quantity}</td>
                          <td className="p-3">{item.cost_price.toFixed(2)}</td>
                          <td className="p-3 font-medium">{(item.quantity * item.cost_price).toFixed(2)}</td>
                          <td className="p-3">
                            <button 
                              onClick={() => handleRemovePurchaseItem(index)}
                              className="text-red-500 hover:bg-red-50 p-1 rounded"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 font-bold">
                    <tr>
                      <td colSpan={3} className="p-3 text-left">إجمالي الفاتورة:</td>
                      <td colSpan={2} className="p-3 text-emerald-600 text-lg">
                        {purchaseItems.reduce((sum, item) => sum + (item.quantity * item.cost_price), 0).toFixed(2)} ج.م
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleSubmitPurchase}
                disabled={!purchaseSupplier || purchaseItems.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-bold py-3 px-8 rounded-xl transition-colors"
              >
                حفظ الفاتورة وتحديث المخزون
              </button>
            </div>
          </div>
        )}

        {activeTab === 'transfers' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-lg mx-auto">
            <h3 className="font-bold text-gray-800 mb-6 text-xl">تحويل مخزون إلى فرع آخر</h3>
            <form onSubmit={handleTransferStock} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الفرع المحول إليه</label>
                <select 
                  value={transferToBranch}
                  onChange={(e) => setTransferToBranch(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                >
                  <option value="">اختر الفرع...</option>
                  {branches.filter(b => b.id !== currentBranchId).map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المنتج</label>
                <select 
                  value={transferProduct}
                  onChange={(e) => setTransferProduct(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                >
                  <option value="">اختر المنتج...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (متوفر: {p.stock_quantity})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الكمية المحولة</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0.01"
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <ArrowRightLeft size={20} />
                تنفيذ التحويل
              </button>
            </form>
          </div>
        )}
      </div>

      <AddProductModal
        isOpen={isAddProductModalOpen}
        onClose={() => setIsAddProductModalOpen(false)}
        branchId={currentBranchId}
        onSuccess={onRefresh}
        categories={categories}
      />

      <AddSupplierModal 
        isOpen={isAddSupplierModalOpen}
        onClose={() => setIsAddSupplierModalOpen(false)}
        onSupplierAdded={handleSupplierAdded}
      />

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
