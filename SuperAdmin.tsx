import React, { useState, useEffect } from 'react';
import { Branch, User } from '../types';
import { Building2, TrendingUp, AlertTriangle, DollarSign, Plus, Users, UserPlus, Trash2 } from 'lucide-react';
import { AddBranchModal } from './AddBranchModal';
import { AddUserModal } from './AddUserModal';
import { ConfirmModal } from './ConfirmModal';
import { safeFetch } from '../utils/api';

interface SuperAdminProps {
  branches: Branch[];
  onRefresh: () => void;
  currentUser: User;
}

interface ReportData {
  total_sales: number;
  net_profit: number;
  total_waste_qty: number;
}

export const SuperAdmin: React.FC<SuperAdminProps> = ({ branches, onRefresh, currentUser }) => {
  const [reports, setReports] = useState<Record<number, ReportData>>({});
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddBranchModalOpen, setIsAddBranchModalOpen] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  
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

  const isBranchManager = currentUser.role === 'branch_manager';
  const displayBranches = isBranchManager 
    ? branches.filter(b => b.id === currentUser.branch_id)
    : branches;

  const fetchUsers = async () => {
    const data = await safeFetch<User[]>('/api/users');
    if (data) setUsers(data);
  };

  const handleDeleteUser = (userId: number, userName: string) => {
    setConfirmState({
      isOpen: true,
      title: 'حذف مستخدم',
      message: `هل أنت متأكد من حذف المستخدم "${userName}"؟`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
          if (res.ok) {
            fetchUsers();
          } else {
            alert('حدث خطأ أثناء حذف المستخدم');
          }
        } catch (error) {
          console.error('Failed to delete user', error);
          alert('حدث خطأ أثناء حذف المستخدم');
        }
      }
    });
  };

  const handleDeleteBranch = (branchId: number, branchName: string) => {
    setConfirmState({
      isOpen: true,
      title: 'حذف فرع',
      message: `هل أنت متأكد من حذف الفرع "${branchName}"؟ سيتم حذف جميع المبيعات، المخزون، والمستخدمين المرتبطين به نهائياً.`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/branches/${branchId}`, { method: 'DELETE' });
          if (res.ok) {
            onRefresh();
          } else {
            alert('حدث خطأ أثناء حذف الفرع');
          }
        } catch (error) {
          console.error('Failed to delete branch', error);
          alert('حدث خطأ أثناء حذف الفرع');
        }
      }
    });
  };

  useEffect(() => {
    const fetchReports = async () => {
      const reportsData: Record<number, ReportData> = {};
      
      for (const branch of displayBranches) {
        const data = await safeFetch<ReportData>(`/api/reports?branch_id=${branch.id}`);
        if (data) {
          reportsData[branch.id] = data;
        }
      }
      
      setReports(reportsData);
      setLoading(false);
    };

    if (branches.length > 0) {
      fetchReports();
      fetchUsers();
    }
  }, [branches]);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center bg-gray-50">جاري تحميل البيانات...</div>;
  }

  const reportsArray = Object.values(reports) as ReportData[];
  const totalSales = reportsArray.reduce((sum, r) => sum + (r.total_sales || 0), 0);
  const totalProfit = reportsArray.reduce((sum, r) => sum + (r.net_profit || 0), 0);
  const totalWaste = reportsArray.reduce((sum, r) => sum + (r.total_waste_qty || 0), 0);

  return (
    <div className="flex-1 bg-gray-50 overflow-y-auto p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Global Summary */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Building2 className="text-emerald-600" />
              {isBranchManager ? 'نظرة عامة على الفرع' : 'نظرة عامة على جميع الفروع'}
            </h2>
            {!isBranchManager && (
              <button
                onClick={() => setIsAddBranchModalOpen(true)}
                className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm"
              >
                <Plus size={20} />
                إضافة فرع جديد
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 font-medium">إجمالي المبيعات</h3>
                <div className="bg-emerald-100 p-3 rounded-xl">
                  <DollarSign className="text-emerald-600" size={24} />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-800">{totalSales.toFixed(2)} ج.م</p>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 font-medium">صافي الأرباح</h3>
                <div className="bg-blue-100 p-3 rounded-xl">
                  <TrendingUp className="text-blue-600" size={24} />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-800">{totalProfit.toFixed(2)} ج.م</p>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 font-medium">إجمالي الهالك</h3>
                <div className="bg-red-100 p-3 rounded-xl">
                  <AlertTriangle className="text-red-600" size={24} />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-800">{totalWaste.toFixed(2)} وحدة</p>
            </div>
          </div>
        </div>

        {/* Branch Reports */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            {isBranchManager ? 'تقرير الفرع' : 'تقارير الفروع'}
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {displayBranches.map(branch => {
              const report = reports[branch.id] || { total_sales: 0, net_profit: 0, total_waste_qty: 0 };
              
              return (
                <div key={branch.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-lg text-gray-800">{branch.name}</h3>
                      <p className="text-sm text-gray-500">{branch.location}</p>
                    </div>
                    {!isBranchManager && (
                      <button
                        onClick={() => handleDeleteBranch(branch.id, branch.name)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="حذف الفرع"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                        <span className="text-gray-600">المبيعات</span>
                        <span className="font-bold text-gray-800">{(report.total_sales || 0).toFixed(2)} ج.م</span>
                      </div>
                      <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                        <span className="text-gray-600">الأرباح</span>
                        <span className="font-bold text-emerald-600">{(report.net_profit || 0).toFixed(2)} ج.م</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">الهالك</span>
                        <span className="font-bold text-red-600">{(report.total_waste_qty || 0).toFixed(2)} وحدة</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Users Management */}
        {!isBranchManager && (
        <div className="mt-12">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Users className="text-emerald-600" />
              إدارة المستخدمين
            </h2>
            <button
              onClick={() => setIsAddUserModalOpen(true)}
              className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm"
            >
              <UserPlus size={20} />
              إضافة مستخدم جديد
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-right text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-4 font-medium">الاسم</th>
                  <th className="p-4 font-medium">رمز الدخول (PIN)</th>
                  <th className="p-4 font-medium">الصلاحية</th>
                  <th className="p-4 font-medium">الفرع</th>
                  <th className="p-4 font-medium w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="p-4 font-medium text-gray-800">{user.name}</td>
                    <td className="p-4 text-gray-500 font-mono tracking-widest">{user.pin}</td>
                    <td className="p-4">
                      {user.role === 'admin' ? (
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">مدير نظام</span>
                      ) : user.role === 'branch_manager' ? (
                        <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-medium">مدير فرع</span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-medium">كاشير</span>
                      )}
                    </td>
                    <td className="p-4 text-gray-500">{user.branch_name || 'الكل'}</td>
                    <td className="p-4">
                      {user.role !== 'admin' && (
                        <button
                          onClick={() => handleDeleteUser(user.id, user.name)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="حذف المستخدم"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                      {user.role === 'admin' && user.id !== currentUser.id && (
                        <button
                          onClick={() => handleDeleteUser(user.id, user.name)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="حذف الشريك"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">جاري تحميل المستخدمين...</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}

      </div>

      {!isBranchManager && (
      <AddBranchModal
        isOpen={isAddBranchModalOpen}
        onClose={() => setIsAddBranchModalOpen(false)}
        onSuccess={onRefresh}
      />
      )}

      {!isBranchManager && (
      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        branches={branches}
        onSuccess={fetchUsers}
      />
      )}

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
