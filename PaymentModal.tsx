import React, { useState } from 'react';
import { CreditCard, Banknote, Smartphone, X } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (method: string) => void;
  totalAmount: number;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onConfirm, totalAmount }) => {
  const [selectedMethod, setSelectedMethod] = useState<string>('cash');

  if (!isOpen) return null;

  const paymentMethods = [
    { id: 'cash', name: 'كاش', icon: <Banknote size={24} /> },
    { id: 'card', name: 'بطاقة ائتمان', icon: <CreditCard size={24} /> },
    { id: 'qitaf', name: 'نقاط قطاف', icon: <Smartphone size={24} /> },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">إتمام الدفع</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6">
          <div className="text-center mb-8">
            <p className="text-sm text-gray-500 mb-1">المبلغ الإجمالي</p>
            <p className="text-4xl font-bold text-emerald-600">{totalAmount.toFixed(2)} <span className="text-lg text-emerald-500">ج.م</span></p>
          </div>
          
          <h3 className="text-sm font-semibold text-gray-700 mb-3">اختر طريقة الدفع</h3>
          <div className="grid grid-cols-3 gap-3 mb-8">
            {paymentMethods.map((method) => (
              <button
                key={method.id}
                onClick={() => setSelectedMethod(method.id)}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 ${
                  selectedMethod === method.id 
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' 
                    : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="mb-2">{method.icon}</div>
                <span className="text-sm font-medium">{method.name}</span>
              </button>
            ))}
          </div>
          
          <button
            onClick={() => onConfirm(selectedMethod)}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-lg shadow-md transition-colors flex items-center justify-center gap-2"
          >
            تأكيد الدفع
          </button>
        </div>
      </div>
    </div>
  );
};
