import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface Player {
  fullName: string;
  feeStatus: boolean;
  photoUrl?: string;
  paymentDate?: string;
}

interface Team {
  _id: Id<"teams">;
  name: string;
  players: Player[];
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

function isValidPlayer(player: any): player is Player {
  return (
    typeof player.fullName === 'string' &&
    typeof player.feeStatus === 'boolean'
  );
}

export function TeamManagement() {
  const teams = useQuery(api.teams.list) || [];
  const createTeam = useMutation(api.teams.create);
  const updateTeam = useMutation(api.teams.update);
  const deleteTeam = useMutation(api.teams.remove);
  const syncTeamStats = useMutation(api.tournament.syncTeamStats);

  const [newTeam, setNewTeam] = useState({
    name: "",
    players: [],
  });

  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const [editingTeamName, setEditingTeamName] = useState("");
  const [newPlayer, setNewPlayer] = useState<Player>({
    fullName: "",
    feeStatus: false,
    photoUrl: "",
  });
  
  const [editingPlayer, setEditingPlayer] = useState<{
    teamId: Id<"teams">;
    playerIndex: number;
    player: Player;
  } | null>(null);
  
  const [selectedPlayers, setSelectedPlayers] = useState<{
    [teamId: string]: number[];
  }>({});
  
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTeam.name.trim()) {
      await createTeam({
        name: newTeam.name,
        players: [],
        stats: {
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          points: 0,
        },
      });
      setNewTeam({ name: "", players: [] });
    }
  };

  const handleAddPlayer = (teamId: Id<"teams">) => {
    if (newPlayer.fullName) {
      const team = teams.find((t) => t._id === teamId);
      if (team && team.players.length < 10) {
        const playerWithPaymentDate = newPlayer as Player;
        
        updateTeam({
          teamId,
          players: [...team.players, playerWithPaymentDate],
        });
        
        setNewPlayer({
          fullName: "",
          feeStatus: false,
          photoUrl: "",
        });
        setShowAddPlayer(false);
      }
    }
  };

  const togglePlayerFeeStatus = (teamId: Id<"teams">, playerIndex: number) => {
    const team = teams.find((t) => t._id === teamId);
    if (team) {
      const updatedPlayers = [...team.players];
      const newFeeStatus = !updatedPlayers[playerIndex].feeStatus;
      
      updatedPlayers[playerIndex] = {
        ...updatedPlayers[playerIndex],
        feeStatus: newFeeStatus,
        paymentDate: newFeeStatus ? new Date().toISOString().split('T')[0] : undefined
      };
      
      updateTeam({
        teamId,
        players: updatedPlayers,
      });
    }
  };
  
  const deletePlayer = (teamId: Id<"teams">, playerIndex: number) => {
    const team = teams.find((t) => t._id === teamId);
    if (team) {
      const updatedPlayers = [...team.players];
      updatedPlayers.splice(playerIndex, 1);
      
      updateTeam({
        teamId,
        players: updatedPlayers,
      });
      
      if (selectedPlayers[teamId.toString()]) {
        const newSelected = { ...selectedPlayers };
        newSelected[teamId.toString()] = newSelected[teamId.toString()].filter(
          idx => idx !== playerIndex && idx < playerIndex
        ).map(idx => idx > playerIndex ? idx - 1 : idx);
        setSelectedPlayers(newSelected);
      }
    }
  };
  
  const startEditingPlayer = (teamId: Id<"teams">, playerIndex: number) => {
    const team = teams.find((t) => t._id === teamId);
    if (team) {
      setEditingPlayer({
        teamId,
        playerIndex,
        player: { ...team.players[playerIndex] }
      });
    }
  };
  
  const saveEditedPlayer = () => {
    if (editingPlayer) {
      const { teamId, playerIndex, player } = editingPlayer;
      const team = teams.find((t) => t._id === teamId);
      
      if (team) {
        const updatedPlayers = [...team.players];
        updatedPlayers[playerIndex] = player;
        
        updateTeam({
          teamId,
          players: updatedPlayers,
        });
        
        setEditingPlayer(null);
      }
    }
  };
  
  const togglePlayerSelection = (teamId: Id<"teams">, playerIndex: number) => {
    const teamIdStr = teamId.toString();
    const newSelected = { ...selectedPlayers };
    
    if (!newSelected[teamIdStr]) {
      newSelected[teamIdStr] = [];
    }
    
    const selectedIndex = newSelected[teamIdStr].indexOf(playerIndex);
    if (selectedIndex === -1) {
      newSelected[teamIdStr].push(playerIndex);
    } else {
      newSelected[teamIdStr].splice(selectedIndex, 1);
    }
    
    if (newSelected[teamIdStr].length === 0) {
      delete newSelected[teamIdStr];
    }
    
    setSelectedPlayers(newSelected);
  };
  
  const isPlayerSelected = (teamId: Id<"teams">, playerIndex: number) => {
    const teamIdStr = teamId.toString();
    return selectedPlayers[teamIdStr]?.includes(playerIndex) || false;
  };
  
  const bulkUpdateFeeStatus = (teamId: Id<"teams">, feeStatus: boolean) => {
    const teamIdStr = teamId.toString();
    if (!selectedPlayers[teamIdStr] || selectedPlayers[teamIdStr].length === 0) {
      return;
    }
    
    const team = teams.find((t) => t._id === teamId);
    if (team) {
      const updatedPlayers = [...team.players];
      
      for (const playerIndex of selectedPlayers[teamIdStr]) {
        const updatedPlayer: Player = {
          ...updatedPlayers[playerIndex],
          feeStatus,
        };
        
        if (feeStatus) {
          updatedPlayer.paymentDate = new Date().toISOString().split('T')[0];
        } else {
          updatedPlayer.paymentDate = undefined;
        }
        
        updatedPlayers[playerIndex] = updatedPlayer;
      }
      
      updateTeam({
        teamId,
        players: updatedPlayers,
      });
      
      const newSelected = { ...selectedPlayers };
      delete newSelected[teamIdStr];
      setSelectedPlayers(newSelected);
    }
  };
  
  const getSelectedPlayersCount = (teamId: Id<"teams">) => {
    const teamIdStr = teamId.toString();
    return selectedPlayers[teamIdStr]?.length || 0;
  };

  const handleEditTeam = (team: Team) => {
    setEditingTeam(team);
    setEditingTeamName(team.name);
    setShowEditTeamModal(true);
  };

  const handleSaveTeamName = async () => {
    if (editingTeam && editingTeamName.trim()) {
      await updateTeam({
        teamId: editingTeam._id,
        name: editingTeamName,
      });
      
      setShowEditTeamModal(false);
      setEditingTeam(null);
    }
  };

  // Function to handle team stats synchronization
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

  return (
    <div className="space-y-6">
      {/* Section Title */}
      <div className="border-b pb-4 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">إدارة الفرق</h2>
          <p className="text-gray-600">إضافة وتعديل الفرق واللاعبين</p>
        </div>
        <div className="flex items-center">
          {syncMessage && (
            <span className={`ml-3 px-3 py-1 rounded-md text-sm ${syncMessage.includes("خطأ") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
              {syncMessage}
            </span>
          )}
          <button
            onClick={handleSyncTeamStats}
            disabled={syncing}
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-blue-300 ml-3"
          >
            {syncing ? "جاري المزامنة..." : "مزامنة الإحصائيات"}
          </button>
        </div>
      </div>

      <form onSubmit={handleCreateTeam} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">اسم الفريق</label>
          <input
            type="text"
            value={newTeam.name}
            onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
            className="w-full p-2 border rounded-md"
            placeholder="أدخل اسم الفريق"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
        >
          إضافة فريق
        </button>
      </form>

      <div className="space-y-4">
        {teams.map((team) => (
          <div key={team._id} className="border rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">{team.name}</h3>
              <div className="space-x-2">
                <button
                  onClick={() => handleEditTeam(team)}
                  className="bg-yellow-500 text-white px-3 py-1 rounded-md hover:bg-yellow-600"
                >
                  تعديل
                </button>
                <button
                  onClick={() => deleteTeam({ teamId: team._id })}
                  className="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600"
                >
                  حذف
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="font-medium">اللاعبين ({team.players.length}/10)</h4>
                
                {getSelectedPlayersCount(team._id) > 0 && (
                  <div className="flex space-x-2">
                    <span className="text-sm text-gray-600 ml-2">
                      {getSelectedPlayersCount(team._id)} لاعب محدد
                    </span>
                    <button 
                      onClick={() => bulkUpdateFeeStatus(team._id, true)}
                      className="bg-green-500 text-white px-2 py-1 text-xs rounded hover:bg-green-600"
                    >
                      تعيين كمدفوع
                    </button>
                    <button 
                      onClick={() => bulkUpdateFeeStatus(team._id, false)}
                      className="bg-red-500 text-white px-2 py-1 text-xs rounded hover:bg-red-600"
                    >
                      تعيين كغير مدفوع
                    </button>
                  </div>
                )}
              </div>
              
              {team.players.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">
                          <input 
                            type="checkbox" 
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPlayers({
                                  ...selectedPlayers,
                                  [team._id.toString()]: Array.from(Array(team.players.length).keys())
                                });
                              } else {
                                const newSelected = { ...selectedPlayers };
                                delete newSelected[team._id.toString()];
                                setSelectedPlayers(newSelected);
                              }
                            }}
                            checked={getSelectedPlayersCount(team._id) === team.players.length && team.players.length > 0}
                          />
                        </th>
                        <th className="px-6 py-2 text-right text-xs font-medium text-gray-500">اللاعب</th>
                        <th className="px-6 py-2 text-right text-xs font-medium text-gray-500">حالة الدفع</th>
                        <th className="px-6 py-2 text-right text-xs font-medium text-gray-500">تاريخ الدفع</th>
                        <th className="px-6 py-2 text-right text-xs font-medium text-gray-500">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {team.players.map((player, index) => (
                        <tr key={index}>
                          <td className="px-2 py-3 whitespace-nowrap">
                            <input 
                              type="checkbox" 
                              checked={isPlayerSelected(team._id, index)}
                              onChange={() => togglePlayerSelection(team._id, index)}
                            />
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap">
                            <p className="font-medium">{player.fullName}</p>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap">
                            <button
                              onClick={() => togglePlayerFeeStatus(team._id, index)}
                              className={`px-2 py-1 rounded cursor-pointer hover:opacity-80 transition-opacity flex items-center ${
                                player.feeStatus
                                  ? "bg-green-100 text-green-800 hover:bg-green-200"
                                  : "bg-red-100 text-red-800 hover:bg-red-200"
                              }`}
                            >
                              {player.feeStatus ? (
                                <>
                                  <span className="mx-1">✓</span>
                                  <span>تم الدفع</span>
                                </>
                              ) : (
                                <>
                                  <span className="mx-1">✗</span>
                                  <span>لم يتم الدفع</span>
                                </>
                              )}
                            </button>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                            {player.paymentDate || "-"}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm">
                            <button
                              onClick={() => startEditingPlayer(team._id, index)}
                              className="text-blue-600 hover:text-blue-900 mx-1"
                            >
                              تعديل
                            </button>
                            <button
                              onClick={() => deletePlayer(team._id, index)}
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
              )}

              {team.players.length < 10 && (
                <button
                  onClick={() => {
                    setShowAddPlayer(true);
                    setEditingTeam(team);
                  }}
                  className="mt-2 bg-green-500 text-white px-3 py-1 rounded-md hover:bg-green-600"
                >
                  إضافة لاعب
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showAddPlayer && editingTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">إضافة لاعب لفريق {editingTeam.name}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  اسم اللاعب
                </label>
                <input
                  type="text"
                  value={newPlayer.fullName}
                  onChange={(e) =>
                    setNewPlayer({ ...newPlayer, fullName: e.target.value })
                  }
                  className="w-full p-2 border rounded-md"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={newPlayer.feeStatus}
                  onChange={(e) => {
                    const newFeeStatus = e.target.checked;
                    setNewPlayer({ 
                      ...newPlayer, 
                      feeStatus: newFeeStatus,
                      paymentDate: newFeeStatus ? new Date().toISOString().split('T')[0] : undefined 
                    });
                  }}
                  className="mr-2"
                />
                <label className="text-sm font-medium">تم دفع الرسوم</label>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => handleAddPlayer(editingTeam._id)}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                >
                  إضافة
                </button>
                <button
                  onClick={() => {
                    setShowAddPlayer(false);
                    setEditingTeam(null);
                  }}
                  className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {editingPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">تعديل بيانات اللاعب</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  اسم اللاعب
                </label>
                <input
                  type="text"
                  value={editingPlayer.player.fullName}
                  onChange={(e) =>
                    setEditingPlayer({
                      ...editingPlayer,
                      player: { ...editingPlayer.player, fullName: e.target.value }
                    })
                  }
                  className="w-full p-2 border rounded-md"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={editingPlayer.player.feeStatus}
                  onChange={(e) => {
                    const newFeeStatus = e.target.checked;
                    setEditingPlayer({
                      ...editingPlayer,
                      player: { 
                        ...editingPlayer.player, 
                        feeStatus: newFeeStatus,
                        paymentDate: newFeeStatus ? new Date().toISOString().split('T')[0] : undefined
                      }
                    });
                  }}
                  className="mr-2"
                />
                <label className="text-sm font-medium">تم دفع الرسوم</label>
              </div>
              {editingPlayer.player.feeStatus && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    تاريخ الدفع
                  </label>
                  <input
                    type="date"
                    value={editingPlayer.player.paymentDate || ""}
                    onChange={(e) =>
                      setEditingPlayer({
                        ...editingPlayer,
                        player: { ...editingPlayer.player, paymentDate: e.target.value }
                      })
                    }
                    className="w-full p-2 border rounded-md"
                  />
                </div>
              )}
              <div className="flex justify-end space-x-2">
                <button
                  onClick={saveEditedPlayer}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                >
                  حفظ
                </button>
                <button
                  onClick={() => setEditingPlayer(null)}
                  className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditTeamModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">تعديل اسم الفريق</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  اسم الفريق
                </label>
                <input
                  type="text"
                  value={editingTeamName}
                  onChange={(e) => setEditingTeamName(e.target.value)}
                  className="w-full p-2 border rounded-md"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={handleSaveTeamName}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                >
                  حفظ
                </button>
                <button
                  onClick={() => setShowEditTeamModal(false)}
                  className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
