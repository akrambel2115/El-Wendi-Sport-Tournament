import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface TournamentSettings {
  _id: Id<"tournament">;
  currentStage: string;
  startDate: string;
  endDate: string;
  settings: {
    teamsPerGroup: number;
    maxPlayersPerTeam: number;
    playerFeeAmount?: number;
  };
}

interface Group {
  _id: Id<"groups">;
  name: string;
  teams: Id<"teams">[];
  completed: boolean;
}

interface Team {
  _id: Id<"teams">;
  name: string;
  groupId?: string;
  stats: {
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    points: number;
  };
}

export function TournamentProgress() {
  const teams = useQuery(api.teams.list) || [];
  const tournament = useQuery(api.tournament.get);
  const groups = useQuery(api.tournament.listGroups) || [];
  const matches = useQuery(api.matches.list) || [];

  const saveTournament = useMutation(api.tournament.save);
  const updateStage = useMutation(api.tournament.updateStage);
  const createGroup = useMutation(api.tournament.createGroup);
  const completeGroup = useMutation(api.tournament.completeGroup);
  const deleteGroup = useMutation(api.tournament.deleteGroup);
  const assignTeamsToGroups = useMutation(api.tournament.assignTeamsToGroups);
  const syncGroupsAndTeams = useMutation(api.tournament.syncTeamsAndGroups);
  const syncTeamStats = useMutation(api.tournament.syncTeamStats);

  const [editingSettings, setEditingSettings] = useState(false);
  const [newSettings, setNewSettings] = useState<Omit<TournamentSettings, "_id">>({
    currentStage: "setup",
    startDate: "",
    endDate: "",
    settings: {
      teamsPerGroup: 4,
      maxPlayersPerTeam: 10,
    },
  });

  const [newGroup, setNewGroup] = useState({
    name: "",
    teams: [] as Id<"teams">[],
  });

  const [groupAssignments, setGroupAssignments] = useState<{
    [teamId: string]: Id<"groups"> | null;
  }>({});
  
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  // Add state for editing teams in a group
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [editingGroupTeams, setEditingGroupTeams] = useState<{
    [teamId: string]: boolean;
  }>({});

  // Load tournament settings if they exist
  useEffect(() => {
    if (tournament) {
      setNewSettings({
        currentStage: tournament.currentStage,
        startDate: tournament.startDate,
        endDate: tournament.endDate,
        settings: tournament.settings,
      });
    } else {
      // Set default dates if no tournament exists
      const today = new Date();
      const nextMonth = new Date();
      nextMonth.setMonth(today.getMonth() + 1);
      
      setNewSettings(prev => ({
        ...prev,
        startDate: today.toISOString().split("T")[0],
        endDate: nextMonth.toISOString().split("T")[0],
      }));
    }
  }, [tournament]);

  // Update initialization of group assignments to get the actual assigned groups
  useEffect(() => {
    // Skip this effect if teams or groups aren't loaded yet
    if (!teams.length || !groups.length) return;
    
    // Check if we already have assignments for all teams
    const hasAllAssignments = teams.every(team => 
      Object.keys(groupAssignments).includes(team._id)
    );
    
    // Skip this effect if we already have assignments for all teams
    if (hasAllAssignments && Object.keys(groupAssignments).length === teams.length) return;
    
    const newGroupAssignments: { [teamId: string]: Id<"groups"> | null } = {};
    
    teams.forEach((team) => {
      // First check if team has a groupId set
      if (team.groupId) {
        // Find the group by name
        const group = groups.find((g) => g.name === team.groupId);
        if (group) {
          newGroupAssignments[team._id] = group._id;
          return;
        }
      }
      
      // Then check if team is in a group's teams array
      const group = groups.find((g) => 
        g.teams.some((id) => id === team._id)
      );
      
      newGroupAssignments[team._id] = group?._id || null;
    });
    
    setGroupAssignments(newGroupAssignments);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams.length, groups.length]);

  const handleSaveSettings = async () => {
    try {
      await saveTournament({
        tournamentId: tournament?._id,
        currentStage: newSettings.currentStage,
        startDate: newSettings.startDate,
        endDate: newSettings.endDate,
        settings: newSettings.settings,
      });
      setEditingSettings(false);
    } catch (error) {
      console.error("Error saving tournament settings:", error);
    }
  };

  const handleCreateGroup = async () => {
    if (newGroup.name.trim() === "") return;
    
    try {
      await createGroup({
        name: newGroup.name,
        teams: newGroup.teams,
      });
      setNewGroup({ name: "", teams: [] });
    } catch (error) {
      console.error("Error creating group:", error);
    }
  };

  const handleCompleteGroup = async (groupId: Id<"groups">) => {
    try {
      await completeGroup({ groupId });
    } catch (error) {
      console.error("Error completing group:", error);
    }
  };

  const handleDeleteGroup = async (groupId: Id<"groups">) => {
    if (confirm("هل أنت متأكد من حذف هذه المجموعة؟")) {
      try {
        await deleteGroup({ groupId });
      } catch (error) {
        console.error("Error deleting group:", error);
      }
    }
  };

  const handleAssignTeams = async () => {
    const assignments = Object.entries(groupAssignments)
      .filter(([_, groupId]) => groupId !== null)
      .map(([teamId, groupId]) => ({
        teamId: teamId as Id<"teams">,
        groupId: groupId as Id<"groups">,
      }));
    
    try {
      await assignTeamsToGroups({ assignments });
    } catch (error) {
      console.error("Error assigning teams to groups:", error);
    }
  };

  const handleAdvanceStage = async () => {
    if (!tournament) return;
    
    const stages = ["setup", "group", "round16", "quarter", "semi", "final", "completed"];
    const currentIndex = stages.indexOf(tournament.currentStage);
    
    if (currentIndex < stages.length - 1) {
      try {
        await updateStage({
          tournamentId: tournament._id,
          newStage: stages[currentIndex + 1],
        });
      } catch (error) {
        console.error("Error advancing tournament stage:", error);
      }
    }
  };

  const getStageName = (stage: string) => {
    switch (stage) {
      case "setup": return "الإعداد";
      case "group": return "دور المجموعات";
      case "round16": return "دور الـ16";
      case "quarter": return "ربع النهائي";
      case "semi": return "نصف النهائي";
      case "final": return "النهائي";
      case "completed": return "اكتملت البطولة";
      default: return stage;
    }
  };

  // Memoize the getGroupTeams function to avoid recomputations
  const getGroupTeams = useMemo(() => {
    return (groupId: Id<"groups">) => {
      return teams.filter((team) => {
        // First check if team has a groupId field that matches the group name
        if (team.groupId && groups.find(g => g._id === groupId)?.name === team.groupId) {
          return true;
        }
        // Then check the assignments object
        return groupAssignments[team._id] === groupId;
      });
    };
  }, [teams, groups, groupAssignments]);

  // Memoize the getGroupMatches function to avoid recomputations
  const getGroupMatches = useMemo(() => {
    return (groupId: string) => {
      return matches.filter((match) => match.groupId === groupId);
    };
  }, [matches]);

  // Add a function to sync groups and teams
  const handleSyncGroupsAndTeams = async () => {
    try {
      const result = await syncGroupsAndTeams({});
      if (result.updates > 0) {
        // Notify the user that updates were made
        alert(`تم مزامنة ${result.updates} من الفرق والمجموعات`);
      } else {
        alert('البيانات متزامنة بالفعل');
      }
    } catch (error) {
      console.error("Error syncing groups and teams:", error);
      alert('حدث خطأ أثناء المزامنة');
    }
  };

  const handleSyncTeamStats = async () => {
    if (syncing) return;
    
    try {
      setSyncing(true);
      setSyncMessage("جاري مزامنة إحصائيات الفرق...");
      
      const result = await syncTeamStats({});
      
      if (result.success) {
        setSyncMessage(`تم مزامنة إحصائيات الفرق (${result.updatedTeams} تحديث)`);
        setTimeout(() => setSyncMessage(""), 3000);
      }
    } catch (error) {
      console.error("Error syncing team stats:", error);
      setSyncMessage("حدث خطأ أثناء مزامنة الإحصائيات");
      setTimeout(() => setSyncMessage(""), 3000);
    } finally {
      setSyncing(false);
    }
  };

  // Add handler for editing teams in a group
  const handleEditTeams = (group: Group) => {
    setEditingGroup(group);
    
    // Initialize the state with current team assignments
    const initialTeams: { [teamId: string]: boolean } = {};
    teams.forEach(team => {
      // Check if team is in this group
      const isInGroup = group.teams.includes(team._id as Id<"teams">) || 
                         (team.groupId && team.groupId === group.name);
      initialTeams[team._id] = isInGroup;
    });
    
    setEditingGroupTeams(initialTeams);
  };

  // Add handler for saving team changes
  const handleSaveTeamChanges = async () => {
    if (!editingGroup) return;
    
    try {
      // Prepare assignments array - only include teams being assigned to this group
      // Don't try to set null groupId as it's not accepted by the API
      const assignments = teams
        .filter(team => editingGroupTeams[team._id]) // Only include teams that should be in this group
        .map(team => ({
          teamId: team._id as Id<"teams">,
          groupId: editingGroup._id,
        }));
      
      // Show saving indicator
      setSyncMessage("جاري حفظ التغييرات...");
      
      // Save the changes
      await assignTeamsToGroups({ assignments });
      
      // Close the modal
      setEditingGroup(null);
      setEditingGroupTeams({});
      
      // Sync to ensure consistency
      await syncGroupsAndTeams({});
      
      // Show success message
      setSyncMessage("تم حفظ تغييرات المجموعة بنجاح");
      setTimeout(() => setSyncMessage(""), 3000);
    } catch (error) {
      console.error("Error updating group teams:", error);
      setSyncMessage("حدث خطأ أثناء حفظ التغييرات");
      setTimeout(() => setSyncMessage(""), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold">تقدم البطولة</h2>
        <p className="text-gray-600">إدارة مجموعات ومراحل البطولة</p>
      </div>

      {/* Actions Row */}
      <div className="flex flex-wrap gap-3 mb-4">
        <button
          onClick={handleSyncGroupsAndTeams}
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
        >
          مزامنة الفرق والمجموعات
        </button>
        <button
          onClick={handleSyncTeamStats}
          disabled={syncing}
          className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:bg-green-300"
        >
          {syncing ? "جاري المزامنة..." : "مزامنة إحصائيات الفرق"}
        </button>
        {syncMessage && (
          <span className={`px-3 py-2 rounded-md text-sm ${syncMessage.includes("خطأ") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
            {syncMessage}
          </span>
        )}
      </div>

      {/* Tournament Settings */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">إعدادات البطولة</h3>
          <button
            onClick={() => setEditingSettings(!editingSettings)}
            className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
          >
            {editingSettings ? "إلغاء" : "تعديل"}
          </button>
        </div>

        {editingSettings ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">تاريخ البداية</label>
                <input
                  type="date"
                  value={newSettings.startDate}
                  onChange={(e) =>
                    setNewSettings({ ...newSettings, startDate: e.target.value })
                  }
                  className="w-full p-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">تاريخ النهاية</label>
                <input
                  type="date"
                  value={newSettings.endDate}
                  onChange={(e) =>
                    setNewSettings({ ...newSettings, endDate: e.target.value })
                  }
                  className="w-full p-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">المرحلة الحالية</label>
                <select
                  value={newSettings.currentStage}
                  onChange={(e) =>
                    setNewSettings({
                      ...newSettings,
                      currentStage: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded-md"
                >
                  <option value="setup">الإعداد</option>
                  <option value="group">دور المجموعات</option>
                  <option value="round16">دور الـ16</option>
                  <option value="quarter">ربع النهائي</option>
                  <option value="semi">نصف النهائي</option>
                  <option value="final">النهائي</option>
                  <option value="completed">اكتملت البطولة</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">عدد الفرق لكل مجموعة</label>
                <input
                  type="number"
                  min="2"
                  max="8"
                  value={newSettings.settings.teamsPerGroup}
                  onChange={(e) =>
                    setNewSettings({
                      ...newSettings,
                      settings: {
                        ...newSettings.settings,
                        teamsPerGroup: parseInt(e.target.value) || 4,
                      },
                    })
                  }
                  className="w-full p-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">الحد الأقصى للاعبين في الفريق</label>
                <input
                  type="number"
                  min="5"
                  max="20"
                  value={newSettings.settings.maxPlayersPerTeam}
                  onChange={(e) =>
                    setNewSettings({
                      ...newSettings,
                      settings: {
                        ...newSettings.settings,
                        maxPlayersPerTeam: parseInt(e.target.value) || 10,
                      },
                    })
                  }
                  className="w-full p-2 border rounded-md"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSaveSettings}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
              >
                حفظ الإعدادات
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">المرحلة الحالية</p>
              <p className="font-medium">
                {tournament ? getStageName(tournament.currentStage) : "لم يتم الإعداد بعد"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">تاريخ البطولة</p>
              <p className="font-medium">
                {tournament
                  ? `${tournament.startDate} إلى ${tournament.endDate}`
                  : "لم يتم تحديده بعد"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">عدد الفرق لكل مجموعة</p>
              <p className="font-medium">
                {tournament?.settings.teamsPerGroup || "لم يتم تحديده"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">الحد الأقصى للاعبين في الفريق</p>
              <p className="font-medium">
                {tournament?.settings.maxPlayersPerTeam || "لم يتم تحديده"}
              </p>
            </div>
            {tournament && (
              <div className="col-span-2 mt-2">
                <button
                  onClick={handleAdvanceStage}
                  className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
                  disabled={tournament.currentStage === "completed"}
                >
                  الانتقال إلى المرحلة التالية
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Group Management */}
      {(!tournament || tournament.currentStage === "setup" || tournament.currentStage === "group") && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">إدارة المجموعات</h3>
          </div>

          {/* Create Group Form */}
          <div className="mb-4 p-4 bg-gray-50 rounded-md">
            <h4 className="font-medium mb-2">إنشاء مجموعة جديدة</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">اسم المجموعة</label>
                <input
                  type="text"
                  placeholder="اسم المجموعة (مثلاً: أ، ب، ج...)"
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                  className="w-full p-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">اختر الفرق</label>
                <div className="border rounded-md h-48 p-2 overflow-y-auto">
                  {teams.length === 0 ? (
                    <p className="text-sm text-gray-500">لا توجد فرق متاحة</p>
                  ) : (
                    <div className="space-y-2">
                      {teams.map(team => (
                        <div key={team._id} className="flex items-center">
                          <input
                            type="checkbox"
                            id={`team-${team._id}`}
                            checked={newGroup.teams.includes(team._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                // Add team to selection
                                setNewGroup({
                                  ...newGroup,
                                  teams: [...newGroup.teams, team._id]
                                });
                              } else {
                                // Remove team from selection
                                setNewGroup({
                                  ...newGroup,
                                  teams: newGroup.teams.filter(id => id !== team._id)
                                });
                              }
                            }}
                            className="ml-2"
                          />
                          <label htmlFor={`team-${team._id}`} className="text-sm cursor-pointer">
                            {team.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {newGroup.teams.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">تم اختيار {newGroup.teams.length} فريق</p>
                )}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleCreateGroup}
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                >
                  إنشاء المجموعة
                </button>
              </div>
            </div>
          </div>

          {/* Group List */}
          <div className="space-y-4">
            {groups.length === 0 ? (
              <p className="text-gray-500 text-center">لا توجد مجموعات حتى الآن</p>
            ) : (
              groups.map((group) => (
                <div
                  key={group._id}
                  className="border rounded-md overflow-hidden"
                >
                  <div className="bg-gray-100 p-3 flex justify-between items-center">
                    <h5 className="font-medium">المجموعة {group.name}</h5>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditTeams(group)}
                        className="text-sm bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 ml-2"
                      >
                        تعديل الفرق
                      </button>
                      {!group.completed && (
                        <button
                          onClick={() => handleCompleteGroup(group._id)}
                          className="text-sm bg-purple-500 text-white px-2 py-1 rounded hover:bg-purple-600 ml-2"
                        >
                          إنهاء مرحلة المجموعة
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteGroup(group._id)}
                        className="text-sm bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                      >
                        حذف المجموعة
                      </button>
                    </div>
                  </div>
                  <div className="p-3">
                    <div>
                      <h6 className="text-sm font-medium mb-1">الفرق:</h6>
                      {getGroupTeams(group._id).length > 0 ? (
                        <ul className="text-sm list-disc list-inside">
                          {getGroupTeams(group._id).map((team) => (
                            <li key={team._id}>{team.name}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500">لا توجد فرق في هذه المجموعة</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Team Assignment */}
      {(!tournament || tournament.currentStage === "setup") && groups.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-medium mb-4">توزيع الفرق على المجموعات</h3>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الفريق
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    المجموعة
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {teams.map((team) => (
                  <tr key={team._id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{team.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={groupAssignments[team._id] || ""}
                        onChange={(e) => {
                          setGroupAssignments({
                            ...groupAssignments,
                            [team._id]: e.target.value ? e.target.value as Id<"groups"> : null,
                          });
                        }}
                        className="p-2 border rounded-md"
                      >
                        <option value="">بدون مجموعة</option>
                        {groups.map((group) => (
                          <option key={group._id} value={group._id}>
                            المجموعة {group.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleAssignTeams}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              حفظ التوزيع
            </button>
          </div>
        </div>
      )}

      {/* Tournament Progress Visualization */}
      {tournament && tournament.currentStage !== "setup" && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-medium mb-4">تقدم البطولة</h3>
          
          <div className="flex justify-between items-center mb-6">
            {["group", "round16", "quarter", "semi", "final", "completed"].map((stage, index) => {
              // Pre-compute stage comparison for better readability and type safety
              const isCurrentStage = tournament?.currentStage === stage;
              const isCompleted = tournament?.currentStage === "completed";
              const isAfterCurrentStage = tournament?.currentStage && 
                ["group", "round16", "quarter", "semi", "final"].indexOf(tournament.currentStage) > 
                ["group", "round16", "quarter", "semi", "final"].indexOf(stage);
              
              return (
                <div 
                  key={stage}
                  className={`flex flex-col items-center ${index > 0 ? "mr-4" : ""}`}
                >
                  <div 
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium ${
                      isCurrentStage
                        ? "bg-blue-500 text-white"
                        : isCompleted || isAfterCurrentStage
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span className="text-xs mt-1">
                    {getStageName(stage)}
                  </span>
                </div>
              );
            })}
          </div>
          
          {/* Stage-specific UI elements would go here */}
          {tournament?.currentStage === "group" && (
            <div className="p-4 bg-blue-50 rounded-md">
              <p className="text-center font-medium">
                البطولة حالياً في مرحلة المجموعات. قم بجدولة المباريات وتسجيل النتائج.
              </p>
            </div>
          )}
          
          {tournament?.currentStage === "round16" && (
            <div className="p-4 bg-blue-50 rounded-md">
              <p className="text-center font-medium">
                البطولة حالياً في دور الـ16. الفرق المتأهلة من دور المجموعات تتنافس الآن.
              </p>
            </div>
          )}
          
          {/* Similar UI for other stages */}
        </div>
      )}

      {/* Modal for editing teams in a group */}
      {editingGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">تعديل فرق المجموعة {editingGroup.name}</h3>
            
            <div className="space-y-2 mb-6">
              {teams.map(team => (
                <div key={team._id} className="flex items-center p-2 border-b">
                  <input
                    type="checkbox"
                    id={`team-${team._id}`}
                    checked={editingGroupTeams[team._id] || false}
                    onChange={(e) => {
                      setEditingGroupTeams({
                        ...editingGroupTeams,
                        [team._id]: e.target.checked
                      });
                    }}
                    className="ml-3"
                  />
                  <label htmlFor={`team-${team._id}`} className="flex-1 cursor-pointer">
                    {team.name}
                  </label>
                </div>
              ))}
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setEditingGroup(null);
                  setEditingGroupTeams({});
                }}
                className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400 ml-2"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveTeamChanges}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                حفظ التغييرات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
