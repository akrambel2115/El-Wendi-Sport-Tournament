import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface Staff {
  _id: Id<"staff">;
  name: string;
  role: string;
  phone?: string;
  photoUrl?: string;
}

export function StaffManagement() {
  const staff = useQuery(api.staff.list) || [];
  const createStaff = useMutation(api.staff.addStaff);
  const updateStaff = useMutation(api.staff.updateStaffMember);
  const deleteStaff = useMutation(api.staff.remove);

  const [newStaff, setNewStaff] = useState({
    name: "",
    role: "referee",
    phone: "",
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    role: string;
    phone: string;
  }>({
    name: "",
    role: "referee",
    phone: "",
  });

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newStaff.name && newStaff.role) {
      await createStaff({
        name: newStaff.name,
        role: newStaff.role,
        phone: newStaff.phone || undefined,
        photoUrl: undefined,
      });
      
      setNewStaff({
        name: "",
        role: "referee",
        phone: "",
      });
    }
  };

  const startEditing = (member: Staff) => {
    setEditingId(member._id);
    setEditForm({
      name: member.name,
      role: member.role,
      phone: member.phone || "",
    });
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId && editForm.name && editForm.role) {
      await updateStaff({
        staffId: editingId as Id<"staff">,
        name: editForm.name,
        role: editForm.role,
        phone: editForm.phone || undefined,
      });
      
      setEditingId(null);
    }
  };

  const handleDeleteStaff = async (staffId: Id<"staff">) => {
    await deleteStaff({ staffId });
  };

  return (
    <div className="space-y-6">
      {/* Section Title */}
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold">إدارة الطاقم</h2>
        <p className="text-gray-600">إضافة وتعديل الحكام والطاقم الفني</p>
      </div>

      {/* Add Staff Form */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-medium mb-4">إضافة عضو جديد</h3>
        <form onSubmit={handleCreateStaff} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">الاسم</label>
              <input
                type="text"
                value={newStaff.name}
                onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                className="w-full p-2 border rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">الدور</label>
              <select
                value={newStaff.role}
                onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                className="w-full p-2 border rounded-md"
                required
              >
                <option value="referee">حكم</option>
                <option value="medical">طاقم طبي</option>
                <option value="security">أمن</option>
                <option value="organizer">منظم</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">رقم الهاتف</label>
              <input
                type="tel"
                value={newStaff.phone}
                onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                className="w-full p-2 border rounded-md"
              />
            </div>
          </div>

          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
          >
            إضافة
          </button>
        </form>
      </div>

      {/* Staff List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-medium">قائمة الطاقم ({staff.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الاسم
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الدور
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  رقم الهاتف
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {staff.map((member: Staff) => (
                <tr key={member._id}>
                  {editingId === member._id ? (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                          className="w-full p-2 border rounded-md"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={editForm.role}
                          onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                          className="w-full p-2 border rounded-md"
                        >
                          <option value="referee">حكم</option>
                          <option value="medical">طاقم طبي</option>
                          <option value="security">أمن</option>
                          <option value="organizer">منظم</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-2">
                          <input
                            type="tel"
                            value={editForm.phone}
                            onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                            className="w-full p-2 border rounded-md"
                            placeholder="رقم الهاتف"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={handleUpdateStaff}
                          className="bg-green-500 text-white px-2 py-1 rounded-md hover:bg-green-600 mx-1"
                        >
                          حفظ
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="bg-gray-500 text-white px-2 py-1 rounded-md hover:bg-gray-600 mx-1"
                        >
                          إلغاء
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium">{member.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            member.role === "referee"
                              ? "bg-blue-100 text-blue-800"
                              : member.role === "medical"
                              ? "bg-green-100 text-green-800"
                              : member.role === "security"
                              ? "bg-red-100 text-red-800"
                              : "bg-purple-100 text-purple-800"
                          }`}
                        >
                          {member.role === "referee" && "حكم"}
                          {member.role === "medical" && "طاقم طبي"}
                          {member.role === "security" && "أمن"}
                          {member.role === "organizer" && "منظم"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          {member.phone && <div>{member.phone}</div>}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => startEditing(member)}
                          className="text-blue-600 hover:text-blue-900 mx-1"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => handleDeleteStaff(member._id)}
                          className="text-red-600 hover:text-red-900 mx-1"
                        >
                          حذف
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
