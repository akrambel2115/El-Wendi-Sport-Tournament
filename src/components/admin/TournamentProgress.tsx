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

interface KnockoutMatch {
  id: string;
  round: 'round16' | 'quarter' | 'semi' | 'final';
  position: number;
  teamA?: {
    id: Id<"teams">;
    name: string;
  };
  teamB?: {
    id: Id<"teams">;
    name: string;
  };
  winnerId?: Id<"teams">;
  matchId?: Id<"matches">;
  matchDate?: string;
  matchTime?: string;
  score?: {
    teamA: number;
    teamB: number;
  };
}

// Type for casting when updating bracket match state
type KnockoutMatchUpdate = Partial<KnockoutMatch> & { id: string };

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
  const updateGroupName = useMutation(api.tournament.updateGroupName);
  const createMatch = useMutation(api.matches.create);

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

  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [editingGroupTeams, setEditingGroupTeams] = useState<{
    [teamId: string]: boolean;
  }>({});
  const [editingGroupName, setEditingGroupName] = useState("");

  const [knockoutBracket, setKnockoutBracket] = useState<KnockoutMatch[]>([]);
  const [processingAdvancement, setProcessingAdvancement] = useState(false);

  const [editingBracketMatch, setEditingBracketMatch] = useState<KnockoutMatch | null>(null);
  const [assignedTeamIds, setAssignedTeamIds] = useState<Set<string>>(new Set());
  const [bracketColors, setBracketColors] = useState<{[key: string]: string}>({});

  const handleSyncTeamStats = async () => {
    try {
      setSyncing(true);
      setSyncMessage("جاري مزامنة إحصائيات الفرق...");
      await syncTeamStats({});
      setSyncMessage("تم مزامنة إحصائيات الفرق بنجاح");
      setTimeout(() => setSyncMessage(""), 3000);
    } catch (error) {
      console.error("Error syncing team stats:", error);
      setSyncMessage("حدث خطأ أثناء مزامنة إحصائيات الفرق");
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncGroupsAndTeams = async () => {
    try {
      setSyncing(true);
      setSyncMessage("جاري مزامنة الفرق والمجموعات...");
      const result = await syncGroupsAndTeams({});
      if (result.updates > 0) {
        setSyncMessage(`تم مزامنة ${result.updates} من الفرق والمجموعات`);
      } else {
        setSyncMessage('البيانات متزامنة بالفعل');
      }
      setTimeout(() => setSyncMessage(""), 3000);
    } catch (error) {
      console.error("Error syncing groups and teams:", error);
      setSyncMessage('حدث خطأ أثناء المزامنة');
      setTimeout(() => setSyncMessage(""), 3000);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (tournament) {
      setNewSettings({
        currentStage: tournament.currentStage,
        startDate: tournament.startDate,
        endDate: tournament.endDate,
        settings: tournament.settings,
      });
    } else {
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

  useEffect(() => {
    if (!teams.length || !groups.length) return;
    
    const hasAllAssignments = teams.every(team => 
      Object.keys(groupAssignments).includes(team._id)
    );
    
    if (hasAllAssignments && Object.keys(groupAssignments).length === teams.length) return;
    
    const newGroupAssignments: { [teamId: string]: Id<"groups"> | null } = {};
    
    teams.forEach((team) => {
      if (team.groupId) {
        const group = groups.find((g) => g.name === team.groupId);
        if (group) {
          newGroupAssignments[team._id] = group._id;
          return;
        }
      }
      
      const group = groups.find((g) => 
        g.teams.some((id) => id === team._id)
      );
      
      newGroupAssignments[team._id] = group?._id || null;
    });
    
    setGroupAssignments(newGroupAssignments);
  }, [teams, groups, groupAssignments]);

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
    
    if (tournament.currentStage === "group") {
      try {
        setProcessingAdvancement(true);
        setSyncMessage("جاري الإنتقال إلى دور الـ16...");
        
        await initializeEmptyBracket();
        
        await updateStage({
          tournamentId: tournament._id,
          newStage: "round16",
        });
        
        setSyncMessage("تم الانتقال إلى دور الـ16 بنجاح");
        setTimeout(() => setSyncMessage(""), 3000);
      } catch (error) {
        console.error("Error advancing to round of 16:", error);
        setSyncMessage("حدث خطأ أثناء الانتقال إلى دور الـ16");
      } finally {
        setProcessingAdvancement(false);
      }
    } else if (currentIndex < stages.length - 1) {
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

  const initializeEmptyBracket = async () => {
    const bracket: KnockoutMatch[] = [];
    const colors = generateBracketColors();
    
    for (let i = 0; i < 8; i++) {
      bracket.push({
        id: `r16-${i+1}`,
        round: 'round16',
        position: i + 1,
      });
    }
    
    for (let i = 0; i < 4; i++) {
      bracket.push({
        id: `qf-${i+1}`,
        round: 'quarter',
        position: i + 1,
      });
    }
    
    for (let i = 0; i < 2; i++) {
      bracket.push({
        id: `sf-${i+1}`,
        round: 'semi',
        position: i + 1,
      });
    }
    
    bracket.push({
      id: 'final-1',
      round: 'final',
      position: 1,
    });
    
    setKnockoutBracket(bracket);
    setBracketColors(colors);
    setAssignedTeamIds(new Set());
    return bracket;
  };

  const generateBracketColors = () => {
    const colors = {
      group1: 'bg-blue-100',
      group2: 'bg-green-100',
      group3: 'bg-purple-100',
      group4: 'bg-yellow-100',
      quarter1: 'bg-blue-200',
      quarter2: 'bg-green-200',
      semi: 'bg-indigo-200',
      final: 'bg-amber-200',
      champion: 'bg-gradient-to-r from-yellow-300 to-amber-500'
    };
    
    const result: {[key: string]: string} = {};
    
    result['r16-1'] = colors.group1;
    result['r16-2'] = colors.group1;
    result['r16-3'] = colors.group2;
    result['r16-4'] = colors.group2;
    result['r16-5'] = colors.group3;
    result['r16-6'] = colors.group3;
    result['r16-7'] = colors.group4;
    result['r16-8'] = colors.group4;
    result['qf-1'] = colors.quarter1;
    result['qf-2'] = colors.quarter1;
    result['qf-3'] = colors.quarter2;
    result['qf-4'] = colors.quarter2;
    result['sf-1'] = colors.semi;
    result['sf-2'] = colors.semi;
    result['final-1'] = colors.final;
    result['champion'] = colors.champion;
    
    return result;
  };

  const handleSaveBracketTeams = async () => {
    if (!editingBracketMatch) return;
    
    try {
      if (!editingBracketMatch.teamA?.id || !editingBracketMatch.teamB?.id || 
          !editingBracketMatch.matchDate || !editingBracketMatch.matchTime) {
        alert("يجب اختيار فريقين للمباراة وتحديد التاريخ والوقت");
        return;
      }
      
      const newTeamIds = new Set(assignedTeamIds);
      const currentIds = [];
      
      const existingMatch = knockoutBracket.find(m => m.id === editingBracketMatch.id);
      if (existingMatch?.teamA?.id) {
        newTeamIds.delete(existingMatch.teamA.id);
      }
      if (existingMatch?.teamB?.id) {
        newTeamIds.delete(existingMatch.teamB.id);
      }
      
      if (newTeamIds.has(editingBracketMatch.teamA.id) && 
          editingBracketMatch.round === 'round16') {
        alert(`الفريق ${editingBracketMatch.teamA.name} قد تم تعيينه بالفعل في مباراة أخرى`);
        return;
      } else {
        currentIds.push(editingBracketMatch.teamA.id);
      }
      
      if (newTeamIds.has(editingBracketMatch.teamB.id) && 
          editingBracketMatch.round === 'round16') {
        alert(`الفريق ${editingBracketMatch.teamB.name} قد تم تعيينه بالفعل في مباراة أخرى`);
        return;
      } else {
        currentIds.push(editingBracketMatch.teamB.id);
      }
      
      const match = await createMatch({
        date: editingBracketMatch.matchDate,
        time: editingBracketMatch.matchTime,
        teamAId: editingBracketMatch.teamA.id,
        teamBId: editingBracketMatch.teamB.id,
        stage: editingBracketMatch.round,
        referees: [],
        status: "scheduled",
        groupId: editingBracketMatch.position.toString() // Using groupId to store position information
      });
      
      const updatedBracket = knockoutBracket.map(m => 
        m.id === editingBracketMatch.id 
          ? { ...editingBracketMatch, matchId: match } 
          : m
      );
      
      setKnockoutBracket(updatedBracket);
      
      currentIds.forEach(id => newTeamIds.add(id));
      setAssignedTeamIds(newTeamIds);
      
      setEditingBracketMatch(null);
    } catch (error) {
      console.error("Error creating match for bracket position:", error);
      alert("حدث خطأ أثناء إنشاء المباراة");
    }
  };

  const handleEditMatch = (match: KnockoutMatch) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultDate = tomorrow.toISOString().split('T')[0];
    
    setEditingBracketMatch({
      ...match,
      matchDate: match.matchDate || defaultDate,
      matchTime: match.matchTime || "18:00"
    } as KnockoutMatch);
  };

  const MatchBox = ({ 
    match, 
    onClick, 
    direction = 'center',
    isFinal = false,
    color = 'bg-white',
    lockTeams = false,
    disabled = false
  }: { 
    match: KnockoutMatch, 
    onClick: () => void,
    direction?: 'left' | 'right' | 'center',
    isFinal?: boolean,
    color?: string,
    lockTeams?: boolean,
    disabled?: boolean
  }) => {
    let opacityClass = disabled ? "opacity-50 cursor-not-allowed" : "hover:shadow-lg cursor-pointer";
    if (!match.teamA && !match.teamB) {
      opacityClass = "opacity-70";
    }
    
    let borderClass = "border";
    if (match.matchId) {
      if (match.winnerId) {
        borderClass = "border-2 border-green-500";
      } else {
        borderClass = "border-2 border-blue-400";
      }
    }

    const formatTeamName = (name?: string) => {
      if (!name) return null;
      
      const cleanedName = name.replace(/\s*-\s*$/, '').trim();
      const parts = cleanedName.split('-').map(part => part.trim());
      
      if (parts.length > 1) {
        return (
          <div className="text-center">
            <div className="font-medium">{parts[0]}</div>
            <div className="text-xs text-gray-600">{parts[1]}</div>
          </div>
        );
      }
      
      return <div className="text-center">{cleanedName}</div>;
    };
    
    const findMatchDateAndTime = () => {
      if (!match.matchId) return null;
      
      const matchData = matches.find(m => m._id === match.matchId);
      if (!matchData) return null;
      
      const date = new Date(matchData.date);
      const formattedDate = `${date.getDate()}/${date.getMonth() + 1}`;
      
      return (
        <div className="text-xs text-center">
          <span className="text-blue-700">{formattedDate}</span>
          <span className="mx-1">•</span>
          <span className="text-blue-700">{matchData.time}</span>
        </div>
      );
    };

    const teamAIsWinner = match.winnerId === match.teamA?.id;
    const teamBIsWinner = match.winnerId === match.teamB?.id;
    
    return (
      <div 
        className={`
          ${color} ${borderClass} rounded-lg overflow-hidden shadow-md
          ${isFinal ? 'shadow-lg transform scale-105' : ''}
          ${match.winnerId ? 'shadow-md hover:shadow-lg' : ''}
          ${opacityClass} transition-all duration-200 hover:translate-y-[-2px]
        `}
        onClick={!disabled ? onClick : undefined}
      >
        {match.matchId && !match.winnerId && (
          <div className="bg-gray-800 bg-opacity-10 text-center py-1">
            {findMatchDateAndTime()}
          </div>
        )}
        
        <div className="pt-2 pb-2 relative">
          <div className={`px-3 py-1.5 ${teamAIsWinner ? 'bg-green-50' : ''}`}>
            <div className={`
              flex items-center justify-center
              ${teamAIsWinner ? 'text-green-800 font-bold' : ''}
              ${teamBIsWinner ? 'text-gray-500' : ''}
            `}>
              {match.teamA?.name ? 
                formatTeamName(match.teamA.name) : 
                <span className="text-gray-400 text-sm text-center">
                  {lockTeams ? "انتظار الفائز" : "اختر الفريق"}
                </span>
              }
            </div>
          </div>
          
          <div className="flex items-center justify-center bg-gray-100 my-1 py-1 relative">
            <div className="absolute left-0 w-1/3 h-0.5 bg-gradient-to-r from-transparent to-gray-300"></div>
            <div className="text-xs font-semibold text-gray-500 px-2">VS</div>
            <div className="absolute right-0 w-1/3 h-0.5 bg-gradient-to-l from-transparent to-gray-300"></div>
            
            {match.matchId && match.teamA && match.teamB && match.score && (
              <div className="absolute right-2 rounded bg-gray-800 bg-opacity-10 px-2 text-sm font-bold">
                <span className={teamAIsWinner ? "text-green-600" : ""}>
                  {typeof match.score.teamA === 'number' ? match.score.teamA : "-"}
                </span>
                <span className="mx-0.5">-</span>
                <span className={teamBIsWinner ? "text-green-600" : ""}>
                  {typeof match.score.teamB === 'number' ? match.score.teamB : "-"}
                </span>
              </div>
            )}
          </div>
          
          <div className={`px-3 py-1.5 ${teamBIsWinner ? 'bg-green-50' : ''}`}>
            <div className={`
              flex items-center justify-center
              ${teamBIsWinner ? 'text-green-800 font-bold' : ''}
              ${teamAIsWinner ? 'text-gray-500' : ''}
            `}>
              {match.teamB?.name ? 
                formatTeamName(match.teamB.name) : 
                <span className="text-gray-400 text-sm text-center">
                  {lockTeams ? "انتظار الفائز" : "اختر الفريق"}
                </span>
              }
            </div>
          </div>
        </div>

        {match.matchId && (
          <div className="text-center py-1">
            {match.winnerId ? (
              <div className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 inline-block">
                اكتملت
              </div>
            ) : (
              <div className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 inline-block">
                مجدولة
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const TournamentBracketDisplay = () => {
    if (!tournament || !['round16', 'quarter', 'semi', 'final', 'completed'].includes(tournament.currentStage)) {
      return null;
    }
    
    const assignedTeamsCount = knockoutBracket
      .filter(m => m.round === 'round16' && m.matchId)
      .length * 2;
    
    const round16Matches = knockoutBracket.filter(m => m.round === 'round16');
    const leftRound16 = round16Matches.slice(0, 4);
    const rightRound16 = round16Matches.slice(4, 8);
    
    const quarterMatches = knockoutBracket.filter(m => m.round === 'quarter');
    const leftQuarter = quarterMatches.slice(0, 2);
    const rightQuarter = quarterMatches.slice(2, 4);
    
    const semiMatches = knockoutBracket.filter(m => m.round === 'semi');
    const finalMatch = knockoutBracket.find(m => m.round === 'final');
    
    return (
      <>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">مخطط البطولة</h3>
          <div>
            <span className="text-sm text-gray-600 ml-2">
              {assignedTeamsCount}/16 فرق تم تعيينها
            </span>
            <button 
              onClick={() => initializeEmptyBracket()} 
              className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 ml-3"
            >
              إعادة تهيئة المخطط
            </button>
          </div>
        </div>
        
        <div
          className="bracket-container mt-4 rounded-lg p-4 overflow-auto relative border-0 shadow-none bg-transparent"
        >
          {/* Enhanced creative background elements */}
          {/* Enhanced creative background elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {/* Multi-layered gradient background */}
            <div className="absolute inset-0 bg-gradient-to-r from-green-50 via-blue-50 to-purple-50 opacity-70"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-yellow-50 to-transparent opacity-40"></div>
            
            {/* Stadium field markings */}
            <div className="absolute top-1/2 left-1/2 w-[800px] h-[500px] -translate-x-1/2 -translate-y-1/2 
                           border-[3px] border-green-200 rounded-[50%] opacity-20"></div>
            <div className="absolute top-1/2 left-1/2 w-[700px] h-[400px] -translate-x-1/2 -translate-y-1/2
                           border-[2px] border-green-200 rounded-[50%] opacity-30"></div>
            <div className="absolute top-1/2 left-1/2 w-[200px] h-[200px] -translate-x-1/2 -translate-y-1/2
                           border-[2px] border-green-300 rounded-full opacity-30"></div>
            
            {/* Center line */}
            <div className="absolute inset-y-0 left-1/2 border-l-2 border-dashed border-green-200 -translate-x-1/2 opacity-20"></div>
            <div className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-green-200 -translate-y-1/2 opacity-20"></div>
            
            {/* Goal areas on left and right */}
            <div className="absolute top-1/2 left-0 w-[80px] h-[150px] -translate-y-1/2 border-r-2 border-y-2 border-green-300 opacity-30"></div>
            <div className="absolute top-1/2 right-0 w-[80px] h-[150px] -translate-y-1/2 border-l-2 border-y-2 border-green-300 opacity-30"></div>
            
            {/* Soccer balls scattered around */}
            <div className="absolute top-[8%] left-[7%] w-8 h-8 opacity-30 animate-pulse" style={{ animationDuration: '6s' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                <path fill="#444" d="M177.1 228.6L207.9 320h96.5l29.62-91.38L256 172.1L177.1 228.6zM255.1 0C255.1 0 255.1 0 255.1 0C255.1 0 255.1 0 255.1 0C114.6 0 .0001 114.6 .0001 256S114.6 512 256 512s255.1-114.6 255.1-255.1S397.4 0 255.1 0zM416.6 360.9l-85.4-1.297l-25.15 81.59C290.1 445.5 273.4 448 256 448s-34.09-2.523-50.09-6.859l-25.15-81.59l-85.4 1.297C75.15 335.9 62.94 308.5 56.62 279.4l53.95-64.97l-40.93-78.21C86.58 98.19 121.7 69.4 162.3 54.1l71.51 50.24L305.3 54.1c40.58 14.48 75.73 43.19 92.66 81.26l-40.93 78.21l53.95 64.97C404.1 308.5 391.9 335.9 371.7 360.9H416.6z"/>
              </svg>
            </div>
            <div className="absolute bottom-[15%] right-[9%] w-10 h-10 opacity-40 animate-bounce" style={{ animationDuration: '8s' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                <path fill="#444" d="M177.1 228.6L207.9 320h96.5l29.62-91.38L256 172.1L177.1 228.6zM255.1 0C255.1 0 255.1 0 255.1 0C255.1 0 255.1 0 255.1 0C114.6 0 .0001 114.6 .0001 256S114.6 512 256 512s255.1-114.6 255.1-255.1S397.4 0 255.1 0zM416.6 360.9l-85.4-1.297l-25.15 81.59C290.1 445.5 273.4 448 256 448s-34.09-2.523-50.09-6.859l-25.15-81.59l-85.4 1.297C75.15 335.9 62.94 308.5 56.62 279.4l53.95-64.97l-40.93-78.21C86.58 98.19 121.7 69.4 162.3 54.1l71.51 50.24L305.3 54.1c40.58 14.48 75.73 43.19 92.66 81.26l-40.93 78.21l53.95 64.97C404.1 308.5 391.9 335.9 371.7 360.9H416.6z"/>
              </svg>
            </div>
            <div className="absolute top-[30%] right-[25%] w-12 h-12 opacity-20 animate-spin" style={{ animationDuration: '15s' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                <path fill="#444" d="M177.1 228.6L207.9 320h96.5l29.62-91.38L256 172.1L177.1 228.6zM255.1 0C255.1 0 255.1 0 255.1 0C255.1 0 255.1 0 255.1 0C114.6 0 .0001 114.6 .0001 256S114.6 512 256 512s255.1-114.6 255.1-255.1S397.4 0 255.1 0zM416.6 360.9l-85.4-1.297l-25.15 81.59C290.1 445.5 273.4 448 256 448s-34.09-2.523-50.09-6.859l-25.15-81.59l-85.4 1.297C75.15 335.9 62.94 308.5 56.62 279.4l53.95-64.97l-40.93-78.21C86.58 98.19 121.7 69.4 162.3 54.1l71.51 50.24L305.3 54.1c40.58 14.48 75.73 43.19 92.66 81.26l-40.93 78.21l53.95 64.97C404.1 308.5 391.9 335.9 371.7 360.9H416.6z"/>
              </svg>
            </div>
            <div className="absolute top-[70%] left-[20%] w-6 h-6 opacity-50 animate-pulse" style={{ animationDuration: '4s' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                <path fill="#444" d="M177.1 228.6L207.9 320h96.5l29.62-91.38L256 172.1L177.1 228.6zM255.1 0C255.1 0 255.1 0 255.1 0C255.1 0 255.1 0 255.1 0C114.6 0 .0001 114.6 .0001 256S114.6 512 256 512s255.1-114.6 255.1-255.1S397.4 0 255.1 0zM416.6 360.9l-85.4-1.297l-25.15 81.59C290.1 445.5 273.4 448 256 448s-34.09-2.523-50.09-6.859l-25.15-81.59l-85.4 1.297C75.15 335.9 62.94 308.5 56.62 279.4l53.95-64.97l-40.93-78.21C86.58 98.19 121.7 69.4 162.3 54.1l71.51 50.24L305.3 54.1c40.58 14.48 75.73 43.19 92.66 81.26l-40.93 78.21l53.95 64.97C404.1 308.5 391.9 335.9 371.7 360.9H416.6z"/>
              </svg>
            </div>
            <div className="absolute top-[15%] left-[40%] w-5 h-5 opacity-30 animate-bounce" style={{ animationDuration: '7s' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                <path fill="#444" d="M177.1 228.6L207.9 320h96.5l29.62-91.38L256 172.1L177.1 228.6zM255.1 0C255.1 0 255.1 0 255.1 0C255.1 0 255.1 0 255.1 0C114.6 0 .0001 114.6 .0001 256S114.6 512 256 512s255.1-114.6 255.1-255.1S397.4 0 255.1 0zM416.6 360.9l-85.4-1.297l-25.15 81.59C290.1 445.5 273.4 448 256 448s-34.09-2.523-50.09-6.859l-25.15-81.59l-85.4 1.297C75.15 335.9 62.94 308.5 56.62 279.4l53.95-64.97l-40.93-78.21C86.58 98.19 121.7 69.4 162.3 54.1l71.51 50.24L305.3 54.1c40.58 14.48 75.73 43.19 92.66 81.26l-40.93 78.21l53.95 64.97C404.1 308.5 391.9 335.9 371.7 360.9H416.6z"/>
              </svg>
            </div>
            
            {/* Trophy icons */}
            <div className="absolute top-[10%] right-[15%] w-16 h-16 opacity-15 rotate-12">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512">
                <path fill="gold" d="M552 64H448V24c0-13.3-10.7-24-24-24H152c-13.3 0-24 10.7-24 24v40H24C10.7 64 0 74.7 0 88v56c0 66.5 77.9 131.7 171.9 142.4C203.3 338.5 240 360 240 360v72h-48c-35.3 0-64 20.7-64 56v12c0 6.6 5.4 12 12 12h296c6.6 0 12-5.4 12-12v-12c0-35.3-28.7-56-64-56h-48v-72s36.7-21.5 68.1-73.6C498.4 275.6 576 210.3 576 144V88c0-13.3-10.7-24-24-24zM64 144v-16h64.2c1 32.6 5.8 61.2 12.8 86.2-47.5-16.4-77-49.9-77-70.2zm448 0c0 20.2-29.4 53.8-77 70.2 7-25 11.8-53.6 12.8-86.2H512v16z"/>
              </svg>
            </div>
            <div className="absolute top-[60%] left-[12%] w-12 h-12 opacity-10 -rotate-12">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512">
                <path fill="gold" d="M552 64H448V24c0-13.3-10.7-24-24-24H152c-13.3 0-24 10.7-24 24v40H24C10.7 64 0 74.7 0 88v56c0 66.5 77.9 131.7 171.9 142.4C203.3 338.5 240 360 240 360v72h-48c-35.3 0-64 20.7-64 56v12c0 6.6 5.4 12 12 12h296c6.6 0 12-5.4 12-12v-12c0-35.3-28.7-56-64-56h-48v-72s36.7-21.5 68.1-73.6C498.4 275.6 576 210.3 576 144V88c0-13.3-10.7-24-24-24zM64 144v-16h64.2c1 32.6 5.8 61.2 12.8 86.2-47.5-16.4-77-49.9-77-70.2zm448 0c0 20.2-29.4 53.8-77 70.2 7-25 11.8-53.6 12.8-86.2H512v16z"/>
              </svg>
            </div>
            
            {/* Football jerseys */}
            <div className="absolute bottom-[10%] left-[8%] w-14 h-14 opacity-20">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512">
                <path fill="#3b82f6" d="M211.8 0c7.8 0 14.3 5.7 16.7 13.2C240.8 51.9 277.1 80 320 80s79.2-28.1 91.5-66.8C413.9 5.7 420.4 0 428.2 0h12.6c22.5 0 44.2 7.9 61.5 22.3L628.5 127.4c6.6 5.5 10.7 13.5 11.4 22.1s-2.1 17.1-7.8 23.6l-56 64c-11.4 13.1-31.2 14.6-44.6 3.5L480 197.7V448c0 35.3-28.7 64-64 64H224c-35.3 0-64-28.7-64-64V197.7l-51.5 42.9c-13.3 11.1-33.1 9.6-44.6-3.5l-56-64c-5.7-6.5-8.5-15-7.8-23.6s4.8-16.6 11.4-22.1L137.7 22.3C155 7.9 176.7 0 199.2 0h12.6z"/>
              </svg>
            </div>
            <div className="absolute top-[12%] left-[75%] w-16 h-16 opacity-15 rotate-12">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512">
                <path fill="#ef4444" d="M211.8 0c7.8 0 14.3 5.7 16.7 13.2C240.8 51.9 277.1 80 320 80s79.2-28.1 91.5-66.8C413.9 5.7 420.4 0 428.2 0h12.6c22.5 0 44.2 7.9 61.5 22.3L628.5 127.4c6.6 5.5 10.7 13.5 11.4 22.1s-2.1 17.1-7.8 23.6l-56 64c-11.4 13.1-31.2 14.6-44.6 3.5L480 197.7V448c0 35.3-28.7 64-64 64H224c-35.3 0-64-28.7-64-64V197.7l-51.5 42.9c-13.3 11.1-33.1 9.6-44.6-3.5l-56-64c-5.7-6.5-8.5-15-7.8-23.6s4.8-16.6 11.4-22.1L137.7 22.3C155 7.9 176.7 0 199.2 0h12.6z"/>
              </svg>
            </div>
            
            {/* Referee whistle */}
            <div className="absolute top-[65%] right-[15%] w-12 h-12 opacity-20">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512">
                <path fill="#444" d="M160 240c-35.3 0-64-28.7-64-64s28.7-64 64-64c35.3 0 64 28.7 64 64S195.3 240 160 240zm288 32h8c13.3 0 24-10.7 24-24s-10.7-24-24-24h-8v-64h8c13.3 0 24-10.7 24-24s-10.7-24-24-24h-64c-13.3 0-24 10.7-24 24s10.7 24 24 24h8v64h-8c-13.3 0-24 10.7-24 24s10.7 24 24 24h8v64h-64v-24c0-37.7-29.1-68.6-66.1-71.6C205.5 211.2 160 167 160 112C160 50.1 210.1 0 272 0h192c61.9 0 112 50.1 112 112s-50.1 112-112 112c-10.7 0-21.2-1.5-31-4.4V364.8c12.5-10 30-10 42.5 0l15 12c3 2.4 7.3 1.9 9.7-1m-128-72V176h-96v24c0 4.4 3.6 8 8 8h80c4.4 0 8-3.6 8-8z"/>
              </svg>
            </div>
            
            {/* Football boots/shoes */}
            <div className="absolute bottom-[20%] left-[20%] w-16 h-16 opacity-20 -rotate-12">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512">
                <path fill="#444" d="M416 0C352.3 0 256 32 256 32V160c48 0 76 16 104 32s56 32 104 32c56.4 0 176-16 176-96S512 0 416 0zM128 96c0-53 43-96 96-96h10.7c-33.6 29.8-53.5 71.2-55.3 115.8c-5.2-1.7-11.6-3.8-19.3-3.8c-17.7 0-32 14.3-32 32v32H32c0 35.3 28.7 64 64 64v64c-17.7 0-32 14.3-32 32v96c0 17.7 14.3 32 32 32H224c17.7 0 32-14.3 32-32V384c0-17.7-14.3-32-32-32V288H412.3l11 32H352v32h128V320h11l11-32H640V160c-23.7 0-45.9-6.2-65.1-17.1C558.7 126.5 536.6 112 512 112c-52.3 0-94.7 42.4-96 94.6c-39-33.4-101.3-30.5-136.3-22.6c-8.8-10-16.6-19.7-27.7-28.7V96z"/>
              </svg>
            </div>
            
            {/* Football stadium */}
            <div className="absolute top-[5%] left-[40%] w-24 h-24 opacity-10">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512">
                <path fill="#444" d="M308.5 135.3c7.1-6.3 9.9-16.2 6.2-25.2c-2.3-5.3-4.8-10.5-7.6-15.5L304 89.4c-3-5-6.3-9.9-9.8-14.6c-5.7-7.6-15.7-10.1-24.7-7.1l-28.2 9.4c-10.7-8.8-23-16.9-36.2-23.7l-16.3-27.5C182.2 18.3 174.5 14 166.1 14c-8.4 0-16.1 4.3-20.7 11.4L130.3 52.8c-14.1 3.7-27.5 9.4-40.1 16.6L62 57.9c-4.7-1.6-9.7-1.6-14.4 0c-4.7 1.6-8.7 4.9-11.1 9.1L8.8 115.9c-2.5 4.2-3.1 9.4-1.9 14.1c1.2 4.7 4.2 8.7 8.2 11.3L41.7 157c-1.8 10.7-2.7 21.7-2.7 32.8s.9 22.1 2.7 32.8L15.1 238.3c-4 2.6-7 6.6-8.2 11.3c-1.2 4.7-.7 9.8 1.9 14.1L36.4 312c2.4 4.2 6.4 7.5 11.1 9.1c4.7 1.6 9.7 1.6 14.4 0l28.2-9.4c12.6 7.2 26.1 12.9 40.1 16.6l15.1 27.4c4.6 7.1 12.3 11.4 20.7 11.4c8.4 0 16.1-4.3 20.7-11.4l15.1-27.4c13.9-3.6 27.4-9.3 40.1-16.6l28.2 9.4c4.7 1.6 9.7 1.6 14.4 0c4.7-1.6 8.7-4.9 11.1-9.1l27.7-48c2.5-4.2 3.1-9.4 1.9-14.1c-1.2-4.7-4.2-8.7-8.2-11.3l-26.6-17.1c1.8-10.7 2.7-21.7 2.7-32.8s-.9-22.1-2.7-32.8l26.6-17.1c4-2.6 7-6.6 8.2-11.3c1.2-4.7 .7-9.8-1.9-14.1L323.9 67c-2.4-4.2-6.4-7.5-11.1-9.1c-4.7-1.6-9.7-1.6-14.4 0l-28.2 9.4c-12.6-7.2-26.1-12.9-40.1-16.6l-15.1-27.4C210.4 16.3 202.7 12 194.3 12c-8.4 0-16.1 4.3-20.7 11.4l-15.1 27.4c-13.9 3.6-27.4 9.3-40.1 16.6l-28.2-9.4c-4.7-1.6-9.7-1.6-14.4 0c-4.7 1.6-8.7 4.9-11.1 9.1L36.9 115c-2.5 4.2-3.1 9.4-1.9 14.1c1.2 4.7 4.2 8.7 8.2 11.3l26.6 17.1c-1.8 10.7-2.7 21.7-2.7 32.8s.9 22.1 2.7 32.8L43.1 240.4c-4 2.6-7 6.6-8.2 11.3c-1.2 4.7-.7 9.8 1.9 14.1L64.5 314c2.4 4.2 6.4 7.5 11.1 9.1c4.7 1.6 9.7 1.6 14.4 0l28.2-9.4c10.7 8.8 23 16.9 36.2 23.7l16.3 27.5c4.6 7.1 12.3 11.4 20.7 11.4c8.4 0 16.1-4.3 20.7-11.4l16.3-27.5c13.2-6.7 25.5-14.9 36.2-23.7l28.2 9.4c4.7 1.6 9.7 1.6 14.4 0c4.7-1.6 8.7-4.9 11.1-9.1l27.7-48c2.5-4.2 3.1-9.4 1.9-14.1c-1.2-4.7-4.2-8.7-8.2-11.3l-26.6-17.1c1.8-10.7 2.7-21.7 2.7-32.8s-.9-22.1-2.7-32.8l26.6-17.1zm-94.1 96.4l-.3 .5 0 0 0 .1c-.1 .1-.2 .3-.3 .4c-4 5.5-8.5 10.5-13.5 15c-5.3 4.7-10.9 8.7-17 11.9c-6.5 3.3-13.4 5.7-20.6 6.8c-7.7 1.1-15.4 .7-22.8-1.1c-7.1-1.8-13.7-4.7-19.8-8.6c-5.8-3.7-11-8.3-15.5-13.6c-4.2-5-7.8-10.6-10.4-16.5c-2.4-5.7-4.1-11.8-4.7-18c-.7-7.1-.2-14.3 1.6-21.1c2-7.2 5.4-13.9 9.8-19.7s9.8-10.8 15.9-14.7c6.5-4.1 13.7-7 21.1-8.4c8.5-1.6 17.1-1.5 25.5 .3c7.9 1.7 15.3 4.8 22 9.1c6.3 4 11.9 8.9 16.7 14.6c4.5 5.3 8.2 11.1 10.9 17.4c2.4 5.7 4 11.7 4.8 17.8l0 0V232zm-94.6-33.6c0 30.9-25.1 56-56 56s-56-25.1-56-56s25.1-56 56-56s56 25.1 56 56z"/>
              </svg>
            </div>
            
            {/* Football goal */}
            <div className="absolute bottom-[12%] right-[20%] w-16 h-16 opacity-15">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512">
                <path fill="#444" d="M48 0C21.5 0 0 21.5 0 48V336c0 26.5 21.5 48 48 48h96V448H32c-17.7 0-32 14.3-32 32s14.3 32 32 32H288h32H576c17.7 0 32-14.3 32-32s-14.3-32-32-32H496V384h96c26.5 0 48-21.5 48-48V48c0-26.5-21.5-48-48-48H48zM416 448H224V384H416v64zM160 256c0 17.7-14.3 32-32 32s-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32zm256 0c0 17.7-14.3 32-32 32s-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32z"/>
              </svg>
            </div>
            
            {/* Colorful ribbon confetti */}
            <div className="absolute top-[10%] left-[10%] w-40 h-40 opacity-10 rotate-45 animate-pulse" style={{ animationDuration: '12s' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512">
                <path fill="#8B5CF6" d="M342.6 9.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l9.4 9.4L19.4 329.4c-24.9 24.9-24.9 65.6 0 90.5l72.7 72.7c24.9 24.9 65.6 24.9 90.5 0L448 227.2l9.4 9.4c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-160-160zM151.9 390.1l-2.3-2.3 257-257 2.3 2.3-257 257z"/>
              </svg>
            </div>
            <div className="absolute bottom-[15%] right-[10%] w-40 h-40 opacity-10 -rotate-45 animate-pulse" style={{ animationDuration: '10s' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512">
                <path fill="#EC4899" d="M342.6 9.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l9.4 9.4L19.4 329.4c-24.9 24.9-24.9 65.6 0 90.5l72.7 72.7c24.9 24.9 65.6 24.9 90.5 0L448 227.2l9.4 9.4c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-160-160zM151.9 390.1l-2.3-2.3 257-257 2.3 2.3-257 257z"/>
              </svg>
            </div>
            
            {/* Background pattern grid with team colors */}
            <div className="absolute inset-0">
              <div className="w-full h-full" 
                   style={{ 
                     backgroundImage: "radial-gradient(circle, rgba(59, 130, 246, 0.05) 1px, transparent 1px), radial-gradient(circle, rgba(236, 72, 153, 0.03) 1px, transparent 1px)",  
                     backgroundSize: "30px 30px, 20px 20px",
                     backgroundPosition: "0 0, 15px 15px"
                   }}>
              </div>
            </div>

            {/* Tournament text watermark enriched */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[130px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-200 via-green-100 to-purple-100 opacity-[0.05] text-center leading-none">
              البطولة
              <div className="text-[60px] opacity-70 font-semibold">الوندى 2024</div>
            </div>
            
            {/* Curved lines connecting brackets (like tournament flow) */}
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-200 to-transparent opacity-20"></div>
            <div className="absolute top-[40%] left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-purple-200 to-transparent opacity-15"></div>
            <div className="absolute top-[60%] left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-green-200 to-transparent opacity-15"></div>
            
            {/* Sporty geometric shapes */}
            <div className="absolute top-[40%] right-[5%] w-24 h-24 opacity-10 bg-gradient-to-br from-blue-200 to-transparent rounded-full blur-sm"></div>
            <div className="absolute top-[20%] left-[8%] w-16 h-16 opacity-15 bg-gradient-to-tr from-purple-200 to-transparent rounded-full blur-sm"></div>
            <div className="absolute bottom-[10%] left-[50%] w-32 h-32 opacity-10 bg-gradient-to-tl from-green-200 to-transparent rounded-full blur-md"></div>
            
            {/* Dynamic light rays */}
            <div className="absolute inset-0 bg-gradient-to-b from-blue-50/10 via-transparent to-blue-50/10 opacity-30"></div>
          </div>
          
          <div className="min-w-[1000px] min-h-[650px] relative z-10">
            <div className="flex flex-col h-full">
              <div className="flex justify-between mb-6 mt-2 px-2">
                <div className="w-32 text-center font-bold text-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white py-1.5 rounded-full shadow-md">دور الـ16</div>
                <div className="w-32 text-center font-bold text-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white py-1.5 rounded-full shadow-md">ربع النهائي</div>
                <div className="w-32 text-center font-bold text-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white py-1.5 rounded-full shadow-md">نصف النهائي</div>
                <div className="w-40 text-center font-bold text-lg bg-gradient-to-r from-yellow-500 to-amber-600 text-white py-1.5 rounded-full shadow-md">النهائي</div>
                <div className="w-32 text-center font-bold text-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white py-1.5 rounded-full shadow-md">نصف النهائي</div>
                <div className="w-32 text-center font-bold text-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white py-1.5 rounded-full shadow-md">ربع النهائي</div>
                <div className="w-32 text-center font-bold text-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white py-1.5 rounded-full shadow-md">دور الـ16</div>
              </div>

              <div className="flex w-full justify-between">
                <div className="w-32 flex flex-col justify-around space-y-5">
                  {leftRound16.map(match => (
                    <MatchBox 
                      key={match.id} 
                      match={match} 
                      onClick={() => handleEditMatch(match)} 
                      direction="left"
                      color={bracketColors[match.id]}
                      disabled={assignedTeamsCount >= 16 && !match.matchId}
                    />
                  ))}
                </div>
                
                <div className="w-32 flex flex-col justify-around space-y-10">
                  {leftQuarter.map(match => (
                    <MatchBox 
                      key={match.id} 
                      match={match} 
                      onClick={() => handleEditMatch(match)} 
                      direction="left"
                      color={bracketColors[match.id]}
                      lockTeams={true}
                    />
                  ))}
                </div>
                
                <div className="w-32 flex flex-col justify-center">
                  {semiMatches.length > 0 && (
                    <MatchBox 
                      match={semiMatches[0]} 
                      onClick={() => handleEditMatch(semiMatches[0])} 
                      direction="left"
                      color={bracketColors[semiMatches[0].id]}
                      lockTeams={true}
                    />
                  )}
                </div>
                
                <div className="w-56 flex flex-col justify-center mx-2 relative">
                  {finalMatch && (
                    <div className="flex flex-col items-center">
                      <MatchBox 
                        match={finalMatch} 
                        onClick={() => handleEditMatch(finalMatch)} 
                        isFinal
                        color={bracketColors[finalMatch.id]}
                        lockTeams={true}
                      />
                      
                      {finalMatch.winnerId && (
                        <div className="mt-10 text-center relative">
                          {/* Connection line with animation */}
                          <div className="absolute top-[-30px] left-1/2 h-12 w-1.5 bg-gradient-to-b from-amber-500 to-yellow-300 transform -translate-x-1/2 animate-pulse"></div>
                          
                          {/* Trophy icon with animation */}
                          <div className="absolute top-[-40px] left-1/2 transform -translate-x-1/2 animate-bounce" style={{animationDuration: '3s'}}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="url(#trophy-gradient)">
                              <defs>
                                <linearGradient id="trophy-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                  <stop offset="0%" stopColor="#f59e0b" />
                                  <stop offset="100%" stopColor="#d97706" />
                                </linearGradient>
                              </defs>
                              <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
                            </svg>
                          </div>
                          
                          <div className="text-lg font-semibold text-amber-800 mb-2">بطل البطولة</div>
                          
                          <div className="relative p-5 py-4 rounded-lg font-bold text-yellow-900 shadow-xl
                            transform transition-all duration-500 hover:scale-110
                            bg-gradient-to-br from-yellow-100 via-amber-100 to-yellow-200 border-2 border-yellow-400">
                            {/* Inner glow effect */}
                            <div className="absolute inset-0 bg-amber-200 opacity-20 rounded-lg"></div>
                            
                            {/* Decorative corners */}
                            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-yellow-500 rounded-tl-sm"></div>
                            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-yellow-500 rounded-tr-sm"></div>
                            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-yellow-500 rounded-bl-sm"></div>
                            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-yellow-500 rounded-br-sm"></div>
                            
                            <div className="relative z-10">
                              {finalMatch.winnerId === finalMatch.teamA?.id 
                                ? finalMatch.teamA.name 
                                : finalMatch.teamB?.name}
                            </div>
                            
                            {/* Crown on top */}
                            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                              <span className="text-yellow-600 text-2xl filter drop-shadow-md">👑</span>
                            </div>
                            
                            {/* Celebration confetti */}
                            <div className="absolute -top-10 -left-10 w-[200%] h-[200%] opacity-20 overflow-hidden">
                              <div className="animate-confetti1 absolute w-2 h-2 bg-yellow-400 rounded-full" style={{top: '20%', left: '10%'}}></div>
                              <div className="animate-confetti2 absolute w-2 h-2 bg-blue-400 rounded-full" style={{top: '40%', left: '20%'}}></div>
                              <div className="animate-confetti1 absolute w-2 h-2 bg-green-400 rounded-full" style={{top: '30%', left: '30%'}}></div>
                              <div className="animate-confetti2 absolute w-2 h-2 bg-red-400 rounded-full" style={{top: '10%', left: '40%'}}></div>
                              <div className="animate-confetti1 absolute w-2 h-2 bg-purple-400 rounded-full" style={{top: '50%', left: '50%'}}></div>
                              <div className="animate-confetti2 absolute w-2 h-2 bg-pink-400 rounded-full" style={{top: '20%', left: '60%'}}></div>
                              <div className="animate-confetti1 absolute w-2 h-2 bg-indigo-400 rounded-full" style={{top: '40%', left: '70%'}}></div>
                              <div className="animate-confetti2 absolute w-2 h-2 bg-yellow-400 rounded-full" style={{top: '30%', left: '80%'}}></div>
                            </div>
                            
                            {/* Radial shine effect */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-yellow-100/80 to-transparent opacity-50 rounded-lg"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="w-32 flex flex-col justify-center">
                  {semiMatches.length > 1 && (
                    <MatchBox 
                      match={semiMatches[1]} 
                      onClick={() => handleEditMatch(semiMatches[1])} 
                      direction="right"
                      color={bracketColors[semiMatches[1].id]}
                      lockTeams={true}
                    />
                  )}
                </div>
                
                <div className="w-32 flex flex-col justify-around space-y-10">
                  {rightQuarter.map(match => (
                    <MatchBox 
                      key={match.id} 
                      match={match} 
                      onClick={() => handleEditMatch(match)} 
                      direction="right"
                      color={bracketColors[match.id]}
                      lockTeams={true}
                    />
                  ))}
                </div>
                
                <div className="w-32 flex flex-col justify-around space-y-5">
                  {rightRound16.map(match => (
                    <MatchBox 
                      key={match.id} 
                      match={match} 
                      onClick={() => handleEditMatch(match)} 
                      direction="right"
                      color={bracketColors[match.id]}
                      disabled={assignedTeamsCount >= 16 && !match.matchId}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  useEffect(() => {
    if (!tournament || !matches.length) return;
    
    if (['round16', 'quarter', 'semi', 'final', 'completed'].includes(tournament.currentStage) && 
        knockoutBracket.length === 0) {
      const initializeFromExistingMatches = async () => {
        const bracket = await initializeEmptyBracket();
        const newAssignedTeams = new Set<string>();
        
        const knockoutMatches = matches.filter(match => 
          ['round16', 'quarter', 'semi', 'final'].includes(match.stage)
        );
        
        for (const match of knockoutMatches) {
          let bracketPosition = 1;
          let round: 'round16' | 'quarter' | 'semi' | 'final' = 'round16';
          
          round = match.stage as 'round16' | 'quarter' | 'semi' | 'final';
          
          if (match.groupId) {
            const posStr = match.groupId || '1';
            bracketPosition = parseInt(posStr, 10) || 1;
          }
          
          const bracketMatch = bracket.find(bm => bm.round === round && bm.position === bracketPosition);
          if (!bracketMatch) continue;
          
          const teamA = teams.find(team => team._id === match.teamAId);
          const teamB = teams.find(team => team._id === match.teamBId);
          
          if (teamA) {
            bracketMatch.teamA = {
              id: teamA._id,
              name: teamA.name
            };
            newAssignedTeams.add(teamA._id);
          }
          
          if (teamB) {
            bracketMatch.teamB = {
              id: teamB._id,
              name: teamB.name
            };
            newAssignedTeams.add(teamB._id);
          }
          
          bracketMatch.matchId = match._id;
          if (match.score) {
            bracketMatch.score = {
              teamA: match.score.teamA !== undefined ? match.score.teamA : 0,
              teamB: match.score.teamB !== undefined ? match.score.teamB : 0
            };
            
            if (match.status === 'completed') {
              if (match.score.teamA > match.score.teamB) {
                bracketMatch.winnerId = match.teamAId;
              } else if (match.score.teamB > match.score.teamA) {
                bracketMatch.winnerId = match.teamBId;
              } else {
                bracketMatch.winnerId = match.teamAId;
              }
            }
          }
        }
        
        setKnockoutBracket(bracket);
        setAssignedTeamIds(newAssignedTeams);
      };
      
      initializeFromExistingMatches();
    }
  }, [tournament, matches.length, teams, knockoutBracket.length]);

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

  const getGroupTeams = useMemo(() => {
    return (groupId: Id<"groups">) => {
      return teams.filter((team) => {
        const targetGroup = groups.find(g => g._id === groupId);
        if (team.groupId && targetGroup && team.groupId === targetGroup.name) {
          return true;
        }
        return targetGroup?.teams.includes(team._id as Id<"teams">) || false;
      });
    };
  }, [teams, groups]);

  const handleEditTeams = (group: Group) => {
    setEditingGroup(group);
    setEditingGroupName(group.name);
    
    const initialTeams: { [teamId: string]: boolean } = {};
    teams.forEach(team => {
      if (team._id) {
        const isInGroup = group.teams.includes(team._id as Id<"teams">) || 
                          (team.groupId && team.groupId === group.name);
        initialTeams[team._id] = Boolean(isInGroup);
      }
    });
    
    setEditingGroupTeams(initialTeams);
  };

  const handleSaveTeamChanges = async () => {
    if (!editingGroup) return;
    
    try {
      setSyncMessage("جاري حفظ التغييرات...");
      
      const assignments = teams
        .filter(team => editingGroupTeams[team._id])
        .map(team => ({
          teamId: team._id as Id<"teams">,
          groupId: editingGroup._id,
        }));
      
      await assignTeamsToGroups({ assignments });
      
      if (editingGroupName !== editingGroup.name) {
        await updateGroupName({
          groupId: editingGroup._id,
          newName: editingGroupName
        });
      }
      
      setEditingGroup(null);
      setEditingGroupTeams({});
      setEditingGroupName("");
      
      await syncGroupsAndTeams({});
      
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

      {(!tournament || tournament.currentStage === "setup" || tournament.currentStage === "group") && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">إدارة المجموعات</h3>
          </div>

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
                                setNewGroup({
                                  ...newGroup,
                                  teams: [...newGroup.teams, team._id]
                                });
                              } else {
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

      {tournament && tournament.currentStage !== "setup" && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-medium mb-4">تقدم البطولة</h3>
          
          <div className="flex justify-between items-center mb-6">
            {["group", "round16", "quarter", "semi", "final", "completed"].map((stage, index) => {
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
          
          {tournament?.currentStage === "group" && (
            <div className="p-4 bg-blue-50 rounded-md">
              <p className="text-center font-medium">
                البطولة حالياً في مرحلة المجموعات. قم بجدولة المباريات وتسجيل النتائج.
              </p>
              
              <div className="mt-4 text-center">
                <button 
                  onClick={handleAdvanceStage} 
                  className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 disabled:bg-gray-300"
                  disabled={processingAdvancement}
                >
                  {processingAdvancement 
                    ? "جاري إعداد دور الـ16..."
                    : "الانتقال إلى دور الـ16 واختيار الفرق المتأهلة"
                  }
                </button>
                {processingAdvancement && (
                  <div className="mt-2 text-yellow-700 text-sm">
                    هذه العملية قد تستغرق بضع ثوانٍ لاختيار الفرق المتأهلة وإنشاء جدول المباريات
                  </div>
                )}
              </div>
            </div>
          )}
          
          {tournament?.currentStage === "round16" && (
            <div className="p-4 bg-blue-50 rounded-md">
              <p className="text-center font-medium">
                البطولة حالياً في دور الـ16. الفرق المتأهلة من دور المجموعات تتنافس الآن.
              </p>
            </div>
          )}
          
          {tournament?.currentStage === "quarter" && (
            <div className="p-4 bg-blue-50 rounded-md">
              <p className="text-center font-medium">
                البطولة حالياً في ربع النهائي. أفضل الفرق تتنافس على التأهل لنصف النهائي.
              </p>
            </div>
          )}
          
          {tournament?.currentStage === "semi" && (
            <div className="p-4 bg-blue-50 rounded-md">
              <p className="text-center font-medium">
                البطولة حالياً في نصف النهائي. فرصة الوصول للنهائي على المحك.
              </p>
            </div>
          )}
          
          {tournament?.currentStage === "final" && (
            <div className="p-4 bg-blue-50 rounded-md">
              <p className="text-center font-medium">
                البطولة حالياً في المباراة النهائية. الفائز سيتوج بطلاً للبطولة.
              </p>
            </div>
          )}
          
          {tournament?.currentStage === "completed" && (
            <div className="p-4 bg-green-50 rounded-md">
              <p className="text-center font-medium">
                انتهت البطولة! تهانينا للفريق الفائز!
              </p>
            </div>
          )}
          
          {['round16', 'quarter', 'semi', 'final', 'completed'].includes(tournament.currentStage) && (
            <TournamentBracketDisplay />
          )}
        </div>
      )}

      {editingGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">تعديل المجموعة</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">اسم المجموعة</label>
              <input
                type="text"
                value={editingGroupName}
                onChange={(e) => setEditingGroupName(e.target.value)}
                className="w-full p-2 border rounded-md"
                placeholder="اسم المجموعة"
              />
            </div>
            
            <h4 className="font-medium mb-2">الفرق في المجموعة</h4>
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
                  setEditingGroupName("");
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

      {editingBracketMatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">
                {editingBracketMatch.round === 'round16' && 'دور الـ16: '}
                {editingBracketMatch.round === 'quarter' && 'ربع النهائي: '}
                {editingBracketMatch.round === 'semi' && 'نصف النهائي: '}
                {editingBracketMatch.round === 'final' && 'النهائي: '}
                تعيين الفرق
              </h3>
              <button 
                onClick={() => setEditingBracketMatch(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">الفريق الأول</label>
              <select
                value={editingBracketMatch.teamA?.id || ""}
                onChange={(e) => {
                  const selectedTeam = teams.find(t => t._id === e.target.value);
                  if (selectedTeam) {
                    setEditingBracketMatch({
                      ...editingBracketMatch,
                      teamA: {
                        id: selectedTeam._id,
                        name: selectedTeam.name,
                      },
                    });
                  } else if (e.target.value === "") {
                    setEditingBracketMatch({
                      ...editingBracketMatch,
                      teamA: undefined
                    });
                  }
                }}
                className="w-full p-2 border rounded-md"
                disabled={editingBracketMatch.round !== 'round16'}
              >
                <option value="">اختر الفريق</option>
                {teams.map((team) => (
                  <option key={team._id} value={team._id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">الفريق الثاني</label>
              <select
                value={editingBracketMatch.teamB?.id || ""}
                onChange={(e) => {
                  const selectedTeam = teams.find(t => t._id === e.target.value);
                  if (selectedTeam) {
                    setEditingBracketMatch({
                      ...editingBracketMatch,
                      teamB: {
                        id: selectedTeam._id,
                        name: selectedTeam.name,
                      },
                    });
                  } else if (e.target.value === "") {
                    setEditingBracketMatch({
                      ...editingBracketMatch,
                      teamB: undefined
                    });
                  }
                }}
                className="w-full p-2 border rounded-md"
                disabled={editingBracketMatch.round !== 'round16'}
              >
                <option value="">اختر الفريق</option>
                {teams.map((team) => (
                  <option key={team._id} value={team._id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">التاريخ</label>
                <input
                  type="date"
                  value={editingBracketMatch.matchDate || ""}
                  onChange={(e) => 
                    setEditingBracketMatch({
                      ...editingBracketMatch,
                      matchDate: e.target.value
                    })
                  }
                  className="w-full p-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">الوقت</label>
                <input
                  type="time"
                  value={editingBracketMatch.matchTime || ""}
                  onChange={(e) => 
                    setEditingBracketMatch({
                      ...editingBracketMatch,
                      matchTime: e.target.value
                    })
                  }
                  className="w-full p-2 border rounded-md"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setEditingBracketMatch(null)}
                className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400 ml-2"
              >
                إلغاء
              </button>
              {editingBracketMatch.round === 'round16' && !editingBracketMatch.matchId && (
                <button
                  onClick={handleSaveBracketTeams}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  حفظ
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
