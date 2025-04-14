import { useState } from "react";
import { TeamManagement } from "./TeamManagement";
import { MatchScheduling } from "./MatchScheduling";
import { TournamentProgress } from "./TournamentProgress";
import { StaffManagement } from "./StaffManagement";
import { Statistics } from "./Statistics";
import { AdminManagement } from "./AdminManagement";

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("teams");

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveTab("teams")}
          className={`px-4 py-2 rounded-lg ${
            activeTab === "teams"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 hover:bg-gray-300"
          }`}
        >
          إدارة الفرق
        </button>
        <button
          onClick={() => setActiveTab("matches")}
          className={`px-4 py-2 rounded-lg ${
            activeTab === "matches"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 hover:bg-gray-300"
          }`}
        >
          جدول المباريات
        </button>
        <button
          onClick={() => setActiveTab("tournament")}
          className={`px-4 py-2 rounded-lg ${
            activeTab === "tournament"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 hover:bg-gray-300"
          }`}
        >
          تقدم البطولة
        </button>
        <button
          onClick={() => setActiveTab("staff")}
          className={`px-4 py-2 rounded-lg ${
            activeTab === "staff"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 hover:bg-gray-300"
          }`}
        >
          إدارة الطاقم
        </button>
        <button
          onClick={() => setActiveTab("stats")}
          className={`px-4 py-2 rounded-lg ${
            activeTab === "stats"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 hover:bg-gray-300"
          }`}
        >
          الإحصائيات
        </button>
        <button
          onClick={() => setActiveTab("admins")}
          className={`px-4 py-2 rounded-lg ${
            activeTab === "admins"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 hover:bg-gray-300"
          }`}
        >
          إدارة المشرفين
        </button>
      </div>

      {/* Content Area */}
      <div className="bg-gray-50 p-6 rounded-lg">
        {activeTab === "teams" && <TeamManagement />}
        {activeTab === "matches" && <MatchScheduling />}
        {activeTab === "tournament" && <TournamentProgress />}
        {activeTab === "staff" && <StaffManagement />}
        {activeTab === "stats" && <Statistics />}
        {activeTab === "admins" && <AdminManagement />}
      </div>
    </div>
  );
}
