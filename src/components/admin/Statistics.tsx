import { useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

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

interface Match {
  _id: Id<"matches">;
  date: string;
  teamAId: Id<"teams">;
  teamBId: Id<"teams">;
  status: string;
  score?: {
    teamA: number;
    teamB: number;
  };
  events?: {
    type: string;
    playerId: string;
    teamId: Id<"teams">;
    minute: number;
  }[];
}

interface GroupedTeams {
  [key: string]: Team[];
}

interface PlayerGoals {
  name: string;
  goals: number;
  teamName: string;
}

interface PlayerCards {
  name: string;
  yellow: number;
  red: number;
  teamName: string;
}

export function Statistics() {
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [validating, setValidating] = useState(false);
  
  const teams = useQuery(api.teams.list) || [];
  const matches = useQuery(api.matches.list) || [];
  const tournamentGroups = useQuery(api.tournament.listGroups) || [];
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [displayMode, setDisplayMode] = useState<"byGroup" | "allTeams">("byGroup");
  const [showPrintView, setShowPrintView] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const syncTeamStats = useMutation(api.tournament.syncTeamStats);
  const validateTeamStats = useMutation(api.tournament.validateTeamStats);

  // Format the group data for display
  const formattedGroups = tournamentGroups.map(group => ({
    id: group.name,
    name: `المجموعة ${group.name}`
  }));
  
  // Add a "No Group" option for teams without a group
  const hasTeamsWithoutGroup = teams.some(team => !team.groupId);
  if (hasTeamsWithoutGroup) {
    formattedGroups.push({ id: "بدون مجموعة", name: "بدون مجموعة" });
  }

  // Get all unique group IDs - use this for backwards compatibility
  // with existing code that expects groups to be strings
  const groups = formattedGroups.map(group => group.id);

  // Improved logic to determine a team's group
  const getTeamGroup = (team: Team) => {
    // First check if team has a groupId field
    if (team.groupId) {
      return team.groupId;
    }
    
    // Check if team is in any group's teams array
    const group = tournamentGroups.find(g => 
      g.teams.some(id => id === team._id)
    );
    
    return group ? group.name : "بدون مجموعة";
  };

  // Group teams by their groupId with improved logic
  const groupedTeams: GroupedTeams = teams.reduce((acc: GroupedTeams, team: Team) => {
    const groupId = getTeamGroup(team);
    if (!acc[groupId]) {
      acc[groupId] = [];
    }
    acc[groupId].push(team);
    return acc;
  }, {});

  // Sort teams within each group by points, then goal difference, then goals scored
  Object.keys(groupedTeams).forEach(groupId => {
    groupedTeams[groupId].sort((a, b) => {
      // Sort by points
      if (b.stats.points !== a.stats.points) {
        return b.stats.points - a.stats.points;
      }
      
      // If points are equal, sort by goal difference
      const aGoalDiff = a.stats.goalsFor - a.stats.goalsAgainst;
      const bGoalDiff = b.stats.goalsFor - b.stats.goalsAgainst;
      if (bGoalDiff !== aGoalDiff) {
        return bGoalDiff - aGoalDiff;
      }
      
      // If goal difference is equal, sort by goals scored
      return b.stats.goalsFor - a.stats.goalsFor;
    });
  });

  // Calculate top goal scorers from match events
  const playerGoals: { [key: string]: PlayerGoals } = {};
  
  matches.forEach((match: Match) => {
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
  const topScorers = Object.values(playerGoals).sort((a, b) => b.goals - a.goals).slice(0, 10);

  // Calculate cards statistics
  const playerCards: { [key: string]: PlayerCards } = {};
  
  matches.forEach((match: Match) => {
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
  const mostCarded = Object.values(playerCards)
    .sort((a, b) => b.red !== a.red ? b.red - a.red : b.yellow - a.yellow)
    .slice(0, 10);

  // Calculate tournament stats
  const totalMatches = matches.length;
  const completedMatches = matches.filter(m => m.status === "completed").length;
  const totalGoals = matches.reduce((total, match) => {
    if (match.score) {
      return total + match.score.teamA + match.score.teamB;
    }
    return total;
  }, 0);
  
  const totalYellowCards = matches.reduce((total, match) => {
    if (match.events) {
      return total + match.events.filter(e => e.type === "yellowCard").length;
    }
    return total;
  }, 0);
  
  const totalRedCards = matches.reduce((total, match) => {
    if (match.events) {
      return total + match.events.filter(e => e.type === "redCard").length;
    }
    return total;
  }, 0);
  
  const averageGoalsPerMatch = completedMatches > 0 
    ? (totalGoals / completedMatches).toFixed(2) 
    : "0";

  // Function to handle print
  const handlePrint = () => {
    setShowPrintView(true);
    setTimeout(() => {
      window.print();
      setShowPrintView(false);
    }, 500);
  };

  // Prepare chart data for team points
  const teamPointsData = teams.map(team => ({
    name: team.name,
    value: team.stats.points
  })).sort((a, b) => b.value - a.value).slice(0, 10);

  // Prepare chart data for goal difference
  const goalDifferenceData = teams.map(team => ({
    name: team.name,
    value: team.stats.goalsFor - team.stats.goalsAgainst
  })).sort((a, b) => b.value - a.value).slice(0, 10);

  // Function to sync team statistics
  const handleSyncTeamStats = async () => {
    setSyncing(true);
    setSyncMessage("");
    
    try {
      const result = await syncTeamStats({});
      if (result.success) {
        setSyncMessage(`تم مزامنة إحصائيات الفرق (${result.updatedTeams} تحديث)`);
        setTimeout(() => setSyncMessage(""), 3000);
      }
    } catch (error) {
      console.error("Error syncing team stats:", error);
      setSyncMessage("حدث خطأ أثناء المزامنة");
    } finally {
      setSyncing(false);
    }
  };

  // Function to validate team statistics
  const handleValidateTeamStats = async () => {
    setValidating(true);
    setSyncMessage("");
    
    try {
      const result = await validateTeamStats({});
      if (result.inconsistenciesFound > 0) {
        setSyncMessage(`تم العثور على ${result.inconsistenciesFound} اختلافات في الإحصائيات`);
      } else {
        setSyncMessage("تم التحقق من الإحصائيات، كل شيء متطابق");
      }
      // Keep message visible longer for validation results
      setTimeout(() => setSyncMessage(""), 5000);
    } catch (error) {
      console.error("Error validating team stats:", error);
      setSyncMessage("حدث خطأ أثناء التحقق من الإحصائيات");
    } finally {
      setValidating(false);
    }
  };

  return (
    <div ref={printRef} className={`space-y-6 ${showPrintView ? 'print-view' : ''}`}>
      {/* Section Title and Print Button */}
      <div className="border-b pb-4 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">إحصائيات البطولة</h2>
          <p className="text-gray-600">ترتيب الفرق، الهدافين، واحصائيات عامة</p>
        </div>
        <div className="flex items-center space-x-3">
          {syncMessage && (
            <span className={`ml-3 px-3 py-1 rounded-md text-sm ${syncMessage.includes("خطأ") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
              {syncMessage}
            </span>
          )}
          <button
            onClick={handleValidateTeamStats}
            disabled={validating || syncing}
            className="bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600 disabled:bg-yellow-300 ml-2"
          >
            {validating ? "جاري التحقق..." : "التحقق من الإحصائيات"}
          </button>
          <button
            onClick={handleSyncTeamStats}
            disabled={syncing || validating}
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-blue-300 ml-3"
          >
            {syncing ? "جاري المزامنة..." : "مزامنة إحصائيات الفرق"}
          </button>
          <button 
            onClick={handlePrint}
            className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
          >
            طباعة الإحصائيات
          </button>
        </div>
      </div>

      {/* Tournament Summary Statistics */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-medium mb-4">ملخص البطولة</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <p className="text-gray-600 text-sm">عدد الفرق</p>
            <p className="text-3xl font-bold text-blue-600">{teams.length}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <p className="text-gray-600 text-sm">المباريات المنتهية</p>
            <p className="text-3xl font-bold text-green-600">{completedMatches} / {totalMatches}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg text-center">
            <p className="text-gray-600 text-sm">إجمالي الأهداف</p>
            <p className="text-3xl font-bold text-yellow-600">{totalGoals}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg text-center">
            <p className="text-gray-600 text-sm">معدل الأهداف</p>
            <p className="text-3xl font-bold text-purple-600">{averageGoalsPerMatch}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg text-center">
            <p className="text-gray-600 text-sm">البطاقات الصفراء</p>
            <p className="text-3xl font-bold text-yellow-500">{totalYellowCards}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg text-center">
            <p className="text-gray-600 text-sm">البطاقات الحمراء</p>
            <p className="text-3xl font-bold text-red-600">{totalRedCards}</p>
          </div>
        </div>
      </div>

      {/* Team Points Chart */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-medium mb-4">رسم بياني لنقاط الفرق (أفضل 10)</h3>
        <div className="h-64 w-full">
          <div className="flex h-full items-end">
            {teamPointsData.map((team, i) => (
              <div key={i} className="flex flex-col items-center mr-2 flex-grow" style={{ maxWidth: '80px' }}>
                <div 
                  className="bg-blue-500 w-full rounded-t-md transition-all duration-500 ease-in-out hover:bg-blue-600" 
                  style={{ height: `${(team.value / Math.max(...teamPointsData.map(t => t.value))) * 80}%` }}
                >
                  <span className="text-white text-center block py-1">{team.value}</span>
                </div>
                <span className="text-xs mt-2 text-gray-600 truncate w-full text-center" title={team.name}>
                  {team.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Goal Difference Chart */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-medium mb-4">رسم بياني لفارق الأهداف (أفضل 10)</h3>
        <div className="h-64 w-full">
          <div className="flex h-full items-center">
            {goalDifferenceData.map((team, i) => (
              <div key={i} className="flex flex-col items-center mr-2 flex-grow" style={{ maxWidth: '80px' }}>
                <div 
                  className={`w-full transition-all duration-500 ease-in-out ${team.value >= 0 ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`} 
                  style={{ 
                    height: `${Math.abs(team.value) / Math.max(...goalDifferenceData.map(t => Math.abs(t.value))) * 80}%`,
                    marginTop: team.value >= 0 ? 'auto' : '0',
                    marginBottom: team.value < 0 ? 'auto' : '0',
                    borderRadius: team.value >= 0 ? '0.375rem 0.375rem 0 0' : '0 0 0.375rem 0.375rem'
                  }}
                >
                  <span className="text-white text-center block py-1">{team.value}</span>
                </div>
                <span className="text-xs mt-2 text-gray-600 truncate w-full text-center" title={team.name}>
                  {team.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Group Standings */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 space-y-3 md:space-y-0">
          <h3 className="text-lg font-medium">ترتيب الفرق</h3>
          
          <div className="flex flex-col space-y-3 w-full md:w-auto md:flex-row md:space-y-0 md:space-x-4">
            {/* Display mode selector */}
            <div className="flex items-center">
              <span className="text-sm font-medium ml-2">طريقة العرض:</span>
              <div className="flex border rounded-md overflow-hidden">
                <button
                  onClick={() => setDisplayMode("byGroup")}
                  className={`px-3 py-1 text-sm ${
                    displayMode === "byGroup" 
                      ? "bg-blue-500 text-white" 
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  حسب المجموعات
                </button>
                <button
                  onClick={() => setDisplayMode("allTeams")}
                  className={`px-3 py-1 text-sm ${
                    displayMode === "allTeams" 
                      ? "bg-blue-500 text-white" 
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  كل الفرق معاً
                </button>
              </div>
            </div>
            
            {/* Group selector - shown only in byGroup mode */}
            {displayMode === "byGroup" && (
              <div className="flex items-center">
                <span className="text-sm font-medium ml-2">المجموعة:</span>
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="p-2 border rounded-md print:hidden"
                >
                  <option value="all">كل المجموعات</option>
                  {formattedGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
        
        {displayMode === "byGroup" ? (
          // Display by group
          (selectedGroup === "all" ? groups : [selectedGroup]).map((groupId) => (
            <div key={groupId} className="mb-6">
              <h4 className="text-md font-medium mb-2 bg-gray-100 p-2 rounded">
                {groupId === "بدون مجموعة" ? groupId : `المجموعة ${groupId}`}
              </h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        #
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الفريق
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        لعب
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        فاز
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        تعادل
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        خسر
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        له
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        عليه
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        +/-
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        نقاط
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {groupedTeams[groupId]?.map((team, index) => (
                      <tr key={team._id} className={index < 2 ? "bg-green-50" : ""}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium">
                          {team.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {team.stats.played}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                          {team.stats.won}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600">
                          {team.stats.drawn}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                          {team.stats.lost}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {team.stats.goalsFor}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {team.stats.goalsAgainst}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {team.stats.goalsFor - team.stats.goalsAgainst}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                          {team.stats.points}
                        </td>
                      </tr>
                    ))}
                    {(!groupedTeams[groupId] || groupedTeams[groupId].length === 0) && (
                      <tr>
                        <td colSpan={10} className="px-6 py-4 text-center text-gray-500">
                          لا توجد فرق في هذه المجموعة
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        ) : (
          // Display all teams in a single table
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الفريق
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    المجموعة
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    لعب
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    فاز
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    تعادل
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    خسر
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    له
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    عليه
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    +/-
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    نقاط
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {teams
                  .sort((a, b) => (b.stats.points || 0) - (a.stats.points || 0))
                  .map((team, index) => (
                    <tr key={team._id} className={index < 3 ? "bg-green-50" : ""}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">
                        {team.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {getTeamGroup(team) === "بدون مجموعة" ? "بدون مجموعة" : `المجموعة ${getTeamGroup(team)}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {team.stats.played}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                        {team.stats.won}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600">
                        {team.stats.drawn}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                        {team.stats.lost}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {team.stats.goalsFor}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {team.stats.goalsAgainst}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {team.stats.goalsFor - team.stats.goalsAgainst}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                        {team.stats.points}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Scorers */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-medium mb-4">الهدافون</h3>
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
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium">
                    {player.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {player.teamName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                    {player.goals}
                  </td>
                </tr>
              ))}
              {topScorers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                    لا يوجد هدافين حتى الآن
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cards Statistics */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-medium mb-4">إحصائيات البطاقات</h3>
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
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium">
                    {player.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
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
              {mostCarded.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    لا توجد بطاقات مسجلة حتى الآن
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add print-specific styling */}
      <style>
        {`
        @media print {
          body * {
            visibility: visible;
          }
          .print-view {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print:hidden {
            display: none !important;
          }
          .shadow-md {
            box-shadow: none !important;
          }
          .space-y-6 > * + * {
            margin-top: 1rem !important;
          }
          h2 {
            font-size: 24px !important;
          }
          h3 {
            font-size: 18px !important;
          }
          table {
            font-size: 12px !important;
          }
          .px-6 {
            padding-left: 0.75rem !important;
            padding-right: 0.75rem !important;
          }
          .py-4 {
            padding-top: 0.5rem !important;
            padding-bottom: 0.5rem !important;
          }
        }
        `}
      </style>
    </div>
  );
}
