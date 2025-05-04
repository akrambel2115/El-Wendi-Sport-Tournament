import { useState, useEffect } from "react";
import { SignInForm } from "../../SignInForm";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { MatchDetail } from "./MatchDetail";

export function PublicInterface() {
  const matches = useQuery(api.matches.list) || [];
  const upcomingMatchesData = useQuery(api.matches.getUpcoming) || [];
  const teams = useQuery(api.teams.list) || [];
  const tournamentGroups = useQuery(api.tournament.listGroups) || [];
  const tournament = useQuery(api.tournament.get);
  const syncGroups = useMutation(api.tournament.syncTeamsAndGroups);
  const syncTeamStats = useMutation(api.tournament.syncTeamStats);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedMatchId, setSelectedMatchId] = useState<Id<"matches"> | null>(null);
  const [standingsDisplayMode, setStandingsDisplayMode] = useState<"byGroup" | "allTeams">("byGroup");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [syncing, setSyncing] = useState(false);
  const [syncingStats, setSyncingStats] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  // State for screenshot modal
  const [screenshotGroup, setScreenshotGroup] = useState<string | null>(null);
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);
  // Add new states to track orientation
  const [originalOrientation, setOriginalOrientation] = useState<string | null>(null);

  // Auto-sync groups and teams when page loads
  useEffect(() => {
    if (teams && tournamentGroups) {
      handleSyncGroups(false);
      
      // Also sync team stats when page loads
      handleSyncTeamStats();
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

  // Function to handle team stats synchronization
  const handleSyncTeamStats = async () => {
    if (syncingStats) return;
    
    try {
      setSyncingStats(true);
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
      setSyncingStats(false);
    }
  };

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

  // Get upcoming matches (limit to 5)
  const upcomingMatches = upcomingMatchesData.slice(0, 5);

  // Get recent results (limit to 5)
  const recentResults = matches
    .filter((match) => match.status === "completed")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  // Get all upcoming matches for the matches tab
  const allUpcomingMatches = upcomingMatchesData;

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

  // Add this function to identify the best third-place teams
  const getThirdPlaceTeams = () => {
    // Collect all third-place teams from each group
    const thirdPlaceTeams: {groupId: string, team: any}[] = [];
    
    Object.keys(groupedTeams).forEach(groupId => {
      if (groupedTeams[groupId].length >= 3) {
        thirdPlaceTeams.push({
          groupId,
          team: groupedTeams[groupId][2] // 3rd place (index 2)
        });
      }
    });
    
    // Sort third-place teams by points, goal difference, then goals scored
    thirdPlaceTeams.sort((a, b) => {
      if ((b.team.stats?.points || 0) !== (a.team.stats?.points || 0)) {
        return (b.team.stats?.points || 0) - (a.team.stats?.points || 0);
      }
      
      const aGoalDiff = (a.team.stats?.goalsFor || 0) - (a.team.stats?.goalsAgainst || 0);
      const bGoalDiff = (b.team.stats?.goalsFor || 0) - (b.team.stats?.goalsAgainst || 0);
      if (bGoalDiff !== aGoalDiff) {
        return bGoalDiff - aGoalDiff;
      }
      
      return (b.team.stats?.goalsFor || 0) - (a.team.stats?.goalsFor || 0);
    });
    
    // Return the IDs of the best two third-place teams
    return thirdPlaceTeams.slice(0, 2).map(item => item.team._id);
  };

  // Get the best two third-place teams
  const bestThirdPlaceTeamIds = getThirdPlaceTeams();

  // Function to handle match click
  const handleMatchClick = (matchId: Id<"matches">) => {
    setSelectedMatchId(matchId);
  };
  
  // Function to handle screenshot button click
  const handleScreenshotClick = (groupId: string) => {
    // Save current orientation before changing it
    if (window.screen && 'orientation' in window.screen) {
      setOriginalOrientation((window.screen.orientation as any).type);
      
      // Try to lock to landscape if on mobile
      if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        try {
          // Use type assertion for the Screen Orientation API
          (window.screen.orientation as any).lock('landscape').catch((error: Error) => {
            console.error("Failed to lock screen orientation:", error);
          });
        } catch (error: unknown) {
          console.error("Screen Orientation API not supported:", error);
        }
      }
    }
    
    setScreenshotGroup(groupId);
    setShowScreenshotModal(true);
  };
  
  // Function to handle closing the screenshot modal
  const handleCloseScreenshotModal = () => {
    // Return to original orientation if we changed it
    if (originalOrientation && window.screen && 'orientation' in window.screen) {
      try {
        // Use type assertion for the Screen Orientation API
        (window.screen.orientation as any).unlock();
        
        // Some devices/browsers need an explicit return to the original orientation
        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
          // Force a small delay for iOS devices
          setTimeout(() => {
            (window.screen.orientation as any).unlock();
          }, 300);
        }
      } catch (error: unknown) {
        console.error("Error unlocking screen orientation:", error);
      }
    }
    
    setShowScreenshotModal(false);
    setScreenshotGroup(null);
  };

  function html2canvas(element: HTMLElement, arg1: { backgroundColor: string; scale: number; }) {
    throw new Error("Function not implemented.");
  }

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
                        <div key={groupId} className="overflow-x-auto">
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold">
                              {groupId === "بدون مجموعة" ? groupId : `المجموعة ${groupId}`}
                            </h3>
                            <button
                              onClick={() => handleScreenshotClick(groupId)}
                              className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                            >
                              لقطة شاشة
                            </button>
                          </div>
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
                                    <tr 
                                      key={team._id} 
                                      className={
                                        index < 2 ? "bg-green-100" : 
                                        bestThirdPlaceTeamIds.includes(team._id) ? "bg-green-100" : 
                                        "bg-red-50"
                                      }
                                    >
                                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-center border-r">
                                        {index + 1}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center border-r">
                                        {team.name}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-r font-semibold">
                                        {team.stats?.played || 0}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-r font-semibold text-green-600">
                                        {team.stats?.won || 0}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-r font-semibold text-yellow-600">
                                        {team.stats?.drawn || 0}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-r font-semibold text-red-600">
                                        {team.stats?.lost || 0}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-r font-semibold text-blue-600">
                                        {team.stats?.goalsFor || 0}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-r font-semibold text-blue-600">
                                        {team.stats?.goalsAgainst || 0}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-r font-semibold">
                                        {(team.stats?.goalsFor || 0) - (team.stats?.goalsAgainst || 0)}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-center text-blue-800 text-lg">
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
                      // Group matches by player and team to avoid counting duplicate events
                      const playerMatchGoals: { [key: string]: Set<string> } = {}; // key: playerId-teamId, value: Set of matchIds
                      
                      // Collect all goals from match events with deduplication
                      const playerGoals: { [key: string]: { name: string; goals: number; teamName: string; matchIds: Set<string> } } = {};
                      
                      matches.forEach(match => {
                        if (match.status === "completed" && match.events) {
                          const goalEvents = match.events.filter(event => event.type === "goal");
                          
                          // Group goal events by player-team in this match
                          const matchPlayerGoals: { [key: string]: { playerId: string, teamId: string, count: number } } = {};
                          
                          goalEvents.forEach(event => {
                            // Normalize player name by converting to lowercase
                            const normalizedName = event.playerId.toLowerCase().trim();
                            const key = `${normalizedName}-${event.teamId}`;
                            
                            if (!matchPlayerGoals[key]) {
                              matchPlayerGoals[key] = { 
                                playerId: event.playerId, 
                                teamId: event.teamId, 
                                count: 0 
                              };
                            }
                            matchPlayerGoals[key].count++;
                          });
                          
                          // Add goals to global counter
                          Object.entries(matchPlayerGoals).forEach(([key, data]) => {
                            const { playerId, teamId, count } = data;
                            const team = teams.find(t => t._id === teamId);
                            
                            // Use normalized name as key
                            const normalizedName = playerId.toLowerCase().trim();
                            
                            if (!playerGoals[normalizedName]) {
                              playerGoals[normalizedName] = {
                                name: playerId, // Keep original case for display
                                goals: 0,
                                teamName: team?.name || "غير معروف",
                                matchIds: new Set()
                              };
                            }
                            
                            playerGoals[normalizedName].goals += count;
                            playerGoals[normalizedName].matchIds.add(match._id);
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
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold">ترتيب الفرق</h2>
              </div>
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                <div>
                  {syncMessage && (
                    <span className={`px-3 py-1 rounded-md text-sm bg-white/20 backdrop-blur-sm inline-block mb-2 md:mb-0`}>
                      {syncMessage}
                    </span>
                  )}
                  <button
                    onClick={handleSyncTeamStats}
                    disabled={syncingStats}
                    className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-md mr-4 mb-2 md:mb-0 text-sm disabled:opacity-50"
                  >
                    {syncingStats ? "جاري المزامنة..." : "مزامنة الإحصائيات"}
                  </button>
                </div>
                {/* Display mode selector */}
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                  <div className="flex items-center">
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
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-xl font-semibold">
                            {groupId === "بدون مجموعة" ? groupId : `المجموعة ${groupId}`}
                          </h3>
                          <button
                            onClick={() => handleScreenshotClick(groupId)}
                            className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                          >
                            لقطة شاشة
                          </button>
                        </div>
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
                              <tr 
                                key={team._id} 
                                className={
                                  index < 2 ? "bg-green-100" : 
                                  bestThirdPlaceTeamIds.includes(team._id) ? "bg-green-100" : 
                                  "bg-red-50"
                                }
                              >
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-center border-r">
                                  {index + 1}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center border-r">
                                  {team.name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-r font-semibold">
                                  {team.stats?.played || 0}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-r font-semibold text-green-600">
                                  {team.stats?.won || 0}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-r font-semibold text-yellow-600">
                                  {team.stats?.drawn || 0}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-r font-semibold text-red-600">
                                  {team.stats?.lost || 0}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-r font-semibold text-blue-600">
                                  {team.stats?.goalsFor || 0}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-r font-semibold text-blue-600">
                                  {team.stats?.goalsAgainst || 0}
                                </td>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm text-center border-r font-bold ${
                                  ((team.stats?.goalsFor || 0) - (team.stats?.goalsAgainst || 0)) > 0 
                                    ? 'text-green-600' 
                                    : ((team.stats?.goalsFor || 0) - (team.stats?.goalsAgainst || 0)) < 0 
                                      ? 'text-red-600' 
                                      : 'text-gray-600'
                                }`}>
                                  {(team.stats?.goalsFor || 0) - (team.stats?.goalsAgainst || 0)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-center text-blue-800 text-lg">
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
                  // Group matches by player and team to avoid counting duplicate events
                  const playerMatchGoals: { [key: string]: Set<string> } = {}; // key: playerId-teamId, value: Set of matchIds
                  
                  // Collect all goals from match events with deduplication
                  const playerGoals: { [key: string]: { name: string; goals: number; teamName: string; matchIds: Set<string> } } = {};
                  
                  matches.forEach(match => {
                    if (match.status === "completed" && match.events) {
                      const goalEvents = match.events.filter(event => event.type === "goal");
                          
                      // Group goal events by player-team in this match
                      const matchPlayerGoals: { [key: string]: { playerId: string, teamId: string, count: number } } = {};
                      
                      goalEvents.forEach(event => {
                        // Normalize player name by converting to lowercase
                        const normalizedName = event.playerId.toLowerCase().trim();
                        const key = `${normalizedName}-${event.teamId}`;
                        
                        if (!matchPlayerGoals[key]) {
                          matchPlayerGoals[key] = { 
                            playerId: event.playerId, 
                            teamId: event.teamId, 
                            count: 0 
                          };
                        }
                        matchPlayerGoals[key].count++;
                      });
                      
                      // Add goals to global counter
                      Object.entries(matchPlayerGoals).forEach(([key, data]) => {
                        const { playerId, teamId, count } = data;
                        const team = teams.find(t => t._id === teamId);
                        
                        // Use normalized name as key
                        const normalizedName = playerId.toLowerCase().trim();
                        
                        if (!playerGoals[normalizedName]) {
                          playerGoals[normalizedName] = {
                            name: playerId, // Keep original case for display
                            goals: 0,
                            teamName: team?.name || "غير معروف",
                            matchIds: new Set()
                          };
                        }
                        
                        playerGoals[normalizedName].goals += count;
                        playerGoals[normalizedName].matchIds.add(match._id);
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
                <p className="italic mb-4">
                  تم تنظيم هذه البطولة بفضل ابن الأستاذ المرحوم بشاشحية أحسن السيد بشاشحية معتز و جهود اللجنة المنظمة والمتطوعين الذين عملوا بجد لجعل هذا الحدث ممكناً.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div className="bg-blue-50 rounded-lg p-4 shadow text-center transition-transform hover:scale-105">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-blue-600 text-xl font-bold">ب.م</span>
                    </div>
                    <h5 className="font-bold text-blue-800">بشاشحية معتز</h5>
                    <p className="text-blue-600 text-sm">منظم</p>
                  </div>
                  
                  <div className="bg-green-50 rounded-lg p-4 shadow text-center transition-transform hover:scale-105">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-green-600 text-xl font-bold">ب.أ</span>
                    </div>
                    <h5 className="font-bold text-green-800">بلبخوش أحمد عبد الرؤوف</h5>
                    <p className="text-green-600 text-sm">منظم</p>
                  </div>
                  
                  <div className="bg-amber-50 rounded-lg p-4 shadow text-center transition-transform hover:scale-105">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-amber-600 text-xl font-bold">ب.م</span>
                    </div>
                    <h5 className="font-bold text-amber-800">بلبخوش محمد أشرف</h5>
                    <p className="text-amber-600 text-sm">منظم</p>
                  </div>
                  
                  <div className="bg-purple-50 rounded-lg p-4 shadow text-center transition-transform hover:scale-105">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-purple-600 text-xl font-bold">س.ب</span>
                    </div>
                    <h5 className="font-bold text-purple-800">سعداوي بلقاسم</h5>
                    <p className="text-purple-600 text-sm">منظم</p>
                  </div>
                </div>
                
                {/* Developer Credits Section */}
                <div className="mt-12 border-t pt-6">
                  <h4 className="text-lg font-bold mb-3 text-center">تطوير الموقع</h4>
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg shadow-sm max-w-2xl mx-auto">
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-4">
                        <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                          ب.أ.خ
                        </div>
                      </div>
                      <div className="text-center">
                        <h5 className="text-xl font-bold text-gray-800">بلبخوش أكرم خالد</h5>
                        <p className="text-indigo-600 mb-2">طالب الذكاء الاصطناعي في المدرسة الوطنية العليا للذكاء الاصطناعي ENSIA</p>
                        <a 
                          href="https://github.com/akrambel2115" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 24 24">
                            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                          </svg>
                          GitHub: @akrambel2115
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
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
      
      {/* Screenshot Modal */}
      {showScreenshotModal && screenshotGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg overflow-hidden w-[90%] max-w-3xl">
            <div className="p-4 bg-blue-500 text-white flex justify-between">
              <h3 className="text-xl font-bold">المجموعة {screenshotGroup}</h3>
              <button onClick={handleCloseScreenshotModal} className="text-white hover:text-gray-200">
                <span className="text-2xl">×</span>
              </button>
            </div>
            
            <div className="p-6" id="screenshot-area">
              <div className="mb-4 text-center">
                <h2 className="text-2xl font-bold">الوندي سبور - ترتيب المجموعة {screenshotGroup}</h2>
                <p className="text-gray-600">إحياء ذكرى المرحوم بشاشحية أحسن</p>
              </div>
              
              <table className="w-full border-collapse border border-gray-300 mb-6">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border border-gray-300 px-4 py-2 text-center">#</th>
                    <th className="border border-gray-300 px-4 py-2 text-right">الفريق</th>
                    <th className="border border-gray-300 px-4 py-2 text-center">لعب</th>
                    <th className="border border-gray-300 px-4 py-2 text-center">فاز</th>
                    <th className="border border-gray-300 px-4 py-2 text-center">تعادل</th>
                    <th className="border border-gray-300 px-4 py-2 text-center">خسر</th>
                    <th className="border border-gray-300 px-4 py-2 text-center">له</th>
                    <th className="border border-gray-300 px-4 py-2 text-center">عليه</th>
                    <th className="border border-gray-300 px-4 py-2 text-center">+/-</th>
                    <th className="border border-gray-300 px-4 py-2 text-center">نقاط</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedTeams[screenshotGroup]?.map((team, index) => (
                    <tr key={team._id} 
                        className={
                          index < 2 ? "bg-green-100" : 
                          bestThirdPlaceTeamIds.includes(team._id) ? "bg-green-100" : 
                          "bg-red-50"
                        }>
                      <td className="border border-gray-300 px-4 py-2 text-center">{index + 1}</td>
                      <td className="border border-gray-300 px-4 py-2 text-right font-medium">{team.name}</td>
                      <td className="border border-gray-300 px-4 py-2 text-center">{team.stats?.played || 0}</td>
                      <td className="border border-gray-300 px-4 py-2 text-center font-medium text-green-700">{team.stats?.won || 0}</td>
                      <td className="border border-gray-300 px-4 py-2 text-center text-yellow-600">{team.stats?.drawn || 0}</td>
                      <td className="border border-gray-300 px-4 py-2 text-center text-red-600">{team.stats?.lost || 0}</td>
                      <td className="border border-gray-300 px-4 py-2 text-center">{team.stats?.goalsFor || 0}</td>
                      <td className="border border-gray-300 px-4 py-2 text-center">{team.stats?.goalsAgainst || 0}</td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {(team.stats?.goalsFor || 0) - (team.stats?.goalsAgainst || 0)}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center font-bold">{team.stats?.points || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <div className="flex justify-between text-gray-500 text-sm">
                <span>تاريخ: {new Date().toLocaleDateString('ar-DZ')}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Footer */}
      <footer className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white mt-16">
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="mb-6 md:mb-0">
              <div className="flex items-center">
                <img 
                  src="/el_wendi_sport.png" 
                  alt="الوندي سبور" 
                  className="h-12 w-auto mr-3"
                />
                <div>
                  <h3 className="text-xl font-bold">الوندي سبور</h3>
                  <p className="text-blue-200">إحياء ذكرى المرحوم بشاشحية أحسن</p>
                </div>
              </div>
            </div>
            
            <div className="text-center md:text-right">
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg inline-block">
                <p className="text-sm text-blue-100">تم تطوير هذا الموقع بواسطة</p>
                <h4 className="text-lg font-bold mb-1">بلبخوش أكرم خالد</h4>
                <p className="text-sm text-blue-200 mb-2">طالب الذكاء الاصطناعي في المدرسة الوطنية العليا للذكاء الاصطناعي ENSIA</p>
                <a 
                  href="https://github.com/akrambel2115" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex items-center text-white bg-indigo-600 hover:bg-indigo-700 transition-colors px-3 py-1 rounded-full text-sm"
                >
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                  GitHub: @akrambel2115
                </a>
              </div>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-blue-800 text-center text-sm text-blue-300">
            <p>&copy; {new Date().getFullYear()} الوندي سبور. جميع الحقوق محفوظة.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
