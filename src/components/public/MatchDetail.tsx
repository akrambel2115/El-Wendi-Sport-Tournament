import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

type MatchDetailProps = {
  matchId: Id<"matches">;
  onClose: () => void;
};

export function MatchDetail({ matchId, onClose }: MatchDetailProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const match = useQuery(api.matches.get, { id: matchId });
  const teams = useQuery(api.teams.list) || [];

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // Prevent scrolling when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  if (!match) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <div className="text-center">جاري تحميل بيانات المباراة...</div>
        </div>
      </div>
    );
  }

  // Helper function to get team name by ID
  const getTeamName = (teamId: Id<"teams">) => {
    const team = teams.find((t) => t._id === teamId);
    return team ? team.name : "فريق غير معروف";
  };

  // Format dates in French style (DD-MM-YYYY)
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Sort events by minute
  const sortedEvents = match.events 
    ? [...match.events].sort((a, b) => a.minute - b.minute)
    : [];
    
  // Group events by half
  const firstHalfEvents = sortedEvents.filter(e => e.minute <= 45);
  const secondHalfEvents = sortedEvents.filter(e => e.minute > 45);

  // Count goals by team
  const teamAGoals = sortedEvents.filter(e => e.type === "goal" && e.teamId === match.teamAId).length;
  const teamBGoals = sortedEvents.filter(e => e.type === "goal" && e.teamId === match.teamBId).length;

  // Count cards by team
  const teamAYellowCards = sortedEvents.filter(e => e.type === "yellowCard" && e.teamId === match.teamAId).length;
  const teamARedCards = sortedEvents.filter(e => e.type === "redCard" && e.teamId === match.teamAId).length;
  const teamBYellowCards = sortedEvents.filter(e => e.type === "yellowCard" && e.teamId === match.teamBId).length;
  const teamBRedCards = sortedEvents.filter(e => e.type === "redCard" && e.teamId === match.teamBId).length;

  // Group scorers to remove duplicates
  const uniqueScorers = sortedEvents
    .filter(e => e.type === "goal")
    .reduce((acc, event) => {
      const key = `${event.playerId}-${event.teamId}`;
      if (!acc[key]) {
        acc[key] = {
          playerId: event.playerId,
          teamId: event.teamId,
          goals: 1,
          minutes: [event.minute]
        };
      } else {
        acc[key].goals += 1;
        acc[key].minutes.push(event.minute);
      }
      return acc;
    }, {} as Record<string, { playerId: string, teamId: Id<"teams">, goals: number, minutes: number[] }>);

  const uniqueScorersList = Object.values(uniqueScorers).sort((a, b) => b.goals - a.goals);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header with match info */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-t-lg relative">
          <button 
            onClick={onClose}
            className="absolute left-4 top-4 text-white hover:text-blue-200 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="text-center">
            <div className="text-sm mb-2">{formatDate(match.date)} - {match.time}</div>
            <div className="text-lg font-bold mb-4">
              {match.stage === "group" && "دور المجموعات"}
              {match.stage === "round16" && "دور الـ16"}
              {match.stage === "quarter" && "ربع النهائي"}
              {match.stage === "semi" && "نصف النهائي"}
              {match.stage === "final" && "النهائي"}
              {match.groupId && ` - المجموعة ${match.groupId}`}
            </div>
            
            {/* Teams and score */}
            <div className="flex justify-between items-center gap-4 mb-4">
              <div className="text-center flex-1">
                <div className="text-xl font-bold mb-2">{getTeamName(match.teamAId)}</div>
                {match.status === "completed" && (
                  <div className="text-3xl font-bold">
                    {match.score?.teamA || 0}
                  </div>
                )}
              </div>
              
              <div className="text-lg">
                {match.status === "completed" ? "النتيجة" : "VS"}
              </div>
              
              <div className="text-center flex-1">
                <div className="text-xl font-bold mb-2">{getTeamName(match.teamBId)}</div>
                {match.status === "completed" && (
                  <div className="text-3xl font-bold">
                    {match.score?.teamB || 0}
                  </div>
                )}
              </div>
            </div>
            
            {match.status === "completed" && match.manOfTheMatch && (
              <div className="mt-4 inline-block bg-yellow-400 text-blue-900 px-4 py-1 rounded-full text-sm font-bold">
                🏆 أفضل لاعب: {match.manOfTheMatch}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex-1 py-3 px-4 text-center font-medium ${
              activeTab === "overview" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            نظرة عامة
          </button>
          <button
            onClick={() => setActiveTab("events")}
            className={`flex-1 py-3 px-4 text-center font-medium ${
              activeTab === "events" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            الأحداث
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={`flex-1 py-3 px-4 text-center font-medium ${
              activeTab === "stats" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            الإحصائيات
          </button>
        </div>

        {/* Tab content */}
        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Match Summary */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-3">ملخص المباراة</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">الحالة:</span>
                      <span className={`font-medium ${match.status === "completed" ? "text-green-600" : "text-blue-600"}`}>
                        {match.status === "completed" ? "منتهية" : "قادمة"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">التاريخ:</span>
                      <span className="font-medium">{formatDate(match.date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">الوقت:</span>
                      <span className="font-medium">{match.time}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">المرحلة:</span>
                      <span className="font-medium">
                        {match.stage === "group" && "دور المجموعات"}
                        {match.stage === "round16" && "دور الـ16"}
                        {match.stage === "quarter" && "ربع النهائي"}
                        {match.stage === "semi" && "نصف النهائي"}
                        {match.stage === "final" && "النهائي"}
                      </span>
                    </div>
                    {match.referee && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">الحكم:</span>
                        <span className="font-medium">{match.referee}</span>
                      </div>
                    )}
                    {match.manOfTheMatch && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">أفضل لاعب:</span>
                        <span className="font-medium">{match.manOfTheMatch}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Match Stats */}
                {match.status === "completed" && match.events && match.events.length > 0 && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3">إحصائيات المباراة</h3>
                    
                    <div className="space-y-4">
                      {/* Goals */}
                      <div>
                        <div className="text-sm text-gray-500 mb-1">الأهداف</div>
                        <div className="flex items-center">
                          <div className="text-center w-10">{teamAGoals}</div>
                          <div className="flex-1 mx-2 bg-gray-200 h-2 rounded-full overflow-hidden">
                            <div 
                              className="bg-blue-500 h-full" 
                              style={{ width: `${teamAGoals + teamBGoals > 0 ? (teamAGoals / (teamAGoals + teamBGoals)) * 100 : 50}%` }} 
                            />
                          </div>
                          <div className="text-center w-10">{teamBGoals}</div>
                        </div>
                      </div>
                      
                      {/* Yellow Cards */}
                      <div>
                        <div className="text-sm text-gray-500 mb-1">بطاقات صفراء</div>
                        <div className="flex items-center">
                          <div className="text-center w-10">{teamAYellowCards}</div>
                          <div className="flex-1 mx-2 bg-gray-200 h-2 rounded-full overflow-hidden">
                            <div 
                              className="bg-yellow-400 h-full" 
                              style={{ width: `${teamAYellowCards + teamBYellowCards > 0 ? (teamAYellowCards / (teamAYellowCards + teamBYellowCards)) * 100 : 50}%` }} 
                            />
                          </div>
                          <div className="text-center w-10">{teamBYellowCards}</div>
                        </div>
                      </div>
                      
                      {/* Red Cards */}
                      <div>
                        <div className="text-sm text-gray-500 mb-1">بطاقات حمراء</div>
                        <div className="flex items-center">
                          <div className="text-center w-10">{teamARedCards}</div>
                          <div className="flex-1 mx-2 bg-gray-200 h-2 rounded-full overflow-hidden">
                            <div 
                              className="bg-red-500 h-full" 
                              style={{ width: `${teamARedCards + teamBRedCards > 0 ? (teamARedCards / (teamARedCards + teamBRedCards)) * 100 : 50}%` }} 
                            />
                          </div>
                          <div className="text-center w-10">{teamBRedCards}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Recent Goals */}
              {match.status === "completed" && sortedEvents.filter(e => e.type === "goal").length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-3">الأهداف</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="space-y-2">
                      {uniqueScorersList.map((scorer, index) => (
                        <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div className="flex items-center">
                            <span className="ml-2">⚽</span>
                            <span>{scorer.playerId}</span>
                            <span className="mr-2 text-gray-500">
                              ({scorer.teamId === match.teamAId ? getTeamName(match.teamAId) : getTeamName(match.teamBId)})
                              {scorer.goals > 1 && <span className="mr-1 font-medium"> × {scorer.goals}</span>}
                            </span>
                          </div>
                          <div className="bg-blue-100 text-blue-800 text-sm rounded-full px-2 py-1">
                            {scorer.minutes.join(', ')}'
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Events Tab */}
          {activeTab === "events" && (
            <div>
              {sortedEvents.length > 0 ? (
                <div className="space-y-6">
                  {/* First Half */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">الشوط الأول</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      {firstHalfEvents.length > 0 ? (
                        <div className="space-y-2">
                          {firstHalfEvents.map((event, index) => (
                            <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                              <div className="flex items-center">
                                {event.type === "goal" && <span className="ml-2">⚽</span>}
                                {event.type === "yellowCard" && <span className="ml-2">🟨</span>}
                                {event.type === "redCard" && <span className="ml-2">🟥</span>}
                                {event.type === "substitution" && <span className="ml-2">🔄</span>}
                                <span>{event.playerId}</span>
                                <span className="mr-2 text-gray-500">({event.teamId === match.teamAId ? getTeamName(match.teamAId) : getTeamName(match.teamBId)})</span>
                              </div>
                              <div className="bg-blue-100 text-blue-800 text-sm rounded-full px-2 py-1">
                                {event.minute}'
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center py-2">لا توجد أحداث في الشوط الأول</p>
                      )}
                    </div>
                  </div>

                  {/* Second Half */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">الشوط الثاني</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      {secondHalfEvents.length > 0 ? (
                        <div className="space-y-2">
                          {secondHalfEvents.map((event, index) => (
                            <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                              <div className="flex items-center">
                                {event.type === "goal" && <span className="ml-2">⚽</span>}
                                {event.type === "yellowCard" && <span className="ml-2">🟨</span>}
                                {event.type === "redCard" && <span className="ml-2">🟥</span>}
                                {event.type === "substitution" && <span className="ml-2">🔄</span>}
                                <span>{event.playerId}</span>
                                <span className="mr-2 text-gray-500">({event.teamId === match.teamAId ? getTeamName(match.teamAId) : getTeamName(match.teamBId)})</span>
                              </div>
                              <div className="bg-blue-100 text-blue-800 text-sm rounded-full px-2 py-1">
                                {event.minute}'
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center py-2">لا توجد أحداث في الشوط الثاني</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  {match.status === "completed" 
                    ? "لا توجد أحداث مسجلة لهذه المباراة" 
                    : "المباراة لم تبدأ بعد"}
                </div>
              )}
            </div>
          )}

          {/* Stats Tab */}
          {activeTab === "stats" && (
            <div>
              {match.status === "completed" ? (
                <div className="space-y-6">
                  {/* Scorers */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">الهدافين</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      {uniqueScorersList.length > 0 ? (
                        <div className="space-y-2">
                          {uniqueScorersList.map((scorer, index) => (
                            <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                              <div className="flex items-center">
                                <span className="ml-2">⚽</span>
                                <span>{scorer.playerId}</span>
                                <span className="mr-2 text-gray-500">
                                  ({scorer.teamId === match.teamAId ? getTeamName(match.teamAId) : getTeamName(match.teamBId)})
                                  {scorer.goals > 1 && <span className="mr-1 font-medium"> × {scorer.goals}</span>}
                                </span>
                              </div>
                              <div className="bg-blue-100 text-blue-800 text-sm rounded-full px-2 py-1">
                                {scorer.minutes.join(', ')}'
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center py-2">لا توجد أهداف في هذه المباراة</p>
                      )}
                    </div>
                  </div>

                  {/* Cards */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">البطاقات</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      {sortedEvents.filter(e => e.type === "yellowCard" || e.type === "redCard").length > 0 ? (
                        <div className="space-y-2">
                          {sortedEvents
                            .filter(e => e.type === "yellowCard" || e.type === "redCard")
                            .map((event, index) => (
                              <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                                <div className="flex items-center">
                                  {event.type === "yellowCard" && <span className="ml-2">🟨</span>}
                                  {event.type === "redCard" && <span className="ml-2">🟥</span>}
                                  <span>{event.playerId}</span>
                                  <span className="mr-2 text-gray-500">({event.teamId === match.teamAId ? getTeamName(match.teamAId) : getTeamName(match.teamBId)})</span>
                                </div>
                                <div className="bg-blue-100 text-blue-800 text-sm rounded-full px-2 py-1">
                                  {event.minute}'
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center py-2">لا توجد بطاقات في هذه المباراة</p>
                      )}
                    </div>
                  </div>

                  {/* Team Stats Comparison */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">إحصائيات الفريقين</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center font-medium">{getTeamName(match.teamAId)}</div>
                        <div className="text-center text-gray-500">الإحصائية</div>
                        <div className="text-center font-medium">{getTeamName(match.teamBId)}</div>

                        {/* Goals */}
                        <div className="text-center">{teamAGoals}</div>
                        <div className="text-center bg-blue-50 p-1 rounded">الأهداف</div>
                        <div className="text-center">{teamBGoals}</div>

                        {/* Yellow Cards */}
                        <div className="text-center">{teamAYellowCards}</div>
                        <div className="text-center bg-yellow-50 p-1 rounded">بطاقات صفراء</div>
                        <div className="text-center">{teamBYellowCards}</div>

                        {/* Red Cards */}
                        <div className="text-center">{teamARedCards}</div>
                        <div className="text-center bg-red-50 p-1 rounded">بطاقات حمراء</div>
                        <div className="text-center">{teamBRedCards}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  المباراة لم تبدأ بعد
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 