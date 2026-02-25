import React, { useState } from 'react';
import { Store, Lock, ArrowRight, Delete } from 'lucide-react';
import { User } from '../types';
import { safeFetch } from '../utils/api';
import { db } from '../utils/db';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleNumberClick = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
      setError('');
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pin.length !== 4) {
      setError('الرجاء إدخال 4 أرقام');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (navigator.onLine) {
        const data = await safeFetch<{ success: boolean, user: User }>('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin })
        });

        if (data && data.success) {
          onLogin(data.user);
          return;
        }
      } else {
        // Offline login
        const users = await db.users.toArray();
        const user = users.find(u => u.pin === pin);
        if (user) {
          onLogin(user);
          return;
        }
      }
      
      setError('رمز الدخول غير صحيح');
      setPin('');
    } catch (err) {
      // Fallback to offline if server error
      try {
        const users = await db.users.toArray();
        const user = users.find(u => u.pin === pin);
        if (user) {
          onLogin(user);
          return;
        }
      } catch (e) {}
      
      setError('حدث خطأ في الاتصال بالخادم');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-submit when 4 digits are entered
  React.useEffect(() => {
    if (pin.length === 4) {
      handleSubmit();
    }
  }, [pin]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans" dir="rtl">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="bg-emerald-600 p-8 text-center text-white">
          <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Store size={32} />
          </div>
          <h1 className="text-2xl font-bold mb-2">نظام نقاط البيع</h1>
          <p className="text-emerald-100">مرحباً بك، الرجاء إدخال رمز الدخول</p>
        </div>

        <div className="p-8">
          <div className="flex justify-center gap-3 mb-8">
            {[0, 1, 2, 3].map((index) => (
              <div 
                key={index}
                className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                  pin.length > index 
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-600' 
                    : 'border-gray-200 bg-gray-50 text-gray-300'
                } ${error ? 'border-red-300 bg-red-50 text-red-500' : ''}`}
              >
                {pin.length > index ? '•' : ''}
              </div>
            ))}
          </div>

          {error && (
            <p className="text-red-500 text-center text-sm mb-6 font-medium bg-red-50 py-2 rounded-lg">
              {error}
            </p>
          )}


          <div className="grid grid-cols-3 gap-4 max-w-[280px] mx-auto">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num.toString())}
                disabled={isLoading}
                className="h-16 rounded-2xl bg-gray-50 hover:bg-gray-100 text-gray-800 text-2xl font-semibold transition-colors active:bg-gray-200"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleDelete}
              disabled={isLoading || pin.length === 0}
              className="h-16 rounded-2xl bg-gray-50 hover:bg-gray-100 text-gray-600 flex items-center justify-center transition-colors active:bg-gray-200 disabled:opacity-50"
            >
              <Delete size={24} />
            </button>
            <button
              onClick={() => handleNumberClick('0')}
              disabled={isLoading}
              className="h-16 rounded-2xl bg-gray-50 hover:bg-gray-100 text-gray-800 text-2xl font-semibold transition-colors active:bg-gray-200"
            >
              0
            </button>
            <button
              onClick={() => handleSubmit()}
              disabled={isLoading || pin.length !== 4}
              className="h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-colors active:bg-emerald-800 disabled:opacity-50 disabled:bg-gray-300"
            >
              <ArrowRight size={24} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
