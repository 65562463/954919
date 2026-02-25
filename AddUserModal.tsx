import React, { useState, useEffect } from 'react';
import { X, UserPlus, Shield } from 'lucide-react';
import { Branch } from '../types';
import { safeFetch } from '../utils/api';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  branches: Branch[];
  onSuccess: () => void;
}

export const AddUserModal: React.FC<AddUserModalProps> = ({ isOpen, onClose, branches, onSuccess }) => {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [debouncedPin, setDebouncedPin] = useState('');
  const [role, setRole] = useState<'admin' | 'branch_manager' | 'cashier'>('cashier');
  const [branchId, setBranchId] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [pinError, setPinError] = useState('');
  const [isPinChecking, setIsPinChecking] = useState(false);

  useEffect(() => {
    if (!isOpen) return; // Only run effects if modal is open

    const handler = setTimeout(() => {
      setDebouncedPin(pin);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [pin]);

  useEffect(() => {
    const checkPin = async () => {
      if (debouncedPin && debouncedPin.length === 4) {
        setIsPinChecking(true);
        setPinError('');
        try {
          const res = await fetch('/api/users/check-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: debouncedPin }),
          });
          const data = await res.json();
          if (!data.isAvailable) {
            setPinError('رمز الدخول هذا مستخدم بالفعل');
          }
        } catch (error) {
          console.error('Failed to check PIN', error);
        }
        setIsPinChecking(false);
      }
    };
    checkPin();
  }, [debouncedPin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !pin) return;
    
    if (pin.length !== 4) {
      setError('رمز الدخول يجب أن يكون 4 أرقام');
      return;
    }

    if ((role === 'cashier' || role === 'branch_manager') && !branchId) {
      setError('يجب اختيار فرع للموظف');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const data = await safeFetch<{ success: boolean, error?: string }>('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          pin,
          role,
          branch_id: role === 'admin' ? null : branchId
        })
      });

      if (data && data.success) {
        onSuccess();
        onClose();
        setName('');
        setPin('');
        setRole('cashier');
        setBranchId('');
      } else {
        setError(data?.error || 'حدث خطأ أثناء إضافة المستخدم');
      }
    } catch (err) {
      console.error('Failed to add user', err);
      setError('حدث خطأ في الاتصال بالخادم');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <UserPlus className="text-emerald-600" size={24} />
            إضافة مستخدم جديد
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">اسم المستخدم *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white"
              placeholder="مثال: أحمد محمد"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">رمز الدخول (4 أرقام) *</label>
            <input
              type="text"
              required
              maxLength={4}
              pattern="\d{4}"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white text-center tracking-widest font-mono text-lg"
              placeholder="1234"
            />
            <div className="text-xs text-gray-500 mt-1 h-4">
                {isPinChecking && <span className="text-gray-500">جاري التحقق...</span>}
                {pinError && <span className="text-red-500 font-medium">{pinError}</span>}
                {!isPinChecking && !pinError && <span>يجب أن يتكون من 4 أرقام فقط ويستخدم لتسجيل الدخول</span>}
              </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الصلاحية *</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setRole('cashier')}
                className={`py-2 px-2 rounded-xl border font-medium flex items-center justify-center gap-1 transition-colors text-sm ${
                  role === 'cashier' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                كاشير
              </button>
              <button
                type="button"
                onClick={() => setRole('branch_manager')}
                className={`py-2 px-2 rounded-xl border font-medium flex items-center justify-center gap-1 transition-colors text-sm ${
                  role === 'branch_manager' 
                    ? 'bg-purple-50 border-purple-200 text-purple-700' 
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Shield size={14} />
                مدير فرع
              </button>
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`py-2 px-2 rounded-xl border font-medium flex items-center justify-center gap-1 transition-colors text-sm ${
                  role === 'admin' 
                    ? 'bg-blue-50 border-blue-200 text-blue-700' 
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Shield size={14} />
                مدير نظام
              </button>
            </div>
          </div>

          {role !== 'admin' && (
            <div className="animate-in fade-in slide-in-from-top-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">الفرع *</label>
              <select
                required
                value={branchId}
                onChange={(e) => setBranchId(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white"
              >
                <option value="">اختر الفرع...</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {role === 'admin' && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-700 flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
              <Shield className="shrink-0 mt-0.5" size={16} />
              <p>
                <strong>تنبيه:</strong> إضافة مدير نظام جديد تعني إعطائه صلاحيات كاملة (كشريك) للوصول إلى كافة التقارير، الفروع، وإدارة جميع المستخدمين.
              </p>
            </div>
          )}

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !!pinError || pin.length !== 4}
              className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'جاري الإضافة...' : 'إضافة المستخدم'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
