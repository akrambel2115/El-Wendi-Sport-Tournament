import { useState, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useAction } from "convex/react";
import { useForm } from "react-hook-form";

interface MatchEvent {
  type: "goal" | "yellowCard" | "redCard";
  playerId: string;
  teamId: Id<"teams">;
  minute: number;
}

interface Score {
  teamA: number;
  teamB: number;
}

interface Match {
  _id: Id<"matches">;
  date: string;
  time: string;
  teamAId: Id<"teams">;
  teamBId: Id<"teams">;
  stage: string;
  groupId?: string;
  referees: Id<"staff">[];
  status: string;
  score?: Score;
  events?: MatchEvent[];
  manOfTheMatch?: string;
}

export function MatchScheduling() {
  const matches = useQuery(api.matches.list) || [];
  const teams = useQuery(api.teams.list) || [];
  const staff = useQuery(api.staff.list) || [];
  const groups = useQuery(api.tournament.listGroups) || [];
  
  const createMatch = useMutation(api.matches.create);
  const updateMatch = useMutation(api.matches.update);
  const deleteMatch = useMutation(api.matches.remove);
  const updateScore = useMutation(api.matches.updateScore);
  const recordMatchResult = useMutation(api.matches.recordMatchResult);

  const [newMatch, setNewMatch] = useState({
    date: "",
    time: "",
    teamAId: "",
    teamBId: "",
    stage: "group",
    groupId: "",
    referees: [] as Id<"staff">[],
    status: "scheduled" as const,
  });

  // Get all referee IDs when component mounts
  const allRefereeIds = useMemo(() => {
    return staff
      .filter(s => s.role === "referee")
      .map(referee => referee._id);
  }, [staff]);

  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [showAddMatchForm, setShowAddMatchForm] = useState(false);
  const [showEditMatchForm, setShowEditMatchForm] = useState(false);
  const [showResultForm, setShowResultForm] = useState(false);
  
  // New score and events for match results
  const [matchResult, setMatchResult] = useState({
    score: { teamA: 0, teamB: 0 },
    events: [] as MatchEvent[],
    manOfTheMatch: "",
  });

  const [newEvent, setNewEvent] = useState<MatchEvent>({
    type: "goal",
    playerId: "",
    teamId: "" as unknown as Id<"teams">,
    minute: 1,
  });

  // Handler to open the add match form
  const handleOpenAddMatchForm = () => {
    // Pre-select all referees by default
    setNewMatch({
      ...newMatch,
      referees: [...allRefereeIds]
    });
    setShowAddMatchForm(true);
  };

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      newMatch.date &&
      newMatch.time &&
      newMatch.teamAId &&
      newMatch.teamBId &&
      newMatch.referees.length > 0
    ) {
      await createMatch({
        date: newMatch.date,
        time: newMatch.time,
        teamAId: newMatch.teamAId as Id<"teams">,
        teamBId: newMatch.teamBId as Id<"teams">,
        stage: newMatch.stage,
        groupId: newMatch.groupId || undefined,
        referees: newMatch.referees,
        status: "scheduled",
      });
      
      // Reset form but keep referees selected
      setNewMatch({
        date: "",
        time: "",
        teamAId: "",
        teamBId: "",
        stage: "group",
        groupId: "",
        referees: [...allRefereeIds], // Keep all referees selected
        status: "scheduled",
      });
      
      setShowAddMatchForm(false);
    }
  };

  const handleAddEvent = () => {
    if (newEvent.playerId && newEvent.teamId) {
      setMatchResult({
        ...matchResult,
        events: [...matchResult.events, { ...newEvent }],
      });
      
      setNewEvent({
        type: "goal",
        playerId: "",
        teamId: "" as unknown as Id<"teams">,
        minute: 1,
      });
    }
  };

  const handleRemoveEvent = (index: number) => {
    const updatedEvents = [...matchResult.events];
    updatedEvents.splice(index, 1);
    setMatchResult({
      ...matchResult,
      events: updatedEvents,
    });
  };

  const handleSaveResult = async (data: any) => {
    try {
      if (!editingMatch?._id) {
        console.error("No match selected");
        alert("لم يتم تحديد مباراة");
        return;
      }
      
      const result = await recordMatchResult({
        matchId: editingMatch._id,
        teamAGoals: parseInt(data.teamAScore || matchResult.score.teamA),
        teamBGoals: parseInt(data.teamBScore || matchResult.score.teamB),
        events: matchResult.events,
        manOfTheMatch: matchResult.manOfTheMatch
      });
      
      console.log("Match result updated:", result);
      setShowResultForm(false);
      setEditingMatch(null);
      alert("تم تسجيل نتيجة المباراة بنجاح");
    } catch (error) {
      console.error("Error updating match result:", error);
      alert("حدث خطأ أثناء تسجيل نتيجة المباراة");
    }
  };

  const openResultForm = (match: any) => {
    console.log("Opening match form with data:", match);
    setEditingMatch(match as Match);
    setMatchResult({
      score: match.score || { teamA: 0, teamB: 0 },
      events: match.events || [],
      manOfTheMatch: match.manOfTheMatch || "",
    });
    setShowResultForm(true);
  };

  // Helper function to get team name by ID
  const getTeamName = (teamId: Id<"teams">) => {
    const team = teams.find((t) => t._id === teamId);
    return team ? team.name : "فريق غير معروف";
  };

  // Helper function to get staff name by ID
  const getStaffName = (staffId: Id<"staff">) => {
    const member = staff.find((s) => s._id === staffId);
    return member ? member.name : "غير معروف";
  };

  // Format dates in French style (DD-MM-YYYY)
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  return (
    <div className="space-y-6">
      {/* Section Title */}
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold">جدول المباريات</h2>
        <p className="text-gray-600">إدارة وجدولة المباريات وتسجيل النتائج</p>
      </div>

      {/* Add Match Button */}
      <div className="flex justify-end">
        <button
          onClick={handleOpenAddMatchForm}
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
        >
          إضافة مباراة جديدة
        </button>
      </div>

      {/* Add Match Form */}
      {showAddMatchForm && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-medium mb-4">إضافة مباراة جديدة</h3>
          <form onSubmit={handleCreateMatch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">التاريخ</label>
                <input
                  type="date"
                  value={newMatch.date}
                  onChange={(e) =>
                    setNewMatch({ ...newMatch, date: e.target.value })
                  }
                  className="w-full p-2 border rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">الوقت</label>
                <input
                  type="time"
                  value={newMatch.time}
                  onChange={(e) =>
                    setNewMatch({ ...newMatch, time: e.target.value })
                  }
                  className="w-full p-2 border rounded-md"
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">الفريق الأول</label>
                <select
                  value={newMatch.teamAId}
                  onChange={(e) =>
                    setNewMatch({ ...newMatch, teamAId: e.target.value })
                  }
                  className="w-full p-2 border rounded-md"
                  required
                >
                  <option value="">اختر الفريق</option>
                  {teams.map((team) => (
                    <option key={team._id} value={team._id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">الفريق الثاني</label>
                <select
                  value={newMatch.teamBId}
                  onChange={(e) =>
                    setNewMatch({ ...newMatch, teamBId: e.target.value })
                  }
                  className="w-full p-2 border rounded-md"
                  required
                >
                  <option value="">اختر الفريق</option>
                  {teams.map((team) => (
                    <option key={team._id} value={team._id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">المرحلة</label>
                <select
                  value={newMatch.stage}
                  onChange={(e) =>
                    setNewMatch({ ...newMatch, stage: e.target.value })
                  }
                  className="w-full p-2 border rounded-md"
                  required
                >
                  <option value="group">دور المجموعات</option>
                  <option value="round16">دور الـ16</option>
                  <option value="quarter">ربع النهائي</option>
                  <option value="semi">نصف النهائي</option>
                  <option value="final">النهائي</option>
                </select>
              </div>
              {newMatch.stage === "group" && (
                <div>
                  <label className="block text-sm font-medium mb-1">المجموعة</label>
                  <select
                    value={newMatch.groupId}
                    onChange={(e) =>
                      setNewMatch({ ...newMatch, groupId: e.target.value })
                    }
                    className="w-full p-2 border rounded-md"
                    required
                  >
                    <option value="">اختر المجموعة</option>
                    {groups.map((group) => (
                      <option key={group._id} value={group.name}>
                        المجموعة {group.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">الحكام</label>
              <div className="border rounded-md p-2 h-40 overflow-y-auto">
                {staff
                  .filter((s) => s.role === "referee")
                  .map((referee) => (
                    <div key={referee._id} className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        id={referee._id}
                        checked={newMatch.referees.includes(referee._id)}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setNewMatch({
                            ...newMatch,
                            referees: isChecked
                              ? [...newMatch.referees, referee._id]
                              : newMatch.referees.filter((id) => id !== referee._id),
                          });
                        }}
                        className="mr-2"
                      />
                      <label htmlFor={referee._id} className="text-sm">
                        {referee.name} 
                        {referee.availability && referee.availability.length > 0 && (
                          <span className="text-xs text-gray-500 mr-2">
                            (متاح: {referee.availability.join(", ")})
                          </span>
                        )}
                      </label>
                    </div>
                  ))}
                {staff.filter((s) => s.role === "referee").length === 0 && (
                  <p className="text-sm text-gray-500">
                    لا يوجد حكام متاحين. يرجى إضافة حكام من صفحة إدارة الطاقم.
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">يجب اختيار حكم واحد على الأقل</p>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="submit"
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
              >
                إضافة المباراة
              </button>
              <button
                type="button"
                onClick={() => setShowAddMatchForm(false)}
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Match Result Form */}
      {showResultForm && editingMatch && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-medium mb-4">تسجيل نتيجة المباراة</h3>
          <div className="mb-6">
            <p className="font-semibold mb-2">
              {getTeamName(editingMatch.teamAId)} vs {getTeamName(editingMatch.teamBId)}
            </p>
            <p className="text-sm text-gray-600">
              {formatDate(editingMatch.date)} - {editingMatch.time}
            </p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">النتيجة</label>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <span className="font-medium">{getTeamName(editingMatch.teamAId)}</span>
                  <input
                    type="number"
                    min="0"
                    value={matchResult.score.teamA}
                    onChange={(e) =>
                      setMatchResult({
                        ...matchResult,
                        score: {
                          ...matchResult.score,
                          teamA: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                    className="w-16 p-2 border rounded-md"
                  />
                </div>
                <span className="text-xl font-bold">-</span>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="0"
                    value={matchResult.score.teamB}
                    onChange={(e) =>
                      setMatchResult({
                        ...matchResult,
                        score: {
                          ...matchResult.score,
                          teamB: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                    className="w-16 p-2 border rounded-md"
                  />
                  <span className="font-medium">{getTeamName(editingMatch.teamBId)}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">أفضل لاعب في المباراة</label>
              <input
                type="text"
                value={matchResult.manOfTheMatch}
                onChange={(e) =>
                  setMatchResult({
                    ...matchResult,
                    manOfTheMatch: e.target.value,
                  })
                }
                className="w-full p-2 border rounded-md"
                placeholder="اسم اللاعب"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">الأحداث</label>
              {/* Events List */}
              {matchResult.events.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {matchResult.events.map((event, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center border-b py-2"
                    >
                      <div className="flex items-center">
                        <span className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full mr-2">
                          {event.minute}'
                        </span>
                        <span>
                          {event.type === "goal" && "⚽ هدف"}
                          {event.type === "yellowCard" && "🟨 إنذار"}
                          {event.type === "redCard" && "🟥 طرد"}
                        </span>
                        <span className="mx-2">-</span>
                        <span>{event.playerId}</span>
                        <span className="mx-2">({getTeamName(event.teamId)})</span>
                      </div>
                      <button
                        onClick={() => handleRemoveEvent(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        حذف
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 mb-4">لا توجد أحداث مسجلة</p>
              )}

              {/* Add Event Form */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-3">إضافة حدث جديد</h4>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">النوع</label>
                    <select
                      value={newEvent.type}
                      onChange={(e) =>
                        setNewEvent({
                          ...newEvent,
                          type: e.target.value as "goal" | "yellowCard" | "redCard",
                        })
                      }
                      className="w-full p-2 text-sm border rounded-md"
                    >
                      <option value="goal">هدف</option>
                      <option value="yellowCard">إنذار</option>
                      <option value="redCard">طرد</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">الفريق</label>
                    <select
                      value={newEvent.teamId.toString()}
                      onChange={(e) =>
                        setNewEvent({
                          ...newEvent,
                          teamId: e.target.value as unknown as Id<"teams">,
                        })
                      }
                      className="w-full p-2 text-sm border rounded-md"
                    >
                      <option value="">اختر الفريق</option>
                      <option value={editingMatch.teamAId.toString()}>
                        {getTeamName(editingMatch.teamAId)}
                      </option>
                      <option value={editingMatch.teamBId.toString()}>
                        {getTeamName(editingMatch.teamBId)}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">اللاعب</label>
                    <input
                      type="text"
                      value={newEvent.playerId}
                      onChange={(e) =>
                        setNewEvent({
                          ...newEvent,
                          playerId: e.target.value,
                        })
                      }
                      className="w-full p-2 text-sm border rounded-md"
                      placeholder="اسم اللاعب"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddEvent}
                  className="bg-green-500 text-white px-3 py-1 text-sm rounded-md hover:bg-green-600"
                >
                  إضافة الحدث
                </button>
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                type="button"
                onClick={() => handleSaveResult(matchResult)}
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 ml-2"
              >
                حفظ النتيجة
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResultForm(false);
                  setEditingMatch(null);
                }}
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Matches List */}
      <div className="mt-8">
        <h3 className="text-lg font-medium mb-4">قائمة المباريات ({matches.length})</h3>
        
        {matches.length === 0 ? (
          <div className="bg-white p-6 text-center rounded-lg shadow-md">
            <p className="text-gray-500">لم يتم إضافة أي مباريات بعد.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Upcoming Matches */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-blue-50 p-4 border-b">
                <h4 className="font-bold">المباريات القادمة</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        التاريخ والوقت
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        المباراة
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        المرحلة
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الحكام
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الإجراءات
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {matches
                      .filter((match) => match.status !== "completed")
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                      .map((match) => (
                        <tr key={match._id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm">
                              {formatDate(match.date)}
                            </div>
                            <div className="text-sm text-gray-500">
                              {match.time}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-4">
                              <span className="font-medium">{getTeamName(match.teamAId)}</span>
                              <span className="text-gray-500">vs</span>
                              <span className="font-medium">{getTeamName(match.teamBId)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                              {match.stage === "group" && "دور المجموعات"}
                              {match.stage === "round16" && "دور الـ16"}
                              {match.stage === "quarter" && "ربع النهائي"}
                              {match.stage === "semi" && "نصف النهائي"}
                              {match.stage === "final" && "النهائي"}
                              {match.groupId && ` - المجموعة ${match.groupId}`}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm">
                              {match.referees
                                .map((refId) => getStaffName(refId))
                                .join(", ")}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => openResultForm(match)}
                              className="text-blue-600 hover:text-blue-900 mx-1"
                            >
                              تسجيل النتيجة
                            </button>
                            <button
                              onClick={() => deleteMatch({ matchId: match._id })}
                              className="text-red-600 hover:text-red-900 mx-1"
                            >
                              حذف
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Completed Matches */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-green-50 p-4 border-b">
                <h4 className="font-bold">المباريات المنتهية</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        التاريخ
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        المباراة
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        النتيجة
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الأحداث
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        أفضل لاعب
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        المرحلة
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الإجراءات
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {matches
                      .filter((match) => match.status === "completed")
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((match) => {
                        console.log("Completed match:", match._id, "has events:", match.events ? match.events.length : 0);
                        return (
                          <tr key={match._id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm">
                                {formatDate(match.date)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-4">
                                <span className="font-medium">{getTeamName(match.teamAId)}</span>
                                <span className="text-gray-500">vs</span>
                                <span className="font-medium">{getTeamName(match.teamBId)}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {match.score ? (
                                <div className="font-bold">
                                  {match.score.teamA} - {match.score.teamB}
                                </div>
                              ) : (
                                <span className="text-gray-500">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {match.events && match.events.length > 0 ? (
                                <div className="text-xs text-gray-600">
                                  <ul className="space-y-1">
                                    {match.events.map((event, idx) => (
                                      <li key={idx} className="flex items-center">
                                        <span className="mr-1">{event.minute}'</span>
                                        <span className="mr-1">
                                          {event.type === "goal" && "⚽"}
                                          {event.type === "yellowCard" && "🟨"}
                                          {event.type === "redCard" && "🟥"}
                                        </span>
                                        <span className="mr-1">{event.playerId}</span>
                                        <span className="text-gray-500">({getTeamName(event.teamId)})</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : (
                                <span className="text-gray-500">لا يوجد أحداث</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {match.manOfTheMatch ? (
                                <div className="text-sm font-medium flex items-center">
                                  <span className="ml-1">🏆</span>
                                  <span>{match.manOfTheMatch}</span>
                                </div>
                              ) : (
                                <span className="text-gray-500 text-sm">غير محدد</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                                {match.stage === "group" && "دور المجموعات"}
                                {match.stage === "round16" && "دور الـ16"}
                                {match.stage === "quarter" && "ربع النهائي"}
                                {match.stage === "semi" && "نصف النهائي"}
                                {match.stage === "final" && "النهائي"}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <button
                                onClick={() => openResultForm(match)}
                                className="text-yellow-600 hover:text-yellow-900 mx-1"
                              >
                                تعديل النتيجة
                              </button>
                              <button
                                onClick={() => deleteMatch({ matchId: match._id })}
                                className="text-red-600 hover:text-red-900 mx-1"
                              >
                                حذف
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
