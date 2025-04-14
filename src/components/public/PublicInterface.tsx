import { useState, useEffect } from "react";
import { SignInForm } from "../../SignInForm";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { MatchDetail } from "./MatchDetail";

export function PublicInterface() {
  const matches = useQuery(api.matches.list) || [];
  const teams = useQuery(api.teams.list) || [];
  const tournamentGroups = useQuery(api.tournament.listGroups) || [];
  const tournament = useQuery(api.tournament.get);
  const syncGroups = useMutation(api.tournament.syncTeamsAndGroups);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedMatchId, setSelectedMatchId] = useState<Id<"matches"> | null>(null);
  const [standingsDisplayMode, setStandingsDisplayMode] = useState<"byGroup" | "allTeams">("byGroup");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [syncing, setSyncing] = useState(false);

  // Auto-sync groups and teams when page loads
  useEffect(() => {
    if (teams && tournamentGroups) {
      handleSyncGroups(false);
    }
  }, [teams, tournamentGroups]);

  // Function to handle group syncing
  const handleSyncGroups = async (showAlert = true) => {
    if (syncing) return;
    
    try {
      setSyncing(true);
      const result = await syncGroups({});
      if (showAlert && result.updates > 0) {
        alert(`تم مزامنة المجموعات والفرق: ${result.updates} تحديثات`);
      }
    } catch (error) {
      console.error("Error syncing groups:", error);
      if (showAlert) {
        alert("حدث خطأ أثناء المزامنة");
      }
    } finally {
      setSyncing(false);
    }
  };

  // Helper function to get team name by ID
  const getTeamName = (teamId: Id<"teams">) => {
    const team = teams.find((t) => t._id === teamId);
    return team ? team.name : "فريق غير معروف";
  };

  // Format dates in Arabic
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return new Date(dateString).toLocaleDateString("ar-SA", options);
  };

  // Get upcoming matches (limit to 5)
  const upcomingMatches = matches
    .filter((match) => match.status !== "completed")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  // Get recent results (limit to 5)
  const recentResults = matches
    .filter((match) => match.status === "completed")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  // Get all upcoming matches for the matches tab
  const allUpcomingMatches = matches
    .filter((match) => match.status !== "completed")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Get all completed matches for the matches tab
  const allCompletedMatches = matches
    .filter((match) => match.status === "completed")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Get teams for a specific group
  const getTeamsForGroup = (groupName: string) => {
    return teams.filter(team => team.groupId === groupName || 
      (groupName === "بدون مجموعة" && !team.groupId));
  };

  // Improved logic to determine a team's group
  const getTeamGroup = (team: any) => {
    // First check if team has a groupId field
    if (team.groupId) {
      return team.groupId;
    }
    
    // Check if team is in any group's teams array
    const group = tournamentGroups.find(g => 
      g.teams.some((id: string) => id === team._id)
    );
    
    return group ? group.name : "بدون مجموعة";
  };

  // Group teams by their groupId with improved logic
  const groupedTeams = teams.reduce((acc: { [key: string]: any[] }, team) => {
    const groupId = getTeamGroup(team);
    if (!acc[groupId]) {
      acc[groupId] = [];
    }
    acc[groupId].push(team);
    return acc;
  }, {});

  // Sort teams within each group by points
  Object.keys(groupedTeams).forEach(groupId => {
    groupedTeams[groupId].sort((a, b) => {
      // Sort by points
      if ((b.stats?.points || 0) !== (a.stats?.points || 0)) {
        return (b.stats?.points || 0) - (a.stats?.points || 0);
      }
      
      // If points are equal, sort by goal difference
      const aGoalDiff = (a.stats?.goalsFor || 0) - (a.stats?.goalsAgainst || 0);
      const bGoalDiff = (b.stats?.goalsFor || 0) - (b.stats?.goalsAgainst || 0);
      if (bGoalDiff !== aGoalDiff) {
        return bGoalDiff - aGoalDiff;
      }
      
      // If goal difference is equal, sort by goals scored
      return (b.stats?.goalsFor || 0) - (a.stats?.goalsFor || 0);
    });
  });

  // Function to handle match click
  const handleMatchClick = (matchId: Id<"matches">) => {
    setSelectedMatchId(matchId);
  };

  return (
    <div className="bg-gradient-to-b from-blue-50 to-white min-h-screen">
      {/* Hero Section */}
      <div className="relative py-24 px-6 sm:px-0 overflow-hidden bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="absolute inset-0 bg-[url('/convex.svg')] opacity-10 bg-repeat-space"></div>
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="flex justify-center mb-6">
            <img 
              src="/el_wendi_sport.png" 
              alt="الوندي سبور" 
              className="h-32 md:h-40 w-auto"
            />
          </div>
          <h1 className="text-4xl md:text-4xl font-semibold mb-4">الوندي سبور</h1>
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">إحياء ذكرى المرحوم بشاشحية أحسن</h2>
          <p className="text-xl md:text-2xl font-medium mb-8">تحت شعار: لا للمخدرات</p>
          <div className="flex flex-wrap justify-center gap-8 mt-12">
            <div className="bg-white/20 backdrop-blur-sm p-6 rounded-lg">
              <div className="text-5xl font-bold">{teams.length}</div>
              <div className="text-lg mt-2">فريق مشارك</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm p-6 rounded-lg">
              <div className="text-5xl font-bold">{matches.length}</div>
              <div className="text-lg mt-2">مباراة</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm p-6 rounded-lg">
              <div className="text-5xl font-bold">{tournamentGroups.length}</div>
              <div className="text-lg mt-2">مجموعة</div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto">
          <nav className="flex overflow-x-auto whitespace-nowrap py-3 px-4">
            <button 
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 mx-2 font-medium rounded-md transition-colors ${activeTab === "overview" ? "bg-blue-100 text-blue-800" : "hover:bg-gray-100"}`}
            >
              نظرة عامة
            </button>
            <button 
              onClick={() => setActiveTab("matches")}
              className={`px-4 py-2 mx-2 font-medium rounded-md transition-colors ${activeTab === "matches" ? "bg-blue-100 text-blue-800" : "hover:bg-gray-100"}`}
            >
              المباريات
            </button>
            <button 
              onClick={() => setActiveTab("standings")}
              className={`px-4 py-2 mx-2 font-medium rounded-md transition-colors ${activeTab === "standings" ? "bg-blue-100 text-blue-800" : "hover:bg-gray-100"}`}
            >
              الترتيب
            </button>
            <button 
              onClick={() => setActiveTab("stats")}
              className={`px-4 py-2 mx-2 font-medium rounded-md transition-colors ${activeTab === "stats" ? "bg-blue-100 text-blue-800" : "hover:bg-gray-100"}`}
            >
              الإحصائيات
            </button>
            <button 
              onClick={() => setActiveTab("about")}
              className={`px-4 py-2 mx-2 font-medium rounded-md transition-colors ${activeTab === "about" ? "bg-blue-100 text-blue-800" : "hover:bg-gray-100"}`}
            >
              عن البطولة
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Upcoming Matches Section */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 text-white">
                <h2 className="text-2xl font-bold">المباريات القادمة</h2>
              </div>
              <div className="p-6">
                {upcomingMatches.length > 0 ? (
                  <div className="space-y-6">
                    {upcomingMatches.map((match) => (
                      <div 
                        key={match._id} 
                        className="border-b pb-4 last:border-0 last:pb-0 cursor-pointer hover:bg-blue-50 rounded-lg p-3 transition duration-150"
                        onClick={() => handleMatchClick(match._id)}
                      >
                        <div className="text-sm text-gray-500 mb-2">
                          {formatDate(match.date)} - {match.time}
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="font-semibold text-lg text-gray-800">{getTeamName(match.teamAId)}</div>
                          <div className="px-4 py-2 bg-gray-100 rounded-lg text-gray-800 font-bold">VS</div>
                          <div className="font-semibold text-lg text-gray-800">{getTeamName(match.teamBId)}</div>
                        </div>
                        <div className="mt-2 text-sm text-gray-600">
                          {match.stage === "group" && "دور المجموعات"}
                          {match.stage === "round16" && "دور الـ16"}
                          {match.stage === "quarter" && "ربع النهائي"}
                          {match.stage === "semi" && "نصف النهائي"}
                          {match.stage === "final" && "النهائي"}
                          {match.groupId && ` - المجموعة ${match.groupId}`}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">لا توجد مباريات قادمة حالياً</p>
                )}
                <div className="mt-4 text-center">
                  <button 
                    onClick={() => setActiveTab("matches")}
                    className="text-blue-600 font-medium hover:text-blue-800"
                  >
                    عرض كل المباريات
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Results Section */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 text-white">
                <h2 className="text-2xl font-bold">آخر النتائج</h2>
              </div>
              <div className="p-6">
                {recentResults.length > 0 ? (
                  <div className="space-y-6">
                    {recentResults.map((match) => (
                      <div 
                        key={match._id} 
                        className="border-b pb-4 last:border-0 last:pb-0 cursor-pointer hover:bg-green-50 rounded-lg p-3 transition duration-150"
                        onClick={() => handleMatchClick(match._id)}
                      >
                        <div className="text-sm text-gray-500 mb-2">
                          {formatDate(match.date)}
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="font-semibold text-lg">{getTeamName(match.teamAId)}</div>
                          <div className="px-4 py-2 bg-gray-100 rounded-lg font-bold">
                            {match.score ? `${match.score.teamA} - ${match.score.teamB}` : 'vs'}
                          </div>
                          <div className="font-semibold text-lg">{getTeamName(match.teamBId)}</div>
                        </div>
                        {match.manOfTheMatch && (
                          <div className="mt-2 text-sm text-gray-600 flex items-center">
                            <span className="mr-1">🏆</span>
                            <span>أفضل لاعب: {match.manOfTheMatch}</span>
                          </div>
                        )}
                        {match.events && match.events.length > 0 && (
                          <div className="mt-2 text-xs text-gray-600 grid grid-cols-2 gap-2">
                            {match.events
                              .filter(e => e.type === "goal")
                              .slice(0, 4)
                              .map((event, idx) => (
                                <div key={idx} className="flex items-center">
                                  <span className="ml-1">⚽</span>
                                  <span className="mr-1">{event.minute}'</span>
                                  <span>{event.playerId}</span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">لا توجد نتائج سابقة حالياً</p>
                )}
                <div className="mt-4 text-center">
                  <button 
                    onClick={() => setActiveTab("matches")}
                    className="text-green-600 font-medium hover:text-green-800"
                  >
                    عرض كل النتائج
                  </button>
                </div>
              </div>
            </div>

            {/* Team Standings Preview */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden lg:col-span-2">
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4 text-white flex justify-between items-center">
                <h2 className="text-2xl font-bold">ترتيب الفرق</h2>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => handleSyncGroups()}
                    disabled={syncing}
                    className="mr-4 ml-2 px-3 py-1 text-xs bg-white text-purple-600 rounded hover:bg-gray-100"
                    title="مزامنة المجموعات والفرق"
                  >
                    {syncing ? "جاري المزامنة..." : "مزامنة"}
                  </button>
                  <div className="flex items-center ml-4">
                    <span className="text-sm font-medium ml-2 text-white">طريقة العرض:</span>
                    <div className="flex border rounded-md overflow-hidden">
                      <button
                        onClick={() => setStandingsDisplayMode("byGroup")}
                        className={`px-3 py-1 text-sm ${
                          standingsDisplayMode === "byGroup" 
                            ? "bg-white text-purple-600" 
                            : "bg-purple-400 text-white hover:bg-purple-300"
                        }`}
                      >
                        حسب المجموعات
                      </button>
                      <button
                        onClick={() => setStandingsDisplayMode("allTeams")}
                        className={`px-3 py-1 text-sm ${
                          standingsDisplayMode === "allTeams" 
                            ? "bg-white text-purple-600" 
                            : "bg-purple-400 text-white hover:bg-purple-300"
                        }`}
                      >
                        كل الفرق معاً
                      </button>
                    </div>
                  </div>
                  
                  {/* Group selector - shown only in byGroup mode */}
                  {standingsDisplayMode === "byGroup" && (
                    <div className="flex items-center">
                      <span className="text-sm font-medium ml-2 text-white">المجموعة:</span>
                      <select
                        value={selectedGroup}
                        onChange={(e) => setSelectedGroup(e.target.value)}
                        className="p-1 text-sm border rounded-md text-gray-800 bg-white"
                      >
                        <option value="all">كل المجموعات</option>
                        {tournamentGroups && tournamentGroups.map((group) => (
                          <option key={group._id.toString()} value={group.name}>
                            {`المجموعة ${group.name}`}
                          </option>
                        ))}
                        {Object.keys(groupedTeams || {}).includes("بدون مجموعة") && (
                          <option value="بدون مجموعة">بدون مجموعة</option>
                        )}
                      </select>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-6 overflow-x-auto">
                {Object.keys(groupedTeams).length > 0 ? (
                  <div className="space-y-8">
                    {standingsDisplayMode === "byGroup" ? (
                      // Display by group with limited groups
                      (selectedGroup === "all" 
                        ? Object.keys(groupedTeams).slice(0, 2) 
                        : [selectedGroup]
                      ).map((groupId) => {
                        // Get teams for this group
                        const groupTeams = groupedTeams[groupId] || [];
                        return (
                        <div key={groupId}>
                          <h3 className="text-xl font-semibold mb-4">
                            {groupId === "بدون مجموعة" ? groupId : `المجموعة ${groupId}`}
                          </h3>
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  الترتيب
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  الفريق
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  لعب
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  فاز
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  تعادل
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  خسر
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  له
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  عليه
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  فارق
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  نقاط
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {groupTeams.length > 0 ? (
                                // Sort by points
                                [...groupTeams]
                                  .sort((a, b) => {
                                    // Sort by points
                                    if ((b.stats?.points || 0) !== (a.stats?.points || 0)) {
                                      return (b.stats?.points || 0) - (a.stats?.points || 0);
                                    }
                                    
                                    // If points are equal, sort by goal difference
                                    const aGoalDiff = (a.stats?.goalsFor || 0) - (a.stats?.goalsAgainst || 0);
                                    const bGoalDiff = (b.stats?.goalsFor || 0) - (b.stats?.goalsAgainst || 0);
                                    if (bGoalDiff !== aGoalDiff) {
                                      return bGoalDiff - aGoalDiff;
                                    }
                                    
                                    // If goal difference is equal, sort by goals scored
                                    return (b.stats?.goalsFor || 0) - (a.stats?.goalsFor || 0);
                                  })
                                  .map((team, index) => (
                                    <tr key={team._id} className={index < 2 ? 'bg-green-50' : (index % 2 === 0 ? 'bg-white' : 'bg-gray-50')}>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {index + 1}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {team.name}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {team.stats?.played || 0}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {team.stats?.won || 0}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {team.stats?.drawn || 0}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {team.stats?.lost || 0}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {team.stats?.goalsFor || 0}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {team.stats?.goalsAgainst || 0}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {(team.stats?.goalsFor || 0) - (team.stats?.goalsAgainst || 0)}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                        {team.stats?.points || 0}
                                      </td>
                                    </tr>
                                  ))
                              ) : (
                                <tr>
                                  <td colSpan={10} className="px-6 py-4 text-center text-gray-500">
                                    لا توجد فرق في هذه المجموعة حتى الآن
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        );
                      })
                    ) : (
                      // Display all teams in a single table with a preview of top teams
                      <div>
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                الترتيب
                              </th>
                              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                الفريق
                              </th>
                              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                المجموعة
                              </th>
                              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                لعب
                              </th>
                              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                فاز
                              </th>
                              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                تعادل
                              </th>
                              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                خسر
                              </th>
                              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                له
                              </th>
                              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                عليه
                              </th>
                              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                فارق
                              </th>
                              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                نقاط
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {teams.length > 0 ? (
                              // Sort by points
                              [...teams]
                                .sort((a, b) => {
                                  // Sort by points
                                  if ((b.stats?.points || 0) !== (a.stats?.points || 0)) {
                                    return (b.stats?.points || 0) - (a.stats?.points || 0);
                                  }
                                  
                                  // If points are equal, sort by goal difference
                                  const aGoalDiff = (a.stats?.goalsFor || 0) - (a.stats?.goalsAgainst || 0);
                                  const bGoalDiff = (b.stats?.goalsFor || 0) - (b.stats?.goalsAgainst || 0);
                                  if (bGoalDiff !== aGoalDiff) {
                                    return bGoalDiff - aGoalDiff;
                                  }
                                  
                                  // If goal difference is equal, sort by goals scored
                                  return (b.stats?.goalsFor || 0) - (a.stats?.goalsFor || 0);
                                })
                                .map((team, index) => (
                                  <tr key={team._id} className={index < 3 ? 'bg-green-50' : (index % 2 === 0 ? 'bg-white' : 'bg-gray-50')}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                      {index + 1}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                      {team.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {team.groupId === "بدون مجموعة" || !team.groupId ? "بدون مجموعة" : `المجموعة ${team.groupId}`}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {team.stats?.played || 0}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {team.stats?.won || 0}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {team.stats?.drawn || 0}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {team.stats?.lost || 0}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {team.stats?.goalsFor || 0}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {team.stats?.goalsAgainst || 0}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {(team.stats?.goalsFor || 0) - (team.stats?.goalsAgainst || 0)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                      {team.stats?.points || 0}
                                    </td>
                                  </tr>
                                ))
                            ) : (
                              <tr>
                                <td colSpan={10} className="px-6 py-4 text-center text-gray-500">
                                  لا توجد فرق في البطولة حتى الآن
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="text-center mt-4">
                      <button
                        onClick={() => setActiveTab("standings")}
                        className="text-purple-600 font-medium hover:text-purple-800"
                      >
                        عرض ترتيب جميع الفرق
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">لا توجد بيانات للفرق حالياً</p>
                )}
              </div>
            </div>

            {/* Top Scorers Section */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden lg:col-span-2">
              <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 px-6 py-4 text-white">
                <h2 className="text-2xl font-bold">الهدافون</h2>
              </div>
              <div className="p-6">
                {matches.length > 0 ? (
                  <div>
                    {/* Calculate top scorers */}
                    {(() => {
                      // Collect all goals from match events
                      const playerGoals: { [key: string]: { name: string; goals: number; teamName: string } } = {};
                      
                      matches.forEach(match => {
                        if (match.status === "completed" && match.events) {
                          match.events.forEach(event => {
                            if (event.type === "goal") {
                              const playerId = event.playerId;
                              const team = teams.find(t => t._id === event.teamId);
                              
                              if (!playerGoals[playerId]) {
                                playerGoals[playerId] = {
                                  name: playerId,
                                  goals: 0,
                                  teamName: team?.name || "غير معروف"
                                };
                              }
                              
                              playerGoals[playerId].goals += 1;
                            }
                          });
                        }
                      });
                      
                      // Convert to array and sort by goals
                      const topScorers = Object.values(playerGoals)
                        .sort((a, b) => b.goals - a.goals)
                        .slice(0, 5);
                      
                      if (topScorers.length > 0) {
                        return (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2">
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        #
                                      </th>
                                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        اللاعب
                                      </th>
                                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        الفريق
                                      </th>
                                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        الأهداف
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {topScorers.map((player, index) => (
                                      <tr key={index} className={index === 0 ? "bg-yellow-50" : ""}>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                          {index + 1}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                          {player.name}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                          {player.teamName}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                                            <span className="mr-1">⚽</span> {player.goals}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            
                            {/* Top Scorer Trophy Card */}
                            {topScorers.length > 0 && (
                              <div className="flex flex-col items-center justify-center bg-yellow-50 p-4 rounded-lg">
                                <div className="text-4xl mb-2">🏆</div>
                                <div className="text-xl font-bold text-center">{topScorers[0].name}</div>
                                <div className="text-sm text-gray-600 mb-2">{topScorers[0].teamName}</div>
                                <div className="flex items-center justify-center text-2xl font-bold text-yellow-600">
                                  <span className="mr-2">⚽</span> {topScorers[0].goals}
                                </div>
                                <div className="mt-2 text-xs text-center text-gray-500">الهداف الحالي</div>
                              </div>
                            )}
                          </div>
                        );
                      } else {
                        return (
                          <p className="text-gray-500 text-center py-4">لا توجد أهداف مسجلة حتى الآن</p>
                        );
                      }
                    })()}
                    
                    <div className="text-center mt-4">
                      <button
                        onClick={() => setActiveTab("stats")}
                        className="text-yellow-600 font-medium hover:text-yellow-800"
                      >
                        عرض كل الهدافين
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">لا توجد بيانات للمباريات حالياً</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Matches Tab */}
        {activeTab === "matches" && (
          <div className="space-y-12">
            {/* Upcoming Matches */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 text-white">
                <h2 className="text-2xl font-bold">المباريات القادمة</h2>
              </div>
              <div className="p-6">
                {allUpcomingMatches.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {allUpcomingMatches.map((match) => (
                      <div 
                        key={match._id} 
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer hover:bg-blue-50"
                        onClick={() => handleMatchClick(match._id)}
                      >
                        <div className="text-sm text-gray-500 mb-2">
                          {formatDate(match.date)} - {match.time}
                        </div>
                        <div className="flex flex-col items-center justify-center gap-2 my-4">
                          <div className="font-semibold text-lg text-center">{getTeamName(match.teamAId)}</div>
                          <div className="px-4 py-2 bg-gray-100 rounded-lg text-gray-800 font-bold">VS</div>
                          <div className="font-semibold text-lg text-center">{getTeamName(match.teamBId)}</div>
                        </div>
                        <div className="text-sm text-center text-gray-600 bg-blue-50 rounded-full py-1">
                          {match.stage === "group" && "دور المجموعات"}
                          {match.stage === "round16" && "دور الـ16"}
                          {match.stage === "quarter" && "ربع النهائي"}
                          {match.stage === "semi" && "نصف النهائي"}
                          {match.stage === "final" && "النهائي"}
                          {match.groupId && ` - المجموعة ${match.groupId}`}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">لا توجد مباريات قادمة حالياً</p>
                )}
              </div>
            </div>

            {/* Completed Matches */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 text-white">
                <h2 className="text-2xl font-bold">نتائج المباريات</h2>
              </div>
              <div className="p-6">
                {allCompletedMatches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {allCompletedMatches.map((match) => (
                      <div 
                        key={match._id} 
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer hover:bg-green-50"
                        onClick={() => handleMatchClick(match._id)}
                      >
                        <div className="text-sm text-gray-500 mb-2">
                          {formatDate(match.date)}
                        </div>
                        <div className="flex flex-col items-center gap-3 my-4">
                          <div className="flex justify-between items-center w-full">
                            <div className="font-semibold text-lg">{getTeamName(match.teamAId)}</div>
                            <div className="font-semibold text-lg">{match.score?.teamA || 0}</div>
                          </div>
                          <div className="flex justify-between items-center w-full">
                            <div className="font-semibold text-lg">{getTeamName(match.teamBId)}</div>
                            <div className="font-semibold text-lg">{match.score?.teamB || 0}</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-between items-center text-sm mt-3">
                          <div className="text-gray-600 bg-green-50 rounded-full px-3 py-1">
                            {match.stage === "group" && "دور المجموعات"}
                            {match.stage === "round16" && "دور الـ16"}
                            {match.stage === "quarter" && "ربع النهائي"}
                            {match.stage === "semi" && "نصف النهائي"}
                            {match.stage === "final" && "النهائي"}
                          </div>
                          {match.manOfTheMatch && (
                            <div className="flex items-center text-amber-700 mt-2 sm:mt-0">
                              <span className="mr-1">🏆</span>
                              <span className="text-xs">{match.manOfTheMatch}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">لا توجد نتائج مباريات حالياً</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Standings Tab */}
        {activeTab === "standings" && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4 text-white flex justify-between items-center">
              <h2 className="text-2xl font-bold">ترتيب الفرق</h2>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => handleSyncGroups()}
                  disabled={syncing}
                  className="mr-4 ml-2 px-3 py-1 text-xs bg-white text-purple-600 rounded hover:bg-gray-100"
                  title="مزامنة المجموعات والفرق"
                >
                  {syncing ? "جاري المزامنة..." : "مزامنة"}
                </button>
                <div className="flex items-center ml-4">
                  <span className="text-sm font-medium ml-2 text-white">طريقة العرض:</span>
                  <div className="flex border rounded-md overflow-hidden">
                    <button
                      onClick={() => setStandingsDisplayMode("byGroup")}
                      className={`px-3 py-1 text-sm ${
                        standingsDisplayMode === "byGroup" 
                          ? "bg-white text-purple-600" 
                          : "bg-purple-400 text-white hover:bg-purple-300"
                      }`}
                    >
                      حسب المجموعات
                    </button>
                    <button
                      onClick={() => setStandingsDisplayMode("allTeams")}
                      className={`px-3 py-1 text-sm ${
                        standingsDisplayMode === "allTeams" 
                          ? "bg-white text-purple-600" 
                          : "bg-purple-400 text-white hover:bg-purple-300"
                      }`}
                    >
                      كل الفرق معاً
                    </button>
                  </div>
                </div>
                
                {/* Group selector - shown only in byGroup mode */}
                {standingsDisplayMode === "byGroup" && (
                  <div className="flex items-center">
                    <span className="text-sm font-medium ml-2 text-white">المجموعة:</span>
                    <select
                      value={selectedGroup}
                      onChange={(e) => setSelectedGroup(e.target.value)}
                      className="p-1 text-sm border rounded-md text-gray-800 bg-white"
                    >
                      <option value="all">كل المجموعات</option>
                      {tournamentGroups && tournamentGroups.map((group) => (
                        <option key={group._id.toString()} value={group.name}>
                          {`المجموعة ${group.name}`}
                        </option>
                      ))}
                      {Object.keys(groupedTeams || {}).includes("بدون مجموعة") && (
                        <option value="بدون مجموعة">بدون مجموعة</option>
                      )}
                    </select>
                  </div>
                )}
              </div>
            </div>
            <div className="p-6">
              {Object.keys(groupedTeams).length > 0 ? (
                <div className="space-y-12">
                  {standingsDisplayMode === "byGroup" ? (
                    // Display by group
                    (selectedGroup === "all" ? Object.keys(groupedTeams) : [selectedGroup]).map((groupId) => {
                      // Get teams for this group
                      const groupTeams = groupedTeams[groupId] || [];
                      return (
                      <div key={groupId} className="overflow-x-auto">
                        <h3 className="text-xl font-semibold mb-4">
                          {groupId === "بدون مجموعة" ? groupId : `المجموعة ${groupId}`}
                        </h3>
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                الترتيب
                              </th>
                              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                الفريق
                              </th>
                              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                لعب
                              </th>
                              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                فاز
                              </th>
                              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                تعادل
                              </th>
                              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                خسر
                              </th>
                              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                له
                              </th>
                              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                عليه
                              </th>
                              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                فارق
                              </th>
                              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                نقاط
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {groupTeams.map((team, index) => (
                              <tr key={team._id} className={index < 2 ? 'bg-green-50' : (index % 2 === 0 ? 'bg-white' : 'bg-gray-50')}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {index + 1}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {team.name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {team.stats?.played || 0}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {team.stats?.won || 0}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {team.stats?.drawn || 0}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {team.stats?.lost || 0}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {team.stats?.goalsFor || 0}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {team.stats?.goalsAgainst || 0}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {(team.stats?.goalsFor || 0) - (team.stats?.goalsAgainst || 0)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                  {team.stats?.points || 0}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      );
                    })
                  ) : (
                    // Display all teams in a single table
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              الترتيب
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              الفريق
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              المجموعة
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              لعب
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              فاز
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              تعادل
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              خسر
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              له
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              عليه
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              فارق
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              نقاط
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {teams.length > 0 ? (
                            // Sort by points
                            [...teams]
                              .sort((a, b) => {
                                // Sort by points
                                if ((b.stats?.points || 0) !== (a.stats?.points || 0)) {
                                  return (b.stats?.points || 0) - (a.stats?.points || 0);
                                }
                                
                                // If points are equal, sort by goal difference
                                const aGoalDiff = (a.stats?.goalsFor || 0) - (a.stats?.goalsAgainst || 0);
                                const bGoalDiff = (b.stats?.goalsFor || 0) - (b.stats?.goalsAgainst || 0);
                                if (bGoalDiff !== aGoalDiff) {
                                  return bGoalDiff - aGoalDiff;
                                }
                                
                                // If goal difference is equal, sort by goals scored
                                return (b.stats?.goalsFor || 0) - (a.stats?.goalsFor || 0);
                              })
                              .map((team, index) => (
                                <tr key={team._id} className={index < 3 ? 'bg-green-50' : (index % 2 === 0 ? 'bg-white' : 'bg-gray-50')}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {index + 1}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {team.name}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {team.groupId === "بدون مجموعة" || !team.groupId ? "بدون مجموعة" : `المجموعة ${team.groupId}`}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {team.stats?.played || 0}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {team.stats?.won || 0}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {team.stats?.drawn || 0}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {team.stats?.lost || 0}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {team.stats?.goalsFor || 0}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {team.stats?.goalsAgainst || 0}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {(team.stats?.goalsFor || 0) - (team.stats?.goalsAgainst || 0)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                    {team.stats?.points || 0}
                                  </td>
                                </tr>
                              ))
                          ) : (
                            <tr>
                              <td colSpan={10} className="px-6 py-4 text-center text-gray-500">
                                لا توجد فرق في البطولة حتى الآن
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">لا توجد بيانات للفرق حالياً</p>
              )}
            </div>
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === "stats" && (
          <div className="space-y-8">
            {/* Tournament Summary Statistics */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 text-white">
                <h2 className="text-2xl font-bold">ملخص البطولة</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <p className="text-gray-600 text-sm">عدد الفرق</p>
                    <p className="text-3xl font-bold text-blue-600">{teams.length}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <p className="text-gray-600 text-sm">المباريات المنتهية</p>
                    <p className="text-3xl font-bold text-green-600">
                      {matches.filter(m => m.status === "completed").length} / {matches.length}
                    </p>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg text-center">
                    <p className="text-gray-600 text-sm">إجمالي الأهداف</p>
                    <p className="text-3xl font-bold text-yellow-600">
                      {matches.reduce((total, match) => {
                        if (match.score) {
                          return total + match.score.teamA + match.score.teamB;
                        }
                        return total;
                      }, 0)}
                    </p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg text-center">
                    <p className="text-gray-600 text-sm">معدل الأهداف</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {matches.filter(m => m.status === "completed").length > 0 
                        ? (matches.reduce((total, match) => {
                            if (match.score) {
                              return total + match.score.teamA + match.score.teamB;
                            }
                            return total;
                          }, 0) / matches.filter(m => m.status === "completed").length).toFixed(2)
                        : "0"}
                    </p>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg text-center">
                    <p className="text-gray-600 text-sm">البطاقات الصفراء</p>
                    <p className="text-3xl font-bold text-yellow-600">
                      {matches.reduce((total, match) => {
                        if (match.events) {
                          return total + match.events.filter(e => e.type === "yellowCard").length;
                        }
                        return total;
                      }, 0)}
                    </p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg text-center">
                    <p className="text-gray-600 text-sm">البطاقات الحمراء</p>
                    <p className="text-3xl font-bold text-red-600">
                      {matches.reduce((total, match) => {
                        if (match.events) {
                          return total + match.events.filter(e => e.type === "redCard").length;
                        }
                        return total;
                      }, 0)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Scorers */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 px-6 py-4 text-white">
                <h2 className="text-2xl font-bold">الهدافون</h2>
              </div>
              <div className="p-6">
                {(() => {
                  // Collect all goals from match events
                  const playerGoals: { [key: string]: { name: string; goals: number; teamName: string } } = {};
                  
                  matches.forEach(match => {
                    if (match.status === "completed" && match.events) {
                      match.events.forEach(event => {
                        if (event.type === "goal") {
                          const playerId = event.playerId;
                          const team = teams.find(t => t._id === event.teamId);
                          
                          if (!playerGoals[playerId]) {
                            playerGoals[playerId] = {
                              name: playerId,
                              goals: 0,
                              teamName: team?.name || "غير معروف"
                            };
                          }
                          
                          playerGoals[playerId].goals += 1;
                        }
                      });
                    }
                  });
                  
                  // Convert to array and sort by goals
                  const topScorers = Object.values(playerGoals).sort((a, b) => b.goals - a.goals);
                  
                  if (topScorers.length > 0) {
                    return (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                #
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                اللاعب
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                الفريق
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                الأهداف
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {topScorers.map((player, index) => (
                              <tr key={index} className={index < 3 ? "bg-yellow-50" : ""}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {index + 1}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {player.name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {player.teamName}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                                    <span className="mr-1">⚽</span> {player.goals}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  } else {
                    return (
                      <p className="text-gray-500 text-center py-4">لا توجد أهداف مسجلة حتى الآن</p>
                    );
                  }
                })()}
              </div>
            </div>

            {/* Cards Statistics */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 text-white">
                <h2 className="text-2xl font-bold">إحصائيات البطاقات</h2>
              </div>
              <div className="p-6">
                {(() => {
                  // Calculate cards statistics
                  const playerCards: { [key: string]: { name: string; yellow: number; red: number; teamName: string } } = {};
                  
                  matches.forEach(match => {
                    if (match.status === "completed" && match.events) {
                      match.events.forEach(event => {
                        if (event.type === "yellowCard" || event.type === "redCard") {
                          const playerId = event.playerId;
                          const team = teams.find(t => t._id === event.teamId);
                          
                          if (!playerCards[playerId]) {
                            playerCards[playerId] = {
                              name: playerId,
                              yellow: 0,
                              red: 0,
                              teamName: team?.name || "غير معروف"
                            };
                          }
                          
                          if (event.type === "yellowCard") {
                            playerCards[playerId].yellow += 1;
                          } else if (event.type === "redCard") {
                            playerCards[playerId].red += 1;
                          }
                        }
                      });
                    }
                  });
                  
                  // Convert to array and sort by red cards first, then yellow cards
                  const mostCarded = Object.values(playerCards).sort((a, b) => b.red !== a.red ? b.red - a.red : b.yellow - a.yellow);
                  
                  if (mostCarded.length > 0) {
                    return (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                #
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                اللاعب
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                الفريق
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                البطاقات الصفراء
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                البطاقات الحمراء
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {mostCarded.map((player, index) => (
                              <tr key={index} className={index < 3 ? "bg-red-50" : ""}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {index + 1}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {player.name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {player.teamName}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <span className="inline-block bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                                    {player.yellow}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <span className="inline-block bg-red-100 text-red-800 px-2 py-1 rounded-full">
                                    {player.red}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  } else {
                    return (
                      <p className="text-gray-500 text-center py-4">لا توجد بطاقات مسجلة حتى الآن</p>
                    );
                  }
                })()}
              </div>
            </div>
          </div>
        )}

        {/* About Tab */}
        {activeTab === "about" && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 text-white">
              <h2 className="text-2xl font-bold">عن البطولة</h2>
            </div>
            <div className="p-6">
              <div className="prose prose-lg max-w-none">
                <h3 className="text-xl font-bold mb-4">إحياء ذكرى المرحوم بشاشحية أحسن</h3>
                <p className="mb-4">
                  تقام هذه البطولة تكريماً لذكرى المرحوم بشاشحية أحسن، وهي فرصة للشباب للمشاركة في نشاط رياضي هادف تحت شعار "لا للمخدرات".
                </p>
                
                <div className="my-8 bg-amber-50 p-6 rounded-lg">
                  <h4 className="text-lg font-semibold mb-3">معلومات عن البطولة</h4>
                  <ul className="space-y-2">
                    <li><span className="font-medium">المنظم:</span> نادي الوندي سبور</li>
                    <li><span className="font-medium">عدد الفرق المشاركة:</span> {teams.length} فريق</li>
                    <li><span className="font-medium">عدد المجموعات:</span> {tournamentGroups.length} مجموعات</li>
                    <li><span className="font-medium">إجمالي عدد المباريات:</span> {matches.length} مباراة</li>
                    <li><span className="font-medium">نظام البطولة:</span> مجموعات + أدوار إقصائية</li>
                    {tournament?.startDate && (
                      <li>
                        <span className="font-medium">تاريخ البداية:</span> {formatDate(tournament.startDate)}
                      </li>
                    )}
                    {tournament?.endDate && (
                      <li>
                        <span className="font-medium">تاريخ النهاية المتوقع:</span> {formatDate(tournament.endDate)}
                      </li>
                    )}
                  </ul>
        </div>

                <h4 className="text-lg font-bold mb-3">الهدف من البطولة</h4>
                <p className="mb-4">
                  تهدف البطولة إلى:
                </p>
                <ul className="list-disc list-inside mb-6 space-y-2">
                  <li>تكريم ذكرى المرحوم بشاشحية أحسن</li>
                  <li>نشر الوعي بمخاطر المخدرات بين الشباب</li>
                  <li>تشجيع روح المنافسة الرياضية الشريفة</li>
                  <li>خلق فرصة للشباب للمشاركة في نشاط بدني وترفيهي هادف</li>
                </ul>
                
                <h4 className="text-lg font-bold mb-3">اللجنة المنظمة</h4>
                <p className="italic">
                  تم تنظيم هذه البطولة بواسطة نادي الوندي سبور بفضل جهود اللجنة المنظمة والمتطوعين الذين عملوا بجد لجعل هذا الحدث ممكناً.
            </p>
          </div>
            </div>
          </div>
        )}
        </div>

      {/* Admin access */}
      <div className="mt-16 bg-gray-100 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-lg mx-auto bg-white rounded-xl p-8 shadow-lg">
            <h2 className="text-2xl font-bold mb-6 text-center">تسجيل الدخول للمسؤولين</h2>
            <div className="mb-6">
              <p className="text-gray-600 text-center mb-4">فقط للمسؤولين المصرح لهم</p>
            </div>
            <SignInForm />
          </div>
        </div>
      </div>

      {/* Match Detail Modal */}
      {selectedMatchId && (
        <MatchDetail 
          matchId={selectedMatchId} 
          onClose={() => setSelectedMatchId(null)} 
        />
      )}
    </div>
  );
}
