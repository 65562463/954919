import React, { useState } from 'react';
import { X, Plus, Image as ImageIcon } from 'lucide-react';
import { safeFetch } from '../utils/api';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: number;
  onSuccess: () => void;
  categories: { id: number, name: string }[];
}

export const AddProductModal: React.FC<AddProductModalProps> = ({ isOpen, onClose, branchId, onSuccess, categories }) => {
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [price, setPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [categoryId, setCategoryId] = useState<number>(categories[0]?.id || 1);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [unit, setUnit] = useState('piece');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price || !stockQuantity) return;

    setIsSubmitting(true);
    try {
      console.log('Submitting new product:', { name, price, stockQuantity, categoryId });
      const formData = new FormData();
      formData.append('name', name);
      formData.append('barcode', barcode || String(Date.now()).slice(-8));
      formData.append('price', price);
      formData.append('stock_quantity', stockQuantity);
      formData.append('unit', unit);
      formData.append('branch_id', branchId.toString());
      formData.append('category_id', categoryId.toString());
      formData.append('cost_price', (parseFloat(price) * 0.7).toString());
      
      if (imageFile) {
        formData.append('image', imageFile);
      }

      console.log('[CLIENT] Sending request to /api/products...');
      const data = await safeFetch<{ success: boolean, error?: string }>('/api/products', {
        method: 'POST',
        body: formData
      });

      if (data && data.success) {
        console.log('[CLIENT] Product added successfully');
        onSuccess();
        onClose();
        // Reset form
        setName('');
        setBarcode('');
        setPrice('');
        setStockQuantity('');
        setImageFile(null);
        setImagePreview(null);
        setUnit('piece');
        setCategoryId(categories[0]?.id || 1);
      } else {
        console.error('[CLIENT] Product addition failed or timed out');
        const errorMsg = data?.error || 'حدث خطأ أثناء إضافة المنتج. يرجى المحاولة مرة أخرى.';
        alert(errorMsg);
      }
    } catch (error) {
      console.error('[CLIENT] Failed to add product', error);
      alert('حدث خطأ أثناء إضافة المنتج');
    } finally {
      console.log('[CLIENT] Setting isSubmitting to false');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Plus className="text-emerald-600" size={24} />
            إضافة منتج جديد
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">اسم المنتج *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white"
                placeholder="مثال: تفاح أحمر"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الباركود (اختياري)</label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white"
                placeholder="اتركه فارغاً للتوليد التلقائي"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">التصنيف</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">السعر (ج.م) *</label>
              <input
                type="number"
                required
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الكمية المتوفرة *</label>
              <input
                type="number"
                required
                step="0.01"
                min="0"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white"
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">وحدة البيع</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white"
              >
                <option value="piece">بالحبة</option>
                <option value="kg">بالكيلو</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">صورة المنتج</label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  id="product-image"
                />
                <label
                  htmlFor="product-image"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <span className="text-gray-500 text-sm truncate">
                    {imageFile ? imageFile.name : 'اختر صورة...'}
                  </span>
                  <ImageIcon className="text-gray-400" size={18} />
                </label>
              </div>
            </div>
          </div>

          {imagePreview && (
            <div className="mt-2 h-32 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center relative group">
              <img src={imagePreview} alt="Preview" className="h-full object-contain" />
              <button
                type="button"
                onClick={() => {
                  setImageFile(null);
                  setImagePreview(null);
                }}
                className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={14} />
              </button>
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
              disabled={isSubmitting}
              className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'جاري الإضافة...' : 'إضافة المنتج'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
