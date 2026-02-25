import React from 'react';
import { Order, LoyaltyData, ReceiptSettings } from '../types';
import { Printer, X, CheckCircle2 } from 'lucide-react';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  branchName?: string;
  loyaltyData?: LoyaltyData | null;
  receiptSettings: ReceiptSettings | null;
}

const formatReceiptContent = (
  order: Order,
  branchName?: string,
  loyaltyData?: LoyaltyData | null,
  settings?: ReceiptSettings | null
): string => {
  const date = new Date(order.created_at).toLocaleString('ar-SA');
  const subtotal = (order.total_amount - order.tax_amount).toFixed(2);
  const discount = order.discount_amount.toFixed(2);
  const tax = order.tax_amount.toFixed(2);
  const total = order.total_amount.toFixed(2);
  const paymentMethod = order.payment_method === 'cash' ? 'كاش' : order.payment_method === 'card' ? 'بطاقة ائتمان' : 'نقاط قطاف';

  const storeName = settings?.store_name || 'متجر الخضار والفواكه';
  const branchDefaultName = settings?.branch_default_name || 'الفرع الرئيسي';
  const taxNumber = settings?.tax_number || '300000000000003';
  const invoiceType = settings?.invoice_type || 'فاتورة ضريبية مبسطة';
  const thankYouMessage = settings?.thank_you_message || 'شكراً لتسوقكم معنا!';
  const returnPolicy = settings?.return_policy || 'البضاعة المباعة لا ترد ولا تستبدل إلا حسب الشروط';
  const qrCodeImageUrl = settings?.qr_code_image_url || 'https://picsum.photos/128/128?random=receipt-qr';

  let receipt = '';

  // ESC/POS commands for centering, bold, etc.
  const ESC = '\x1b';
  const LF = '\x0a';
  const GS = '\x1d';

  // Header
  receipt += ESC + '|cA' + ESC + '|bC' + storeName + LF; // Center, Bold
  receipt += ESC + '|cA' + ESC + '|Nn' + (branchName || branchDefaultName) + LF; // Normal font
  receipt += ESC + '|cA' + ESC + '|Nn' + `الرقم الضريبي: ${taxNumber}` + LF;
  receipt += ESC + '|cA' + ESC + '|Nn' + invoiceType + LF;
  receipt += ESC + '|cA' + ESC + '|Nn' + '--------------------------------' + LF;
  receipt += ESC + '|cA' + ESC + '|Nn' + `رقم الفاتورة: #${order.id.toString().padStart(6, '0')}   التاريخ: ${date}` + LF;
  receipt += ESC + '|cA' + ESC + '|Nn' + '--------------------------------' + LF + LF;

  // Items
  receipt += ESC + '|cA' + ESC + '|bC' + 'الصنف        الكمية        المجموع' + LF;
  receipt += ESC + '|cA' + ESC + '|Nn' + '--------------------------------' + LF;
  order.items.forEach(item => {
    const itemName = item.product.name.padEnd(12).substring(0, 12);
    const quantity = `${item.quantity} ${item.product.unit === 'kg' ? 'كجم' : ''}`.padEnd(12);
    const totalItem = item.total.toFixed(2).padStart(8);
    receipt += ESC + '|cA' + ESC + '|Nn' + `${itemName}${quantity}${totalItem}` + LF;
  });
  receipt += ESC + '|cA' + ESC + '|Nn' + '--------------------------------' + LF + LF;

  // Summary
  receipt += ESC + '|cA' + ESC + '|Nn' + `المجموع (غير شامل الضريبة): ${subtotal} ج.م` + LF;
  if (order.discount_amount > 0) {
    receipt += ESC + '|cA' + ESC + '|Nn' + `الخصم: -${discount} ج.م` + LF;
  }
  receipt += ESC + '|cA' + ESC + '|Nn' + `ضريبة القيمة المضافة (15%): ${tax} ج.م` + LF;
  receipt += ESC + '|cA' + ESC + '|bC' + `الإجمالي: ${total} ج.م` + LF + LF; // Bold total
  receipt += ESC + '|cA' + ESC + '|Nn' + `طريقة الدفع: ${paymentMethod}` + LF + LF;

  // Loyalty Section
  if (loyaltyData) {
    receipt += ESC + '|cA' + ESC + '|Nn' + '--------------------------------' + LF;
    receipt += ESC + '|cA' + ESC + '|bC' + 'برنامج الولاء' + LF;
    receipt += ESC + '|cA' + ESC + '|Nn' + `النقاط المكتسبة من هذه العملية: +${loyaltyData.pointsEarned} نقطة` + LF;
    receipt += ESC + '|cA' + ESC + '|bC' + `إجمالي رصيد النقاط الحالي: ${loyaltyData.newTotalPoints} نقطة` + LF; // Bold points
    if (loyaltyData.suggestedReward) {
      receipt += ESC + '|cA' + ESC + '|Nn' + `مكافأة مقترحة: ${loyaltyData.suggestedReward}` + LF;
    }
    // Add QR code for app download or offers (example: a simple text link for now)
    receipt += ESC + '|cA' + ESC + '|Nn' + 'امسح لتحميل التطبيق أو العروض:' + LF;
    receipt += ESC + '|cA' + ESC + '|Nn' + loyaltyData.qrCodeLink + LF; // This would be a QR code image in a real printer
    receipt += ESC + '|cA' + ESC + '|Nn' + '--------------------------------' + LF + LF;
  }

  // Footer
  receipt += ESC + '|cA' + ESC + '|Nn' + 'شكراً لتسوقكم معنا!' + LF;
  receipt += ESC + '|cA' + ESC + '|Nn' + 'البضاعة المباعة لا ترد ولا تستبدل إلا حسب الشروط' + LF + LF;
  receipt += ESC + '|cA' + ESC + '|Nn' + '--------------------------------' + LF;
  receipt += ESC + '|cA' + ESC + '|Nn' + 'Powered by POS System' + LF;
  receipt += ESC + '|cA' + ESC + '|Nn' + '--------------------------------' + LF;

  // Cut paper
  receipt += GS + 'V' + '\x00'; // Full cut

  return receipt;
};

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, onClose, order, branchName, loyaltyData, receiptSettings }) => {
  if (!isOpen || !order) return null;

  const handlePrint = () => {
    // In a real application, you would send `formatReceiptContent(...)` to a thermal printer via a backend service or a browser extension.
    // For this simulation, we'll just log it to console and use window.print for visual representation.
    console.log('Printing receipt content (ESC/POS format):\n', formatReceiptContent(order, branchName, loyaltyData, receiptSettings));
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:bg-white print:p-0">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200 print:shadow-none print:max-w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 print:hidden">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <CheckCircle2 className="text-emerald-500" size={24} />
            تم الدفع بنجاح
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 print:p-0">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{receiptSettings?.store_name || 'متجر الخضار والفواكه'}</h1>
            <p className="text-sm text-gray-500 mb-1">{branchName || receiptSettings?.branch_default_name || 'الفرع الرئيسي'}</p>
            <p className="text-sm text-gray-500">الرقم الضريبي: {receiptSettings?.tax_number || '300000000000003'}</p>
            <p className="text-sm text-gray-500">{receiptSettings?.invoice_type || 'فاتورة ضريبية مبسطة'}</p>
            <div className="mt-4 text-xs text-gray-400 flex justify-between">
              <span>رقم الفاتورة: #{order.id.toString().padStart(6, '0')}</span>
              <span>التاريخ: {new Date(order.created_at).toLocaleString('ar-SA')}</span>
            </div>
          </div>
          
          <div className="border-t border-b border-dashed border-gray-300 py-4 mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-100 pb-2 mb-2 block">
                  <th className="text-right font-medium w-1/2">الصنف</th>
                  <th className="text-center font-medium w-1/4">الكمية</th>
                  <th className="text-left font-medium w-1/4">المجموع</th>
                </tr>
              </thead>
              <tbody className="block mt-2 space-y-2">
                {order.items.map((item, index) => (
                  <tr key={index} className="flex justify-between items-start">
                    <td className="text-right text-gray-800 w-1/2 pr-2">
                      <div className="font-medium">{item.product.name}</div>
                      <div className="text-xs text-gray-400">{item.product.price.toFixed(2)} ج.م</div>
                    </td>
                    <td className="text-center text-gray-600 w-1/4">
                      {item.quantity} {item.product.unit === 'kg' ? 'كجم' : ''}
                    </td>
                    <td className="text-left font-medium text-gray-800 w-1/4">
                      {item.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="space-y-2 text-sm mb-6">
            <div className="flex justify-between text-gray-600">
              <span>المجموع (غير شامل الضريبة)</span>
              <span>{(order.total_amount - order.tax_amount).toFixed(2)} ج.م</span>
            </div>
            {order.discount_amount > 0 && (
              <div className="flex justify-between text-red-500">
                <span>الخصم</span>
                <span>-{order.discount_amount.toFixed(2)} ج.م</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600">
              <span>ضريبة القيمة المضافة (15%)</span>
              <span>{order.tax_amount.toFixed(2)} ج.م</span>
            </div>
            <div className="flex justify-between font-bold text-lg text-gray-900 pt-2 border-t border-gray-100 mt-2">
              <span>الإجمالي</span>
              <span>{order.total_amount.toFixed(2)} ج.م</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 pt-2">
              <span>طريقة الدفع</span>
              <span>
                {order.payment_method === 'cash' ? 'كاش' : 
                 order.payment_method === 'card' ? 'بطاقة ائتمان' : 'نقاط قطاف'}
              </span>
            </div>
          </div>
          
          <div className="text-center text-xs text-gray-400 mt-8 mb-4">
            <p>{receiptSettings?.thank_you_message || 'شكراً لتسوقكم معنا!'}</p>
            <p>{receiptSettings?.return_policy || 'البضاعة المباعة لا ترد ولا تستبدل إلا حسب الشروط'}</p>
            {receiptSettings?.qr_code_image_url && (
              <img 
                src={receiptSettings.qr_code_image_url}
                alt="QR Code" 
                className="mx-auto mt-4 w-24 h-24 object-contain" 
                referrerPolicy="no-referrer"
              />
            )}
          </div>
          
          <button
            onClick={handlePrint}
            className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors print:hidden"
          >
            <Printer size={18} />
            طباعة الفاتورة
          </button>
        </div>
      </div>
    </div>
  );
};
