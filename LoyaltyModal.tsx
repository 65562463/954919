import React, { useState, useEffect, useRef } from 'react';
import { QrCode, User, Gift, CheckCircle, XCircle, Loader2, RefreshCw, Camera } from 'lucide-react';
import { Customer, Reward, CartItem } from '../types';
import { safeFetch } from '../utils/api';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface LoyaltyModalProps {
  scannedCustomer: Customer | null;
  setScannedCustomer: (customer: Customer | null) => void;
  availableRewards: Reward[];
  setAvailableRewards: (rewards: Reward[]) => void;
  currentBranchId: number;
  cart: CartItem[];
  setCartSessions: React.Dispatch<React.SetStateAction<{ id: number; name: string; items: CartItem[]; }[]>>;
  activeCartId: number;
  fetchData: () => void; // To refresh product data after reward redemption
}

export const LoyaltyModal: React.FC<LoyaltyModalProps> = ({
  scannedCustomer,
  setScannedCustomer,
  availableRewards,
  setAvailableRewards,
  currentBranchId,
  cart,
  setCartSessions,
  activeCartId,
  fetchData,
}) => {
  const [qrCodeInput, setQrCodeInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (isScanning) {
      scannerRef.current = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );
      scannerRef.current.render(
        (decodedText) => {
          setQrCodeInput(decodedText);
          setIsScanning(false);
          if (scannerRef.current) {
            scannerRef.current.clear();
          }
          // Automatically trigger scan after a short delay to allow state update
          setTimeout(() => {
            handleScanQr(decodedText);
          }, 100);
        },
        (error) => {
          // Ignore scan errors as they happen constantly when no QR is in view
        }
      );
    } else {
      if (scannerRef.current) {
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear();
      }
    };
  }, [isScanning]);

  const handleScanQr = async (tokenToScan?: string) => {
    const token = tokenToScan || qrCodeInput;
    if (!token) {
      setError('الرجاء إدخال رمز QR أو مسحه');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await safeFetch<{ success: boolean; customer?: Customer; availableRewards?: Reward[]; error?: string }>(
        '/api/loyalty/scan-token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        }
      );

      if (response && response.success && response.customer && response.availableRewards) {
        setScannedCustomer(response.customer);
        setAvailableRewards(response.availableRewards);
        setSuccessMessage('تم مسح رمز العميل بنجاح!');
      } else {
        setError(response?.error || 'فشل مسح رمز QR. يرجى المحاولة مرة أخرى.');
        setScannedCustomer(null);
        setAvailableRewards([]);
      }
    } catch (err: any) {
      console.error('Error scanning QR:', err);
      setError(err.message || 'خطأ في الاتصال بالخادم.');
    } finally {
      setIsLoading(false);
      setQrCodeInput('');
    }
  };

  const handleRedeemReward = async (reward: Reward) => {
    if (!scannedCustomer) return;
    if (scannedCustomer.total_points < reward.points_required) {
      setError('نقاط العميل غير كافية لاستبدال هذه المكافأة.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      // For simplicity, we'll assume the current active cart is the order context
      // In a real scenario, an order might need to be finalized first or passed explicitly.
      const orderId = cart.length > 0 ? activeCartId : null; // Placeholder for order_id

      const response = await safeFetch<{ success: boolean; new_points?: number; reward_applied?: Reward; error?: string }>(
        '/api/loyalty/redeem-reward',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_id: scannedCustomer.id,
            reward_id: reward.id,
            order_id: orderId,
          }),
        }
      );

      if (response && response.success && response.new_points !== undefined) {
        setScannedCustomer(scannedCustomer ? { ...scannedCustomer, total_points: response.new_points! } : null);
        setSuccessMessage(`تم استبدال المكافأة بنجاح! نقاط العميل الجديدة: ${response.new_points}`);
        // Refresh available rewards based on new points
        setAvailableRewards(availableRewards.filter(r => r.id !== reward.id));
        fetchData(); // Refresh product data if a product reward was redeemed

        // If the reward is a product, add it to the current cart
        if (reward.product_id && reward.product_quantity) {
          const productData = await safeFetch<any>(`/api/products?branch_id=${currentBranchId}`);
          const productToAdd = productData.find((p: any) => p.id === reward.product_id);
          if (productToAdd) {
            setCartSessions(prev => prev.map(session => {
              if (session.id === activeCartId) {
                const existing = session.items.find(item => item.product.id === productToAdd.id);
                let newItems;
                if (existing) {
                  const newQuantity = existing.quantity + reward.product_quantity!;
                  newItems = session.items.map(item => 
                    item.product.id === productToAdd.id 
                      ? { ...item, quantity: newQuantity, total: newQuantity * productToAdd.price } 
                      : item
                  );
                } else {
                  newItems = [...session.items, { product: productToAdd, quantity: reward.product_quantity!, total: reward.product_quantity! * productToAdd.price }];
                }
                return { ...session, items: newItems };
              }
              return session;
            }));
          }
        }

      } else {
        setError(response?.error || 'فشل استبدال المكافأة. يرجى المحاولة مرة أخرى.');
      }
    } catch (err: any) {
      console.error('Error redeeming reward:', err);
      setError(err.message || 'خطأ في الاتصال بالخادم.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearLoyalty = () => {
    setScannedCustomer(null);
    setAvailableRewards([]);
    setQrCodeInput('');
    setError(null);
    setSuccessMessage(null);
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 p-6" dir="rtl">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">برنامج الولاء</h1>

      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <QrCode size={24} className="text-emerald-600" />
          مسح رمز QR للعميل
        </h2>
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            placeholder="أدخل رمز QR أو امسحه..."
            value={qrCodeInput}
            onChange={(e) => setQrCodeInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleScanQr()}
            className="flex-1 border border-gray-300 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white"
            disabled={isLoading || isScanning}
          />
          <button
            onClick={() => setIsScanning(!isScanning)}
            className={`px-4 py-2 rounded-xl font-semibold transition-colors flex items-center gap-2 ${
              isScanning ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
            }`}
            disabled={isLoading}
          >
            {isScanning ? <XCircle size={20} /> : <Camera size={20} />}
            {isScanning ? 'إلغاء الكاميرا' : 'فتح الكاميرا'}
          </button>
          <button
            onClick={() => handleScanQr()}
            className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2"
            disabled={isLoading || isScanning}
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <QrCode size={20} />}
            إدخال
          </button>
        </div>
        
        {isScanning && (
          <div className="mb-4 rounded-xl overflow-hidden border-2 border-emerald-500">
            <div id="qr-reader" className="w-full"></div>
          </div>
        )}
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded-xl flex items-center gap-2 mb-4">
            <XCircle size={20} />
            <span>{error}</span>
          </div>
        )}
        {successMessage && (
          <div className="bg-green-100 text-green-700 p-3 rounded-xl flex items-center gap-2 mb-4">
            <CheckCircle size={20} />
            <span>{successMessage}</span>
          </div>
        )}
      </div>

      {scannedCustomer && (
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <User size={24} className="text-blue-600" />
            معلومات العميل
          </h2>
          <div className="grid grid-cols-2 gap-4 text-gray-700">
            <div>
              <p className="text-sm font-medium text-gray-500">الاسم:</p>
              <p className="text-lg font-semibold">{scannedCustomer.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">النقاط الكلية:</p>
              <p className="text-lg font-semibold text-emerald-600">{scannedCustomer.total_points} نقطة</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">المستوى:</p>
              <p className="text-lg font-semibold">{scannedCustomer.tier}</p>
            </div>
          </div>
          <button 
            onClick={handleClearLoyalty}
            className="mt-6 bg-gray-100 text-gray-600 px-4 py-2 rounded-xl font-semibold hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <RefreshCw size={18} />
            مسح بيانات العميل
          </button>
        </div>
      )}

      {scannedCustomer && availableRewards.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Gift size={24} className="text-purple-600" />
            المكافآت المتاحة
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableRewards.map(reward => (
              <div key={reward.id} className="border border-gray-200 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">{reward.name}</h3>
                  <p className="text-sm text-gray-600 mb-3">يتطلب: <span className="font-bold text-emerald-600">{reward.points_required} نقطة</span></p>
                </div>
                <button
                  onClick={() => handleRedeemReward(reward)}
                  className="mt-4 bg-purple-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-purple-700 transition-colors"
                  disabled={isLoading || scannedCustomer.total_points < reward.points_required}
                >
                  {isLoading ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
                  استبدال المكافأة
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {scannedCustomer && availableRewards.length === 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-6 text-center text-gray-500">
          <p className="text-lg">لا توجد مكافآت متاحة لهذا العميل حالياً.</p>
          <p className="text-sm mt-2">اجمع المزيد من النقاط للحصول على مكافآت رائعة!</p>
        </div>
      )}
    </div>
  );
};
