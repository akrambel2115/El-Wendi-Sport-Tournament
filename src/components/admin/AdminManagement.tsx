import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface Admin {
  _id: Id<"users">;
  username: string;
  role?: string;
  lastLogin?: string;
}

export function AdminManagement() {
  // Add loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<string | null>(null);
  
  // Use error handling with the query
  const adminsQuery = useQuery(api.admins.list) || [];
  console.log("Admins query result:", adminsQuery);
  
  // Safely access the admins data
  const admins = Array.isArray(adminsQuery) ? adminsQuery : [];
  
  const createAdmin = useMutation(api.admins.create);
  const removeAdmin = useMutation(api.admins.remove);
  const updatePassword = useMutation(api.admins.updatePassword);
  const updateRole = useMutation(api.admins.updateRole);

  // Set loading state based on query
  useEffect(() => {
    setIsLoading(adminsQuery === undefined);
    if (adminsQuery instanceof Error) {
      console.error("Error fetching admins:", adminsQuery);
      setQueryError(adminsQuery.message);
    }
  }, [adminsQuery]);

  const [newAdmin, setNewAdmin] = useState({
    username: "",
    password: "",
    role: "editor" // Default role
  });

  const [editAdmin, setEditAdmin] = useState<Admin | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState<Id<"users"> | null>(null);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess("");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newAdmin.username && newAdmin.password) {
      try {
        console.log("Creating admin:", newAdmin);
        // Actually create the admin in the database
        await createAdmin({
          username: newAdmin.username,
          password: newAdmin.password,
          role: newAdmin.role
        });

        // Reset form
        setNewAdmin({ username: "", password: "", role: "editor" });
        setError("");
        setSuccess("تم إنشاء المشرف بنجاح");
      } catch (err) {
        console.error("Error creating admin:", err);
        setError("حدث خطأ أثناء إنشاء المشرف");
      }
    }
  };

  const confirmRemoveAdmin = (adminId: Id<"users">) => {
    setAdminToDelete(adminId);
    setShowConfirmation(true);
  };

  const handleRemoveAdmin = async () => {
    if (!adminToDelete) return;
    
    try {
      console.log("Removing admin:", adminToDelete);
      // Actually delete the admin from the database
      await removeAdmin({ adminId: adminToDelete });
      setShowConfirmation(false);
      setAdminToDelete(null);
      setSuccess("تم حذف المشرف بنجاح");
    } catch (err) {
      console.error("Error removing admin:", err);
      setError("حدث خطأ أثناء حذف المشرف");
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAdmin || !newPassword) return;
    
    try {
      console.log("Updating password for admin:", editAdmin._id);
      // Actually update the password in the database
      await updatePassword({
        adminId: editAdmin._id,
        newPassword
      });
      
      setEditAdmin(null);
      setNewPassword("");
      setSuccess("تم تحديث كلمة المرور بنجاح");
    } catch (err) {
      console.error("Error updating password:", err);
      setError("حدث خطأ أثناء تحديث كلمة المرور");
    }
  };

  const handleUpdateRole = async (adminId: Id<"users">, newRole: string) => {
    try {
      console.log("Updating role for admin:", adminId, "to", newRole);
      // Actually update the role in the database
      await updateRole({
        adminId,
        newRole
      });
      
      setSuccess("تم تحديث دور المشرف بنجاح");
    } catch (err) {
      console.error("Error updating role:", err);
      setError("حدث خطأ أثناء تحديث دور المشرف");
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800";
      case "editor":
        return "bg-blue-100 text-blue-800";
      case "viewer":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold">إدارة المشرفين</h2>
        <p className="text-gray-600">إضافة، تعديل، أو حذف المشرفين</p>
      </div>

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}

      {queryError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          خطأ في تحميل بيانات المشرفين: {queryError}
        </div>
      )}

      {/* Add New Admin Form */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-medium mb-4">إضافة مشرف جديد</h3>
        <form onSubmit={handleCreateAdmin} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">اسم المستخدم</label>
              <input
                type="text"
                value={newAdmin.username}
                onChange={(e) => setNewAdmin({ ...newAdmin, username: e.target.value })}
                className="w-full p-2 border rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">كلمة المرور</label>
              <input
                type="password"
                value={newAdmin.password}
                onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                className="w-full p-2 border rounded-md"
                required
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">الدور</label>
            <select
              value={newAdmin.role}
              onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value })}
              className="w-full p-2 border rounded-md"
            >
              <option value="admin">مدير كامل</option>
              <option value="editor">محرر</option>
              <option value="viewer">مشاهد فقط</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              المدير الكامل: جميع الصلاحيات | المحرر: تعديل البيانات فقط | المشاهد: عرض البيانات فقط
            </p>
          </div>

          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
          >
            إضافة مشرف جديد
          </button>
        </form>
      </div>

      {/* Admins List */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-medium mb-4">قائمة المشرفين {isLoading ? "(جاري التحميل...)" : `(${admins.length})`}</h3>
        
        {isLoading ? (
          <div className="text-center py-4">
            <p>جاري تحميل بيانات المشرفين...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    اسم المستخدم
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الدور
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    آخر تسجيل دخول
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {admins.length > 0 ? (
                  admins.map((admin: any) => (
                    <tr key={admin._id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{admin.username}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={admin.role || 'editor'}
                          onChange={(e) => handleUpdateRole(admin._id, e.target.value)}
                          className={`px-2 py-1 text-xs leading-5 font-semibold rounded-full ${getRoleBadgeClass(admin.role || 'editor')}`}
                        >
                          <option value="admin">مدير كامل</option>
                          <option value="editor">محرر</option>
                          <option value="viewer">مشاهد فقط</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {admin.lastLogin || 'لم يسجل الدخول بعد'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button
                          className="text-indigo-600 hover:text-indigo-900 mx-2"
                          onClick={() => setEditAdmin(admin)}
                        >
                          تغيير كلمة المرور
                        </button>
                        <button
                          className="text-red-600 hover:text-red-900 mx-2"
                          onClick={() => confirmRemoveAdmin(admin._id)}
                        >
                          حذف
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                      {queryError ? 'حدث خطأ في تحميل البيانات' : 'لا يوجد مشرفين حتى الآن'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Change Password Modal */}
      {editAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">تغيير كلمة المرور</h3>
            <p className="mb-4">تغيير كلمة المرور للمشرف: <span className="font-bold">{editAdmin.username}</span></p>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">كلمة المرور الجديدة</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-2 border rounded-md"
                  required
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                >
                  تحديث
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditAdmin(null);
                    setNewPassword("");
                  }}
                  className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">تأكيد الحذف</h3>
            <p className="mb-4">هل أنت متأكد من حذف هذا المشرف؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={handleRemoveAdmin}
                className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
              >
                نعم، حذف
              </button>
              <button
                onClick={() => {
                  setShowConfirmation(false);
                  setAdminToDelete(null);
                }}
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Logs Section */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-medium mb-4">سجل النشاط</h3>
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-gray-500 italic text-center">سيتم عرض سجل النشاط هنا في التحديثات القادمة</p>
        </div>
      </div>
    </div>
  );
}
