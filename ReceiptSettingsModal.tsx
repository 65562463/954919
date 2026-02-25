import React, { useState, useEffect } from 'react';
import { X, Upload, Save, Loader2, AlertCircle } from 'lucide-react';
import { ReceiptSettings } from '../types';
import { safeFetch } from '../utils/api';

interface ReceiptSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: ReceiptSettings | null;
  onSettingsSaved: () => void;
}

export const ReceiptSettingsModal: React.FC<ReceiptSettingsModalProps> = ({
  isOpen,
  onClose,
  currentSettings,
  onSettingsSaved,
}) => {
  const [storeName, setStoreName] = useState('');
  const [branchDefaultName, setBranchDefaultName] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [invoiceType, setInvoiceType] = useState('');
  const [thankYouMessage, setThankYouMessage] = useState('');
  const [returnPolicy, setReturnPolicy] = useState('');
  const [qrCodeFile, setQrCodeFile] = useState<File | null>(null);
  const [qrCodeImageUrl, setQrCodeImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (currentSettings) {
      setStoreName(currentSettings.store_name);
      setBranchDefaultName(currentSettings.branch_default_name);
      setTaxNumber(currentSettings.tax_number);
      setInvoiceType(currentSettings.invoice_type);
      setThankYouMessage(currentSettings.thank_you_message);
      setReturnPolicy(currentSettings.return_policy);
      setQrCodeImageUrl(currentSettings.qr_code_image_url);
    }
  }, [currentSettings]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setQrCodeFile(e.target.files[0]);
      setQrCodeImageUrl(URL.createObjectURL(e.target.files[0])); // Preview new image
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData();
    formData.append('store_name', storeName);
    formData.append('branch_default_name', branchDefaultName);
    formData.append('tax_number', taxNumber);
    formData.append('invoice_type', invoiceType);
    formData.append('thank_you_message', thankYouMessage);
    formData.append('return_policy', returnPolicy);
    if (qrCodeFile) {
      formData.append('qr_code_image', qrCodeFile);
    }

    try {
      const response = await safeFetch<{ success: boolean; message?: string; settings?: ReceiptSettings }>(
        '/api/receipt-settings',
        {
          method: 'POST',
          body: formData,
          // No 'Content-Type' header needed for FormData, browser sets it automatically
        }
      );

      if (response?.success) {
        setSuccess(true);
        onSettingsSaved(); // Trigger data refresh in App.tsx
        // Optionally, update local state with new settings from response if needed
        // setQrCodeFile(null); // Clear file input after successful upload
      } else {
        setError(response?.message || 'فشل حفظ الإعدادات.');
      }
    } catch (err) {
      console.error('Failed to save receipt settings:', err);
      setError('حدث خطأ في الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">إعدادات الفاتورة</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
          {error && (
            <div className="bg-red-100 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="bg-emerald-100 text-emerald-700 px-4 py-3 rounded-xl flex items-center gap-2">
              <Save size={20} />
              <span>تم حفظ الإعدادات بنجاح!</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="storeName" className="block text-sm font-medium text-gray-700 mb-1">اسم المتجر</label>
              <input
                type="text"
                id="storeName"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white"
              />
            </div>
            <div>
              <label htmlFor="branchDefaultName" className="block text-sm font-medium text-gray-700 mb-1">الاسم الافتراضي للفرع</label>
              <input
                type="text"
                id="branchDefaultName"
                value={branchDefaultName}
                onChange={(e) => setBranchDefaultName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white"
              />
            </div>
            <div>
              <label htmlFor="taxNumber" className="block text-sm font-medium text-gray-700 mb-1">الرقم الضريبي</label>
              <input
                type="text"
                id="taxNumber"
                value={taxNumber}
                onChange={(e) => setTaxNumber(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white"
              />
            </div>
            <div>
              <label htmlFor="invoiceType" className="block text-sm font-medium text-gray-700 mb-1">نوع الفاتورة</label>
              <input
                type="text"
                id="invoiceType"
                value={invoiceType}
                onChange={(e) => setInvoiceType(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label htmlFor="thankYouMessage" className="block text-sm font-medium text-gray-700 mb-1">رسالة الشكر</label>
            <textarea
              id="thankYouMessage"
              value={thankYouMessage}
              onChange={(e) => setThankYouMessage(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white"
            ></textarea>
          </div>

          <div>
            <label htmlFor="returnPolicy" className="block text-sm font-medium text-gray-700 mb-1">سياسة الإرجاع</label>
            <textarea
              id="returnPolicy"
              value={returnPolicy}
              onChange={(e) => setReturnPolicy(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white"
            ></textarea>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">صورة رمز QR</label>
            <div className="mt-1 flex items-center space-x-4">
              {qrCodeImageUrl && (
                <img src={qrCodeImageUrl} alt="QR Code Preview" className="w-24 h-24 object-contain border border-gray-200 rounded-lg" referrerPolicy="no-referrer" />
              )}
              <label htmlFor="qrCodeUpload" className="cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-xl shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 flex items-center gap-2">
                <Upload size={16} />
                <span>{qrCodeFile ? qrCodeFile.name : 'تغيير الصورة'}</span>
                <input id="qrCodeUpload" name="qrCodeUpload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*" />
              </label>
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={handleSaveSettings}
            disabled={loading}
            className="bg-emerald-600 text-white py-2 px-6 rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            <span>{loading ? 'جاري الحفظ...' : 'حفظ الإعدادات'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
