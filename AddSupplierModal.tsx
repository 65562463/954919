import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { safeFetch } from '../utils/api';

interface AddSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSupplierAdded: () => void;
}

export const AddSupplierModal: React.FC<AddSupplierModalProps> = ({ isOpen, onClose, onSupplierAdded }) => {
  const [name, setName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      setError('اسم المورد مطلوب');
      return;
    }
    setIsSaving(true);
    setError('');

    try {
      const response = await safeFetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, contact_info: contactInfo }),
      });

      if (response) {
        onSupplierAdded();
        onClose();
        setName('');
        setContactInfo('');
      } else {
        setError('فشل إضافة المورد. حاول مرة أخرى.');
      }
    } catch (err) {
      setError('حدث خطأ في الاتصال بالخادم.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md m-4">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-800">إضافة مورد جديد</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}
          <div className="mb-4">
            <label htmlFor="supplierName" className="block text-sm font-medium text-gray-700 mb-1">اسم المورد</label>
            <input
              id="supplierName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              required
            />
          </div>
          <div className="mb-6">
            <label htmlFor="contactInfo" className="block text-sm font-medium text-gray-700 mb-1">معلومات الاتصال (اختياري)</label>
            <input
              id="contactInfo"
              type="text"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-gray-600 bg-gray-100 hover:bg-gray-200 font-medium">
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 font-bold flex items-center gap-2 disabled:bg-gray-300"
            >
              {isSaving ? 'جاري الحفظ...' : <><Save size={18} /> حفظ المورد</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
