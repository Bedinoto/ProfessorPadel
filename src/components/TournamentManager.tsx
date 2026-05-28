import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, addDoc, doc, updateDoc, deleteDoc, query, where, onSnapshot 
} from 'firebase/firestore';
import { Tournament, TournamentTeam, TournamentMatch } from '../types';
import { 
  Trophy, Plus, Trash2, Edit2, Share2, Copy, ExternalLink, 
  Settings, Users, Calendar, Award, Check, Clock, ShieldAlert,
  ChevronRight, ArrowRight, HelpCircle, AlertCircle, Info, MapPin
} from 'lucide-react';

interface TournamentManagerProps {
  user: any;
  setToast: (t: { message: string, type: 'success' | 'error' | 'info' }) => void;
}

export function TournamentManager({ user, setToast }: TournamentManagerProps) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  
  // Tabs inside Tournament Management
  const [activeSubTab, setActiveSubTab] = useState<'info' | 'teams' | 'matches' | 'standings'>('info');

  // Form states for creating a tournament
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTourney, setNewTourney] = useState({
    name: '',
    type: 'padel' as 'padel' | 'beach',
    rules: '',
    locations: ['Quadra 1'],
    times: ['08:00', '09:30', '11:00', '14:00', '15:30', '17:00'],
    dates: [] as string[],
    categories: ['Iniciante', 'Mista B', 'Masculino C']
  });

  const [dateInput, setDateInput] = useState('');
  const [timeInput, setTimeInput] = useState('');
  const [locInput, setLocInput] = useState('');
  const [catInput, setCatInput] = useState('');

  // Form states for inserting teams
  const [newTeam, setNewTeam] = useState({
    category: '',
    group_name: 'Chave A',
    player1_name: '',
    player1_phone: '',
    player2_name: '',
    player2_phone: ''
  });

  // Selected filters for teams & matches view
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterGroup, setFilterGroup] = useState<string>('all');

  // Match edit states
  const [editingMatch, setEditingMatch] = useState<TournamentMatch | null>(null);
  const [score1, setScore1] = useState<string[]>(['0', '0', '0']);
  const [score2, setScore2] = useState<string[]>(['0', '0', '0']);
  const [matchStatus, setMatchStatus] = useState<'agendado' | 'em_andamento' | 'encerrado'>('agendado');
  const [matchWinnerId, setMatchWinnerId] = useState<string>('');

  // Pre-filled Rules Templates
  const padelDefaultRules = `### REGRAS DO TORNEIO DE PADEL

1. **Formato das Partidas:**
   * Fase de Grupos: Partidas jogadas em set único de 6 games (com tiebreak de 7 pontos se empatar em 5-5 ou 6-6) OU melhor de 3 sets curtos (até 4 games).
   * Fase Eliminatória: Jogos em melhor de 3 sets completos. Em caso de empate de 1-1 em sets, disputa-se um Super Tie-break até 10 pontos no 3º set.

2. **Ponto de Ouro (Golden Point / No-Ad):**
   * No empate em 40-40, disputa-se um ponto decisivo. A dupla receptora escolhe o lado que deseja receber o saque. Quem vencer o ponto ganha o game.

3. **Pontuação na Chave:**
   * Vitória: 2 pontos.
   * Derrota comercial: 1 ponto.
   * W.O. (Não comparecimento): 0 pontos (Vitória declarada da outra dupla por 6-0).

4. **Critérios de Desempate na Fase de Grupos:**
   1. Maior número de pontos.
   2. Confronto direto (se houver empate entre duas duplas).
   3. Melhor saldo de sets.
   4. Melhor saldo de games.
   5. Sorteio.`;

  const beachDefaultRules = `### REGRAS DO TORNEIO DE BEACH TENNIS

1. **Formato das Partidas:**
   * Fase de Grupos: Partidas jogadas em set único de 6 games (com tiebreak de 7 pontos no empate em 5-5).
   * Fase Final: Jogos em melhor de 3 sets com super tiebreak até 10 pontos substituindo o 3º set.

2. **Sem Vantagem de Serviço (No-Ad):**
   * Em Beach Tennis, não há vantagem. No empate em 40-40, o próximo ponto define o game. O saque pode ser efetuado de qualquer ponto atrás da linha e direcionado a qualquer área da quadra adversária.

3. **Net / Let no Saque:**
   * Não existe "let" no saque de Beach Tennis. Se a bola tocar a fita da rede e passar para o lado adversário, o jogo continua normalmente.

4. **Pontuação de Classificação:**
   * Vitória: 2 pontos.
   * Derrota comercial: 1 ponto.
   * W.O.: 0 pontos.

5. **Critérios de Desempate:**
   1. Vitórias.
   2. Confronto direto.
   3. Saldo de sets.
   4. Saldo de games.`;

  // Monitor Tournaments list
  useEffect(() => {
    const q = query(collection(db, 'tournaments'), where('teacher_id', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament));
      setTournaments(list);
      if (list.length > 0 && !selectedTournament) {
        setSelectedTournament(list[0]);
      }
    });
    return () => unsubscribe();
  }, [user.uid]);

  // Monitor Teams and Matches of selected tournament
  useEffect(() => {
    if (!selectedTournament) {
      setTeams([]);
      setMatches([]);
      return;
    }

    const qTeams = query(collection(db, 'tournament_teams'), where('tournament_id', '==', selectedTournament.id));
    const unsubTeams = onSnapshot(qTeams, (snapshot) => {
      setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TournamentTeam)));
    });

    const qMatches = query(collection(db, 'tournament_matches'), where('tournament_id', '==', selectedTournament.id));
    const unsubMatches = onSnapshot(qMatches, (snapshot) => {
      setMatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TournamentMatch)));
    });

    // Auto set category filter
    if (selectedTournament.categories && selectedTournament.categories.length > 0) {
      setFilterCategory(selectedTournament.categories[0]);
      setNewTeam(prev => ({ ...prev, category: selectedTournament.categories[0] }));
    }

    return () => {
      unsubTeams();
      unsubMatches();
    };
  }, [selectedTournament]);

  // Auto trigger default rules when tourney type shifts
  useEffect(() => {
    setNewTourney(prev => ({
      ...prev,
      rules: prev.type === 'padel' ? padelDefaultRules : beachDefaultRules
    }));
  }, [newTourney.type]);

  // Form handle helpers
  const handleAddDate = () => {
    if (dateInput && !newTourney.dates.includes(dateInput)) {
      setNewTourney(prev => ({ ...prev, dates: [...prev.dates, dateInput].sort() }));
      setDateInput('');
    }
  };

  const handleRemoveDate = (index: number) => {
    setNewTourney(prev => ({ ...prev, dates: prev.dates.filter((_, i) => i !== index) }));
  };

  const handleAddTime = () => {
    if (timeInput && !newTourney.times.includes(timeInput)) {
      setNewTourney(prev => ({ ...prev, times: [...prev.times, timeInput].sort() }));
      setTimeInput('');
    }
  };

  const handleRemoveTime = (index: number) => {
    setNewTourney(prev => ({ ...prev, times: prev.times.filter((_, i) => i !== index) }));
  };

  const handleAddLocation = () => {
    if (locInput && !newTourney.locations.includes(locInput)) {
      setNewTourney(prev => ({ ...prev, locations: [...prev.locations, locInput] }));
      setLocInput('');
    }
  };

  const handleRemoveLocation = (index: number) => {
    setNewTourney(prev => ({ ...prev, locations: prev.locations.filter((_, i) => i !== index) }));
  };

  const handleAddCategory = () => {
    if (catInput && !newTourney.categories.includes(catInput)) {
      setNewTourney(prev => ({ ...prev, categories: [...prev.categories, catInput] }));
      setCatInput('');
    }
  };

  const handleRemoveCategory = (index: number) => {
    setNewTourney(prev => ({ ...prev, categories: prev.categories.filter((_, i) => i !== index) }));
  };

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTourney.name.trim()) {
      setToast({ message: 'Digite o nome do torneio!', type: 'error' });
      return;
    }
    if (newTourney.dates.length === 0) {
      setToast({ message: 'Adicione pelo menos uma data para os jogos!', type: 'error' });
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'tournaments'), {
        teacher_id: user.uid,
        name: newTourney.name.trim(),
        type: newTourney.type,
        rules: newTourney.rules,
        locations: newTourney.locations,
        times: newTourney.times,
        dates: newTourney.dates,
        categories: newTourney.categories,
        created_at: new Date().toISOString()
      });
      setToast({ message: 'Torneio criado com sucesso!', type: 'success' });
      setShowCreateForm(false);
      setNewTourney({
        name: '',
        type: 'padel',
        rules: padelDefaultRules,
        locations: ['Quadra 1'],
        times: ['08:00', '09:30', '11:00', '14:00', '15:30', '17:00'],
        dates: [],
        categories: ['Iniciante', 'Mista B', 'Masculino C']
      });
    } catch (e: any) {
      setToast({ message: 'Erro ao criar o torneio: ' + e.message, type: 'error' });
    }
  };

  const handleDeleteTournament = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja apagar permanentemente este torneio e todos os seus jogos/equipes?')) return;
    try {
      await deleteDoc(doc(db, 'tournaments', id));
      setSelectedTournament(null);
      setToast({ message: 'Torneio apagado!', type: 'success' });
    } catch (e: any) {
      setToast({ message: 'Erro ao apagar torneio: ' + e.message, type: 'error' });
    }
  };

  // Add team handler
  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTournament) return;
    if (!newTeam.category) {
      setToast({ message: 'Escolha uma categoria!', type: 'error' });
      return;
    }
    if (!newTeam.player1_name.trim() || !newTeam.player2_name.trim()) {
      setToast({ message: 'Preencha o nome dos 2 jogadores!', type: 'error' });
      return;
    }

    try {
      await addDoc(collection(db, 'tournament_teams'), {
        teacher_id: user.uid,
        tournament_id: selectedTournament.id,
        category: newTeam.category,
        group_name: newTeam.group_name.trim() || 'Chave A',
        player1_name: newTeam.player1_name.trim(),
        player1_phone: newTeam.player1_phone.trim(),
        player2_name: newTeam.player2_name.trim(),
        player2_phone: newTeam.player2_phone.trim()
      });

      setToast({ message: 'Equipe cadastrada!', type: 'success' });
      setNewTeam(prev => ({
        ...prev,
        player1_name: '',
        player1_phone: '',
        player2_name: '',
        player2_phone: ''
      }));
    } catch (e: any) {
      setToast({ message: 'Erro ao cadastrar equipe: ' + e.message, type: 'error' });
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!window.confirm('Excluir esta equipe?')) return;
    try {
      await deleteDoc(doc(db, 'tournament_teams', teamId));
      setToast({ message: 'Equipe excluída!', type: 'success' });
    } catch (e: any) {
      setToast({ message: 'Erro: ' + e.message, type: 'error' });
    }
  };

  // Generate Group Round-Robin Matches automatically!
  const generateGroupMatches = async () => {
    if (!selectedTournament || !filterCategory) return;

    // Filter teams that belong to selected Category
    const categoryTeams = teams.filter(t => t.category === filterCategory);
    if (categoryTeams.length < 2) {
      setToast({ message: 'Cadastre pelo menos 2 equipes para gerar partidas nesta categoria!', type: 'error' });
      return;
    }

    // Check if games for this category already exist
    const categoryMatchesCount = matches.filter(m => m.category === filterCategory).length;
    if (categoryMatchesCount > 0) {
      if (!window.confirm('Já existem jogos gerados para esta categoria. Deseja apagá-los e gerar tudo do zero?')) {
        return;
      }
      // Delete old matching matches
      const matchesToDelete = matches.filter(m => m.category === filterCategory);
      for (const m of matchesToDelete) {
        await deleteDoc(doc(db, 'tournament_matches', m.id));
      }
    }

    setToast({ message: 'Processando chaves e gerando partidas...', type: 'info' });

    // Group teams by group_name
    const groupsMap: { [group: string]: TournamentTeam[] } = {};
    categoryTeams.forEach(t => {
      if (!groupsMap[t.group_name]) {
        groupsMap[t.group_name] = [];
      }
      groupsMap[t.group_name].push(t);
    });

    let gamesCreated = 0;
    
    // Allocate slots in order
    let slotDateIdx = 0;
    let slotTimeIdx = 0;
    let slotLocIdx = 0;

    const dates = selectedTournament.dates;
    const times = selectedTournament.times;
    const locations = selectedTournament.locations;

    for (const groupName of Object.keys(groupsMap)) {
      const groupTeams = groupsMap[groupName];
      if (groupTeams.length < 2) continue;

      // Generate round robin pairings: each team plays once
      for (let i = 0; i < groupTeams.length; i++) {
        for (let j = i + 1; j < groupTeams.length; j++) {
          const teamA = groupTeams[i];
          const teamB = groupTeams[j];

          // Pick sequential schedules
          const scheduledDate = dates[slotDateIdx % dates.length] || '';
          const scheduledTime = times[slotTimeIdx % times.length] || '';
          const scheduledLoc = locations[slotLocIdx % locations.length] || 'Quadra 1';

          // Update pointers sequentially to distribute games
          slotTimeIdx++;
          if (slotTimeIdx >= times.length) {
            slotTimeIdx = 0;
            slotLocIdx++;
            if (slotLocIdx >= locations.length) {
              slotLocIdx = 0;
              slotDateIdx++;
            }
          }

          // Create the match document
          await addDoc(collection(db, 'tournament_matches'), {
            teacher_id: user.uid,
            tournament_id: selectedTournament.id,
            category: filterCategory,
            stage: groupName,
            team1_id: teamA.id,
            team1_name: `${teamA.player1_name} / ${teamA.player2_name}`,
            team2_id: teamB.id,
            team2_name: `${teamB.player1_name} / ${teamB.player2_name}`,
            score1_sets: [0, 0, 0],
            score2_sets: [0, 0, 0],
            score1_text: '',
            score2_text: '',
            date: scheduledDate,
            time: scheduledTime,
            location: scheduledLoc,
            status: 'agendado',
            winner_id: ''
          });
          gamesCreated++;
        }
      }
    }

    setToast({ message: `Sucesso! Gerados ${gamesCreated} jogos da fase de grupos!`, type: 'success' });
  };

  // Add individual custom match (useful for Semifinals/Final playoff brackets)
  const [showManualMatchForm, setShowManualMatchForm] = useState(false);
  const [manualMatch, setManualMatch] = useState({
    stage: 'Semifinal',
    team1_name: '',
    team2_name: '',
    date: '',
    time: '',
    location: ''
  });

  const handleAddManualMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTournament || !filterCategory) return;
    if (!manualMatch.team1_name.trim() || !manualMatch.team2_name.trim()) {
      setToast({ message: 'Digite o nome dos adversários!', type: 'error' });
      return;
    }

    try {
      await addDoc(collection(db, 'tournament_matches'), {
        teacher_id: user.uid,
        tournament_id: selectedTournament.id,
        category: filterCategory,
        stage: manualMatch.stage,
        team1_id: '',
        team1_name: manualMatch.team1_name,
        team2_id: '',
        team2_name: manualMatch.team2_name,
        score1_sets: [0, 0, 0],
        score2_sets: [0, 0, 0],
        score1_text: '',
        score2_text: '',
        date: manualMatch.date || selectedTournament.dates[0] || '',
        time: manualMatch.time || selectedTournament.times[0] || '',
        location: manualMatch.location || selectedTournament.locations[0] || 'Quadra 1',
        status: 'agendado',
        winner_id: ''
      });

      setToast({ message: 'Partida adicionada!', type: 'success' });
      setShowManualMatchForm(false);
      setManualMatch({
        stage: 'Semifinal',
        team1_name: '',
        team2_name: '',
        date: '',
        time: '',
        location: ''
      });
    } catch (e: any) {
      setToast({ message: 'Erro: ' + e.message, type: 'error' });
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (!window.confirm('Tem certeza que deseja remover este jogo?')) return;
    try {
      await deleteDoc(doc(db, 'tournament_matches', matchId));
      setToast({ message: 'Jogo removido!', type: 'success' });
    } catch (e: any) {
      setToast({ message: 'Erro ao remover jogo: ' + e.message, type: 'error' });
    }
  };

  // Score record submission
  const openResultModal = (match: TournamentMatch) => {
    setEditingMatch(match);
    
    // Convert scores to text lists
    const s1 = (match.score1_sets || [0, 0, 0]).map(String);
    const s2 = (match.score2_sets || [0, 0, 0]).map(String);
    setScore1(s1);
    setScore2(s2);
    setMatchStatus(match.status);
    setMatchWinnerId(match.winner_id || '');
  };

  const handleSaveResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTournament || !editingMatch) return;

    try {
      const s1Nums = score1.map(Number);
      const s2Nums = score2.map(Number);

      // Build presentation text: e.g. "6/3 4/6 10-8"
      const scoreTexts: string[] = [];
      const scoreTextsTeam2: string[] = [];
      for (let i = 0; i < 3; i++) {
        const g1 = s1Nums[i];
        const g2 = s2Nums[i];
        if (g1 === 0 && g2 === 0) continue;
        scoreTexts.push(`${g1}/${g2}`);
        scoreTextsTeam2.push(`${g2}/${g1}`);
      }

      await updateDoc(doc(db, 'tournament_matches', editingMatch.id), {
        score1_sets: s1Nums,
        score2_sets: s2Nums,
        score1_text: scoreTexts.join(' '),
        score2_text: scoreTextsTeam2.join(' '),
        status: matchStatus,
        winner_id: matchWinnerId
      });

      setToast({ message: 'Resultado registrado com sucesso!', type: 'success' });
      setEditingMatch(null);
    } catch (e: any) {
      setToast({ message: 'Erro ao salvar resultado: ' + e.message, type: 'error' });
    }
  };

  // Dynamic Standings Calculations!
  const currentCategoryStandings = React.useMemo(() => {
    const activeTeams = teams.filter(t => t.category === filterCategory);
    const activeMatches = matches.filter(m => m.category === filterCategory);

    // Dynamic Standings Calculator
    const stand: { [teamId: string]: {
      id: string;
      player1_name: string;
      player2_name: string;
      group_name: string;
      played: number;
      won: number;
      lost: number;
      setsWon: number;
      setsLost: number;
      gamesWon: number;
      gamesLost: number;
      points: number;
    }} = {};

    activeTeams.forEach(t => {
      stand[t.id] = {
        id: t.id,
        player1_name: t.player1_name,
        player2_name: t.player2_name,
        group_name: t.group_name,
        played: 0,
        won: 0,
        lost: 0,
        setsWon: 0,
        setsLost: 0,
        gamesWon: 0,
        gamesLost: 0,
        points: 0
      };
    });

    activeMatches.forEach(m => {
      if (m.status !== 'encerrado') return;
      const t1Id = m.team1_id;
      const t2Id = m.team2_id;

      // Calculate stats if both teams are registered documents
      if (!t1Id || !t2Id || !stand[t1Id] || !stand[t2Id]) return;

      stand[t1Id].played += 1;
      stand[t2Id].played += 1;

      let setsWonT1 = 0;
      let setsWonT2 = 0;
      let gamesWonT1 = 0;
      let gamesWonT2 = 0;

      const s1 = m.score1_sets || [];
      const s2 = m.score2_sets || [];

      for (let i = 0; i < 3; i++) {
        const g1 = s1[i] || 0;
        const g2 = s2[i] || 0;
        if (g1 === 0 && g2 === 0) continue;
        
        gamesWonT1 += g1;
        gamesWonT2 += g2;
        
        if (g1 > g2) {
          setsWonT1++;
        } else if (g2 > g1) {
          setsWonT2++;
        }
      }

      stand[t1Id].setsWon += setsWonT1;
      stand[t1Id].setsLost += setsWonT2;
      stand[t2Id].setsWon += setsWonT2;
      stand[t2Id].setsLost += setsWonT1;

      stand[t1Id].gamesWon += gamesWonT1;
      stand[t1Id].gamesLost += gamesWonT2;
      stand[t2Id].gamesWon += gamesWonT2;
      stand[t2Id].gamesLost += gamesWonT1;

      if (m.winner_id === t1Id) {
        stand[t1Id].won += 1;
        stand[t1Id].points += 3; // 3 points for win
        stand[t2Id].lost += 1;
        stand[t2Id].points += 1; // 1 point for loss
      } else if (m.winner_id === t2Id) {
        stand[t2Id].won += 1;
        stand[t2Id].points += 3;
        stand[t1Id].lost += 1;
        stand[t1Id].points += 1;
      }
    });

    // Group standings by Chave / Grupo
    const groupedList: { [group: string]: typeof stand[string][] } = {};
    Object.values(stand).forEach(st => {
      if (!groupedList[st.group_name]) {
        groupedList[st.group_name] = [];
      }
      groupedList[st.group_name].push(st);
    });

    // Sort standings inside each group: Points desc, Wins desc, sets ratio, games ratio
    Object.keys(groupedList).forEach(gp => {
      groupedList[gp].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.won !== a.won) return b.won - a.won;
        
        const setBalA = a.setsWon - a.setsLost;
        const setBalB = b.setsWon - b.setsLost;
        if (setBalB !== setBalA) return setBalB - setBalA;

        const gameBalA = a.gamesWon - a.gamesLost;
        const gameBalB = b.gamesWon - b.gamesLost;
        return gameBalB - gameBalA;
      });
    });

    return groupedList;
  }, [teams, matches, filterCategory]);

  // Copy shareable player link
  const copyShareLink = () => {
    if (!selectedTournament) return;
    const shareUrl = `${window.location.origin}?t=${selectedTournament.id}`;
    navigator.clipboard.writeText(shareUrl);
    setToast({ message: 'Link de Resultados copiado! Envie aos jogadores.', type: 'success' });
  };

  const filteredMatchesToShow = React.useMemo(() => {
    let result = matches.filter(m => m.category === filterCategory);
    if (filterGroup !== 'all') {
      result = result.filter(m => m.stage === filterGroup);
    }
    // Sort matches: status first (running/scheduled then completed) and then by date/time
    return result.sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === 'em_andamento') return -1;
        if (b.status === 'em_andamento') return 1;
        if (a.status === 'agendado' && b.status === 'encerrado') return -1;
        if (a.status === 'encerrado' && b.status === 'agendado') return 1;
      }
      return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
    });
  }, [matches, filterCategory, filterGroup]);

  const uniqueGroupsOfCategory = React.useMemo(() => {
    const list = teams.filter(t => t.category === filterCategory).map(t => t.group_name);
    return Array.from(new Set(list)).sort();
  }, [teams, filterCategory]);

  return (
    <div className="space-y-6">
      
      {/* Torneio Selector Toolbar */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-black text-green-600 uppercase tracking-widest flex items-center gap-1">
            <Trophy size={12} /> TORNEIOS ACTIVOS
          </span>
          <div className="flex items-center gap-2 mt-1">
            {tournaments.length === 0 ? (
              <h3 className="font-bold text-gray-400">Nenhum torneio criado</h3>
            ) : (
              <select 
                className="bg-transparent font-black text-xl text-gray-900 border-none outline-none pr-8 cursor-pointer focus:ring-0"
                value={selectedTournament?.id || ''}
                onChange={(e) => {
                  const found = tournaments.find(t => t.id === e.target.value);
                  if (found) setSelectedTournament(found);
                }}
              >
                {tournaments.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.type === 'padel' ? 'Padel' : 'Beach Tennis'})</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {selectedTournament && (
            <button
              onClick={copyShareLink}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 text-gray-700 border border-gray-200 rounded-xl font-bold text-xs hover:bg-gray-100 transition-all shadow-sm"
              title="Copiar Link para Jogadores"
            >
              <Share2 size={14} />
              COPIAR LINK PÚBLICO
            </button>
          )}

          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl font-bold text-xs hover:bg-green-700 transition-all shadow-sm"
          >
            <Plus size={16} />
            NOVO TORNEIO
          </button>
        </div>
      </div>

      {/* Creation form */}
      {showCreateForm && (
        <form onSubmit={handleCreateTournament} className="bg-white p-6 rounded-3xl shadow-md border border-gray-100 space-y-6 animate-in fade-in duration-200">
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="text-md font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <Trophy className="text-green-600" size={18} /> Detalhes do Novo Torneio
            </h3>
            <button 
              type="button" 
              onClick={() => setShowCreateForm(false)}
              className="text-gray-400 hover:text-gray-600 text-xs font-bold"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left side */}
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Qual o nome do torneio?</label>
                <input
                  type="text"
                  placeholder="Ex: 1º Open de Padel Arena Bora Pro Jogo"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-medium outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  value={newTourney.name}
                  onChange={e => setNewTourney(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Modalidade esportiva</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewTourney(prev => ({ ...prev, type: 'padel' }))}
                    className={`py-3 rounded-xl border text-sm font-bold transition-all ${newTourney.type === 'padel' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'}`}
                  >
                    PADEL
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTourney(prev => ({ ...prev, type: 'beach' }))}
                    className={`py-3 rounded-xl border text-sm font-bold transition-all ${newTourney.type === 'beach' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'}`}
                  >
                    BEACH TENNIS
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Categorias do Torneio</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ex: Categoria D / Iniciante"
                    className="flex-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs"
                    value={catInput}
                    onChange={e => setCatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                  />
                  <button 
                    type="button" onClick={handleAddCategory}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-gray-800"
                  >
                    Adicionar
                  </button>
                </div>
                {newTourney.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1.5">
                    {newTourney.categories.map((cat, i) => (
                      <span key={i} className="px-2 py-1 bg-green-50 text-green-800 border border-green-100 text-[10px] rounded-md font-bold flex items-center gap-1 select-none">
                        {cat}
                        <Trash2 size={10} className="hover:text-red-500 cursor-pointer" onClick={() => handleRemoveCategory(i)} />
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Locais / Quadras Disponíveis</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ex: Quadra Central / Quadra 2"
                    className="flex-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs"
                    value={locInput}
                    onChange={e => setLocInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddLocation())}
                  />
                  <button 
                    type="button" onClick={handleAddLocation}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-gray-800"
                  >
                    Adicionar
                  </button>
                </div>
                {newTourney.locations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1.5">
                    {newTourney.locations.map((loc, i) => (
                      <span key={i} className="px-2 py-1 bg-purple-50 text-purple-800 border border-purple-100 text-[10px] rounded-md font-bold flex items-center gap-1">
                        {loc}
                        <Trash2 size={10} className="hover:text-red-500 cursor-pointer" onClick={() => handleRemoveLocation(i)} />
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right side */}
            <div className="space-y-4">
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Datas do Torneio</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    className="flex-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs"
                    value={dateInput}
                    onChange={e => setDateInput(e.target.value)}
                  />
                  <button 
                    type="button" onClick={handleAddDate}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-gray-800"
                  >
                    Adicionar
                  </button>
                </div>
                {newTourney.dates.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1.5">
                    {newTourney.dates.map((date, i) => (
                      <span key={i} className="px-2 py-1 bg-blue-50 text-blue-800 border border-blue-100 text-[10px] rounded-md font-bold flex items-center gap-1">
                        {date}
                        <Trash2 size={10} className="hover:text-red-500 cursor-pointer" onClick={() => handleRemoveDate(i)} />
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Horários das Rodadas</label>
                <div className="flex gap-2">
                  <input
                    type="time"
                    className="flex-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs"
                    value={timeInput}
                    onChange={e => setTimeInput(e.target.value)}
                  />
                  <button 
                    type="button" onClick={handleAddTime}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-gray-800"
                  >
                    Adicionar
                  </button>
                </div>
                {newTourney.times.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1.5">
                    {newTourney.times.map((t, i) => (
                      <span key={i} className="px-2 py-1 bg-orange-50 text-orange-800 border border-orange-100 text-[10px] rounded-md font-bold flex items-center gap-1">
                        {t}
                        <Trash2 size={10} className="hover:text-red-500 cursor-pointer" onClick={() => handleRemoveTime(i)} />
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Regulamento / Instruções</label>
                <textarea
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-green-500"
                  value={newTourney.rules}
                  onChange={e => setNewTourney(prev => ({ ...prev, rules: e.target.value }))}
                />
              </div>

            </div>

          </div>

          <div className="flex justify-end pt-4 border-t">
            <button
              type="submit"
              className="px-6 py-3 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition"
            >
              Criar Torneio
            </button>
          </div>
        </form>
      )}

      {/* Main panel displays */}
      {selectedTournament ? (
        <div className="space-y-6">
          
          {/* Section SubTabs Nav */}
          <div className="flex border-b border-gray-200 gap-4 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveSubTab('info')}
              className={`pb-3 font-bold text-sm border-b-2 transition-all whitespace-nowrap px-1 ${activeSubTab === 'info' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Informações e Regulamento
            </button>
            <button
              onClick={() => setActiveSubTab('teams')}
              className={`pb-3 font-bold text-sm border-b-2 transition-all whitespace-nowrap px-1 ${activeSubTab === 'teams' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Inscrição de Duplas ({teams.length})
            </button>
            <button
              onClick={() => setActiveSubTab('matches')}
              className={`pb-3 font-bold text-sm border-b-2 transition-all whitespace-nowrap px-1 ${activeSubTab === 'matches' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Tabela de Jogos / Cadastrar Resultados ({matches.length})
            </button>
            <button
              onClick={() => setActiveSubTab('standings')}
              className={`pb-3 font-bold text-sm border-b-2 transition-all whitespace-nowrap px-1 ${activeSubTab === 'standings' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Classificação em Tempo Real
            </button>
          </div>

          {/* SubTab Content Rendering */}
          <div className="animate-in fade-in duration-200">
            
            {/* SUB-TAB 1: INFO AND SETTINGS */}
            {activeSubTab === 'info' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                  <h4 className="font-bold text-gray-900 border-b pb-2 flex items-center gap-2 text-md">
                    <Info className="text-blue-500" size={18} /> Regulamento do Torneio
                  </h4>
                  <div className="prose max-w-none text-xs text-gray-600 space-y-3 whitespace-pre-wrap leading-relaxed font-mono bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    {selectedTournament.rules}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                  <h4 className="font-bold text-gray-900 border-b pb-2 flex items-center gap-2 text-md">
                    <Settings className="text-gray-500" size={18} /> Resumo Técnico
                  </h4>

                  <div className="space-y-4 divide-y divide-gray-50 text-xs">
                    <div className="pt-2 flex justify-between">
                      <span className="text-gray-400 font-bold uppercase">Esporte:</span>
                      <span className="font-black text-gray-800 uppercase">{selectedTournament.type === 'padel' ? 'Padel 🎾' : 'Beach Tennis 🏖️'}</span>
                    </div>
                    <div className="pt-3 flex flex-col gap-1.5">
                      <span className="text-gray-400 font-bold uppercase">Datas Disponíveis:</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedTournament.dates.map((d, i) => (
                          <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded">{d}</span>
                        ))}
                      </div>
                    </div>
                    <div className="pt-3 flex flex-col gap-1.5">
                      <span className="text-gray-400 font-bold uppercase">Categorias Cadastradas:</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedTournament.categories.map((c, i) => (
                          <span key={i} className="px-2 py-0.5 bg-green-50 text-green-700 font-bold rounded">{c}</span>
                        ))}
                      </div>
                    </div>
                    <div className="pt-3 flex flex-col gap-1.5">
                      <span className="text-gray-400 font-bold uppercase">Quadras / Espaços:</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedTournament.locations.map((l, i) => (
                          <span key={i} className="px-2 py-0.5 bg-purple-50 text-purple-700 font-bold rounded">{l}</span>
                        ))}
                      </div>
                    </div>
                    <div className="pt-3 flex flex-col gap-1.5">
                      <span className="text-gray-400 font-bold uppercase">Horários de Partidas:</span>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                        {selectedTournament.times.map((t, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-orange-50 text-orange-700 font-bold rounded text-[10px]">{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <button
                      onClick={() => handleDeleteTournament(selectedTournament.id)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition"
                    >
                      <Trash2 size={12} /> APAGAR ESTE TORNEIO
                    </button>
                  </div>

                </div>

              </div>
            )}

            {/* SUB-TAB 2: REGISTRATION OF TEAMS */}
            {activeSubTab === 'teams' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Team addition form */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                  <h4 className="font-bold text-gray-900 border-b pb-2 flex items-center gap-2 text-md">
                    <Plus className="text-green-600" size={18} /> Nova Dupla / Equipe
                  </h4>

                  <form onSubmit={handleAddTeam} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Escolha a Categoria</label>
                      <select
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs"
                        value={newTeam.category}
                        onChange={e => setNewTeam(prev => ({ ...prev, category: e.target.value }))}
                      >
                        <option value="">Selecione...</option>
                        {selectedTournament.categories.map((c, i) => (
                          <option key={i} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Chave / Grupo de Pontuação</label>
                      <select
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs"
                        value={newTeam.group_name}
                        onChange={e => setNewTeam(prev => ({ ...prev, group_name: e.target.value }))}
                      >
                        <option value="Chave A">Chave A</option>
                        <option value="Chave B">Chave B</option>
                        <option value="Chave C">Chave C</option>
                        <option value="Chave D">Chave D</option>
                      </select>
                    </div>

                    <div className="space-y-3 pt-2 border-t text-xs">
                      <font className="font-bold text-[10px] text-gray-400 uppercase">Jogador 1</font>
                      <input
                        type="text"
                        placeholder="Nome do Jogador 1"
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs"
                        value={newTeam.player1_name}
                        onChange={e => setNewTeam(prev => ({ ...prev, player1_name: e.target.value }))}
                        required
                      />
                      <input
                        type="text"
                        placeholder="WhatsApp (Opcional)"
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs"
                        value={newTeam.player1_phone}
                        onChange={e => setNewTeam(prev => ({ ...prev, player1_phone: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-3 pt-2 border-t text-xs">
                      <font className="font-bold text-[10px] text-gray-400 uppercase">Jogador 2</font>
                      <input
                        type="text"
                        placeholder="Nome do Jogador 2"
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs"
                        value={newTeam.player2_name}
                        onChange={e => setNewTeam(prev => ({ ...prev, player2_name: e.target.value }))}
                        required
                      />
                      <input
                        type="text"
                        placeholder="WhatsApp (Opcional)"
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs"
                        value={newTeam.player2_phone}
                        onChange={e => setNewTeam(prev => ({ ...prev, player2_phone: e.target.value }))}
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition"
                    >
                      INSCREVER DUPLA
                    </button>
                  </form>
                </div>

                {/* Registered List */}
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 gap-2">
                    <h4 className="font-bold text-gray-900 flex items-center gap-2 text-md">
                      <Users className="text-gray-500" size={18} /> Duplas Inscritas ({teams.length})
                    </h4>
                    
                    <div className="flex gap-2">
                      <select
                        className="bg-gray-50 border border-gray-150 px-3 py-1.5 rounded-lg text-xs font-bold outline-none cursor-pointer"
                        value={filterCategory}
                        onChange={e => setFilterCategory(e.target.value)}
                      >
                        {selectedTournament.categories.map((c, idx) => (
                          <option key={idx} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {teams.filter(t => t.category === filterCategory).length === 0 ? (
                    <div className="py-12 text-center">
                      <Users className="mx-auto text-gray-300 mb-2" size={40} />
                      <p className="text-xs text-gray-400 font-bold">Nenhuma dupla inscrita na categoria {filterCategory} ainda.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {teams.filter(t => t.category === filterCategory).map(t => (
                        <div key={t.id} className="p-4 bg-gray-50 border border-gray-100 rounded-2xl flex justify-between items-start gap-4">
                          <div className="space-y-1.5 flex-1">
                            <span className="px-2 py-0.5 bg-gray-900 text-white text-[9px] font-black tracking-widest rounded-md uppercase">
                              {t.group_name}
                            </span>
                            <div className="font-black text-xs text-gray-800 leading-tight">
                              <div>👤 {t.player1_name} {t.player1_phone && <span className="text-[10px] text-gray-400 font-normal">({t.player1_phone})</span>}</div>
                              <div className="mt-1">👤 {t.player2_name} {t.player2_phone && <span className="text-[10px] text-gray-400 font-normal">({t.player2_phone})</span>}</div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteTeam(t.id)}
                            className="p-1 px-2 text-red-500 hover:bg-red-50 rounded"
                            title="Remover dupla"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                </div>

              </div>
            )}

            {/* SUB-TAB 3: MATCHES AND RESULTS */}
            {activeSubTab === 'matches' && (
              <div className="space-y-6">
                
                {/* Generation tools bar */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <h4 className="font-black text-xs text-gray-800 uppercase tracking-wider">Mecanismo de Geração de Jogos</h4>
                    <p className="text-[11px] text-gray-400">Gere todas as rodadas com o algoritmo round-robin de maneira integrada.</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <select
                      className="bg-gray-50 border border-gray-150 px-3 py-2 rounded-xl text-xs font-bold outline-none cursor-pointer"
                      value={filterCategory}
                      onChange={e => setFilterCategory(e.target.value)}
                    >
                      {selectedTournament.categories.map((c, idx) => (
                        <option key={idx} value={c}>{c}</option>
                      ))}
                    </select>

                    <button
                      onClick={generateGroupMatches}
                      className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs rounded-xl transition flex items-center gap-2"
                    >
                      <Trophy size={14} /> GENERATE ALL GROUP MATCHES
                    </button>

                    <button
                      onClick={() => setShowManualMatchForm(!showManualMatchForm)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-205 text-gray-700 border border-gray-200 font-bold text-xs rounded-xl transition flex items-center gap-2"
                    >
                      <Plus size={14} /> MANUALLY CREATE PLAYOFF
                    </button>
                  </div>
                </div>

                {/* Manual match creator */}
                {showManualMatchForm && (
                  <form onSubmit={handleAddManualMatch} className="bg-gray-50 p-6 rounded-3xl shadow-inner border border-gray-100 space-y-4">
                    <h5 className="font-black text-xs text-gray-900 uppercase tracking-widest">Criar Partida Eliminatória (Playoff / Mata-Mata)</h5>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400">Fase da Partida</label>
                        <select
                          className="w-full px-3 py-2 bg-white border rounded-lg text-xs"
                          value={manualMatch.stage}
                          onChange={e => setManualMatch(prev => ({ ...prev, stage: e.target.value }))}
                        >
                          <option value="Quartas de Final">Quartas de Final</option>
                          <option value="Semifinal">Semifinal</option>
                          <option value="Final">Final</option>
                          <option value="Disputa 3º Lugar">Disputa 3º Lugar</option>
                          <option value="Chave A">Chave A</option>
                          <option value="Chave B">Chave B</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400">Dupla Dupla 1</label>
                        <input
                          type="text"
                          placeholder="Ex: João / Maria"
                          className="w-full px-3 py-2 bg-white border rounded-lg text-xs font-bold"
                          value={manualMatch.team1_name}
                          onChange={e => setManualMatch(prev => ({ ...prev, team1_name: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400">Dupla Dupla 2</label>
                        <input
                          type="text"
                          placeholder="Ex: Pedro / Marcos"
                          className="w-full px-3 py-2 bg-white border rounded-lg text-xs font-bold"
                          value={manualMatch.team2_name}
                          onChange={e => setManualMatch(prev => ({ ...prev, team2_name: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400">Data do Jogo</label>
                        <select
                          className="w-full px-3 py-2 bg-white border rounded-lg text-xs"
                          value={manualMatch.date}
                          onChange={e => setManualMatch(prev => ({ ...prev, date: e.target.value }))}
                        >
                          <option value="">Selecione...</option>
                          {selectedTournament.dates.map((d, i) => (
                            <option key={i} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400">Horário</label>
                        <select
                          className="w-full px-3 py-2 bg-white border rounded-lg text-xs"
                          value={manualMatch.time}
                          onChange={e => setManualMatch(prev => ({ ...prev, time: e.target.value }))}
                        >
                          <option value="">Selecione...</option>
                          {selectedTournament.times.map((t, i) => (
                            <option key={i} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400">Quadra</label>
                        <select
                          className="w-full px-3 py-2 bg-white border rounded-lg text-xs"
                          value={manualMatch.location}
                          onChange={e => setManualMatch(prev => ({ ...prev, location: e.target.value }))}
                        >
                          <option value="">Selecione...</option>
                          {selectedTournament.locations.map((l, i) => (
                            <option key={i} value={l}>{l}</option>
                          ))}
                        </select>
                      </div>

                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button 
                        type="button" onClick={() => setShowManualMatchForm(false)}
                        className="px-3 py-2 bg-transparent text-gray-500 text-xs font-bold"
                      >
                        Cancelar
                      </button>
                      <button 
                        type="submit"
                        className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800"
                      >
                        Salvar Jogo
                      </button>
                    </div>
                  </form>
                )}

                {/* Matches layout filters */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 gap-2">
                    <h4 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
                      <Calendar className="text-gray-500" size={16} /> Jogos Agendados da Categoria ({filterCategory})
                    </h4>

                    <div className="flex gap-2">
                      <select
                        className="bg-gray-50 border px-3 py-1.5 rounded-lg text-xs font-bold outline-none"
                        value={filterGroup}
                        onChange={e => setFilterGroup(e.target.value)}
                      >
                        <option value="all">Todas as Chaves / Fases</option>
                        {uniqueGroupsOfCategory.map((g, idx) => (
                          <option key={idx} value={g}>{g}</option>
                        ))}
                        <option value="Quartas de Final">Quartas de Final</option>
                        <option value="Semifinal">Semifinal</option>
                        <option value="Final">Final</option>
                      </select>
                    </div>
                  </div>

                  {filteredMatchesToShow.length === 0 ? (
                    <div className="py-12 text-center text-gray-400">
                      <Calendar className="mx-auto mb-2 text-gray-300" size={36} />
                      <p className="text-xs font-bold text-gray-400">Nenhuma partida registrada com esta filtragem.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {filteredMatchesToShow.map(m => {
                        const isFinished = m.status === 'encerrado';
                        const isLive = m.status === 'em_andamento';
                        
                        return (
                          <div key={m.id} className="py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition hover:bg-gray-50 px-2 rounded-xl">
                            
                            {/* Match info */}
                            <div className="space-y-1.5 flex-1 w-full md:w-auto">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[9px] font-black rounded uppercase">
                                  {m.stage}
                                </span>
                                <span className={`px-2 py-0.5 text-[9px] font-black rounded uppercase ${
                                  isLive ? 'bg-red-600 text-white animate-pulse' :
                                  isFinished ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {isLive ? 'EM ANDAMENTO' : isFinished ? 'ENCERRADO' : 'AGENDADO'}
                                </span>
                                
                                <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                                  <Calendar size={10} /> {m.date}
                                </span>
                                <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                                  <Clock size={10} /> {m.time}
                                </span>
                                <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                                  <MapPin size={10} /> {m.location}
                                </span>
                              </div>

                              {/* Duel visualizer */}
                              <div className="grid grid-cols-1 sm:grid-cols-5 items-center gap-2 pt-1">
                                <div className={`sm:col-span-2 text-xs font-black p-2.5 rounded-xl border ${m.winner_id === m.team1_id && m.winner_id ? 'bg-green-50 border-green-200 text-green-900' : 'bg-white border-gray-100 text-gray-700'}`}>
                                  {m.team1_name}
                                </div>
                                <div className="text-[10px] font-black text-gray-400 text-center uppercase tracking-widest sm:col-span-1 select-none">
                                  VS
                                </div>
                                <div className={`sm:col-span-2 text-xs font-black p-2.5 rounded-xl border ${m.winner_id === m.team2_id && m.winner_id ? 'bg-green-50 border-green-200 text-green-900' : 'bg-white border-gray-100 text-gray-700'}`}>
                                  {m.team2_name}
                                </div>
                              </div>

                              {/* Score displays */}
                              {isFinished && (
                                <div className="text-xs font-black text-green-700 bg-green-50/50 p-2 rounded-xl flex items-center gap-2 border border-green-50">
                                  <Award size={14} /> Resultado: {m.score1_text}
                                </div>
                              )}
                            </div>

                            {/* Options action buttons */}
                            <div className="flex gap-2 self-end md:self-center">
                              <button
                                onClick={() => openResultModal(m)}
                                className="px-3.5 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition shadow-sm active:scale-95"
                              >
                                REGISTRAR RESULTADO
                              </button>
                              <button
                                onClick={() => handleDeleteMatch(m.id)}
                                className="px-3.5 py-2 text-red-500 hover:bg-red-50 rounded-xl transition"
                                title="Apagar Partida"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>

              </div>
            )}

            {/* SUB-TAB 4: CLASSFICATION STANDINGS */}
            {activeSubTab === 'standings' && (
              <div className="space-y-6">
                
                {/* Selector */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-black text-xs text-gray-900 uppercase tracking-wider">Selecione a Categoria de Standings</h4>
                    <span className="text-[11px] text-gray-400">Classificação atualizada instantaneamente a cada resultado encerrado.</span>
                  </div>

                  <select
                    className="bg-gray-50 border border-gray-150 px-4 py-2 rounded-xl text-xs font-bold outline-none cursor-pointer"
                    value={filterCategory}
                    onChange={e => setFilterCategory(e.target.value)}
                  >
                    {selectedTournament.categories.map((c, idx) => (
                      <option key={idx} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Table loops grouped by group_name */}
                {Object.keys(currentCategoryStandings).length === 0 ? (
                  <div className="bg-white py-12 rounded-3xl shadow-sm border text-center text-gray-400">
                    <Trophy className="mx-auto text-gray-300 mb-2" size={40} />
                    <p className="text-xs font-bold text-gray-400">Nenhum resultado ou equipe cadastrada para gerar a classificação.</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {Object.keys(currentCategoryStandings).map((group, gIdx) => {
                      const list = currentCategoryStandings[group];
                      return (
                        <div key={gIdx} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                          <h4 className="font-black text-md text-gray-900 uppercase border-b pb-2 flex items-center gap-2">
                            <Award className="text-yellow-500" size={18} /> {group}
                          </h4>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="border-b text-gray-400 uppercase text-[9px] font-black">
                                  <th className="py-2.5 pl-2">Posição</th>
                                  <th className="py-2.5">Equipe / Dupla</th>
                                  <th className="py-2.5 text-center px-2">PTS</th>
                                  <th className="py-2.5 text-center px-1">J</th>
                                  <th className="py-2.5 text-center px-1">V</th>
                                  <th className="py-2.5 text-center px-1">D</th>
                                  <th className="py-2.5 text-center px-1">Sets Pró</th>
                                  <th className="py-2.5 text-center px-1">Sets Contra</th>
                                  <th className="py-2.5 text-center px-1">Games Pró</th>
                                  <th className="py-2.5 text-center px-1 border-r border-gray-100">Games Contra</th>
                                </tr>
                              </thead>
                              <tbody>
                                {list.map((item, idx) => {
                                  const isTopQualified = idx < 2; // Typically top 2 qualify to playoffs
                                  return (
                                    <tr key={idx} className={`border-b border-gray-50 last:border-0 hover:bg-gray-50 ${isTopQualified ? 'font-semibold' : ''}`}>
                                      <td className="py-3 pl-4 flex items-center gap-2">
                                        <span className={`h-5 w-5 rounded-full flex items-center justify-center font-black text-[10px] ${
                                          idx === 0 ? 'bg-yellow-150 text-yellow-800' :
                                          idx === 1 ? 'bg-gray-150 text-gray-800' : 'bg-gray-50 text-gray-500'
                                        }`}>
                                          {idx + 1}
                                        </span>
                                      </td>
                                      <td className="py-3">
                                        <div className="text-gray-900">{item.player1_name} / {item.player2_name}</div>
                                      </td>
                                      <td className="py-3 text-center px-2 font-black text-green-700 bg-green-50/20">{item.points}</td>
                                      <td className="py-3 text-center px-1 text-gray-500">{item.played}</td>
                                      <td className="py-3 text-center px-1 text-green-600 font-bold">{item.won}</td>
                                      <td className="py-3 text-center px-1 text-red-500">{item.lost}</td>
                                      <td className="py-3 text-center px-1 text-gray-600">{item.setsWon}</td>
                                      <td className="py-3 text-center px-1 text-gray-600">{item.setsLost}</td>
                                      <td className="py-3 text-center px-1 text-gray-600">{item.gamesWon}</td>
                                      <td className="py-3 text-center px-1 text-gray-600 border-r border-gray-100">{item.gamesLost}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            )}

          </div>

        </div>
      ) : (
        <div className="bg-white p-12 rounded-3xl shadow-sm border text-center text-gray-400">
          <Trophy className="mx-auto text-gray-300 mb-2" size={48} />
          <h3 className="font-black text-gray-600 text-lg">Crie seu primeiro Torneio</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">Inscreva duplas em suas respectivas categorias esportivas e deixe nosso algoritmo calcular o emparelhamento de partidas e classificação.</p>
        </div>
      )}

      {/* Result Entry Modal Dialog */}
      {editingMatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[150] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 space-y-6">
            <div className="flex justify-between items-center border-b pb-3">
              <h4 className="font-black text-gray-900 border-none outline-none text-md">
                REGISTRAR PLACAR DA PARTIDA
              </h4>
              <button 
                onClick={() => setEditingMatch(null)}
                className="text-gray-400 hover:text-gray-600 text-xs font-bold"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSaveResult} className="space-y-4">
              
              <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Formato de Sets</div>
                
                <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold text-gray-500">
                  <div>Adversário</div>
                  <div>1º Set</div>
                  <div>2º Set</div>
                  <div>3º Set (Super TB)</div>
                </div>

                {/* Team 1 scores */}
                <div className="grid grid-cols-4 gap-2 items-center">
                  <div className="text-[11px] font-black leading-tight text-gray-800 break-words">{editingMatch.team1_name}</div>
                  <input
                    type="number" min="0" max="30"
                    className="w-full text-center p-2 border rounded-lg font-bold"
                    value={score1[0]}
                    onChange={e => setScore1(prev => [e.target.value, prev[1], prev[2]])}
                  />
                  <input
                    type="number" min="0" max="30"
                    className="w-full text-center p-2 border rounded-lg font-bold"
                    value={score1[1]}
                    onChange={e => setScore1(prev => [prev[0], e.target.value, prev[2]])}
                  />
                  <input
                    type="number" min="0" max="30"
                    className="w-full text-center p-2 border rounded-lg font-bold"
                    value={score1[2]}
                    onChange={e => setScore1(prev => [prev[0], prev[1], e.target.value])}
                  />
                </div>

                {/* Team 2 scores */}
                <div className="grid grid-cols-4 gap-2 items-center">
                  <div className="text-[11px] font-black leading-tight text-gray-800 break-words">{editingMatch.team2_name}</div>
                  <input
                    type="number" min="0" max="30"
                    className="w-full text-center p-2 border rounded-lg font-bold"
                    value={score2[0]}
                    onChange={e => setScore2(prev => [e.target.value, prev[1], prev[2]])}
                  />
                  <input
                    type="number" min="0" max="30"
                    className="w-full text-center p-2 border rounded-lg font-bold"
                    value={score2[1]}
                    onChange={e => setScore2(prev => [prev[0], e.target.value, prev[2]])}
                  />
                  <input
                    type="number" min="0" max="30"
                    className="w-full text-center p-2 border rounded-lg font-bold"
                    value={score2[2]}
                    onChange={e => setScore2(prev => [prev[0], prev[1], e.target.value])}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Qual o Status da Partida?</label>
                <select
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs"
                  value={matchStatus}
                  onChange={e => setMatchStatus(e.target.value as any)}
                >
                  <option value="agendado">Agendado</option>
                  <option value="em_andamento">Em Andamento (Live)</option>
                  <option value="encerrado">Encerrado (Finalizado)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Quem saiu vencedor da partida?</label>
                <select
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold"
                  value={matchWinnerId}
                  onChange={e => setMatchWinnerId(e.target.value)}
                  required={matchStatus === 'encerrado'}
                >
                  <option value="">Selecione quem venceu...</option>
                  <option value={editingMatch.team1_id || "team1"}>{editingMatch.team1_name}</option>
                  <option value={editingMatch.team2_id || "team2"}>{editingMatch.team2_name}</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button" onClick={() => setEditingMatch(null)}
                  className="px-4 py-2 bg-gray-100 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 shadow-sm"
                >
                  Salvar Resultado
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
