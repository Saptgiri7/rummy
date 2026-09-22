import React, { useState, useEffect, useCallback } from 'react';
import { CardDto, ServerMessage, RoomPlayerSummary } from '@rummy/shared';
import { useAuth, AuthProvider } from './context/AuthContext.js';
import { useWebSocket } from './hooks/useWebSocket.js';
import { GameTable, OpponentData } from './components/Table/GameTable.js';
import { RoomCreationModal } from './components/Lobby/RoomCreationModal.js';
import { RoomJoinModal } from './components/Lobby/RoomJoinModal.js';
import { WaitingLobby } from './components/Lobby/WaitingLobby.js';
import { GuestNameModal } from './components/Lobby/GuestNameModal.js';
import { RulesModal } from './components/Lobby/RulesModal.js';
import { Edit3, PlusCircle, KeyRound, ChevronRight, BookOpen } from 'lucide-react';
import { RoundResultsModal, ScoreItem } from './components/Results/RoundResultsModal.js';
import { AuthModal } from './components/Auth/AuthModal.js';
import { AdminDashboard } from './components/Admin/AdminDashboard.js';

const RANK_ORDER: Record<string, number> = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
  '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'JOKER': 99
};

const SUIT_ORDER: Record<string, number> = {
  'CLUBS': 1, 'DIAMONDS': 2, 'HEARTS': 3, 'SPADES': 4, 'NONE': 5
};

export const MainApp: React.FC = () => {
  const { user, token, loginAsGuest, updateDisplayName, logout } = useAuth();

  // Navigation / Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isGuestNameModalOpen, setIsGuestNameModalOpen] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [currentView, setCurrentView] = useState<'LOBBY' | 'ADMIN'>('LOBBY');
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  // Active Lobby State
  const [activeLobby, setActiveLobby] = useState<{
    roomId: string;
    roomCode: string;
    maxPlayers: number;
    players: RoomPlayerSummary[];
    isHost: boolean;
    canStart: boolean;
  } | null>(null);

  // Active Game State
  const [gameActive, setGameActive] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activePlayerId, setActivePlayerId] = useState<string>('');
  const [wildJoker, setWildJoker] = useState<CardDto | null>(null);
  const [openPileTop, setOpenPileTop] = useState<CardDto | null>(null);
  const [handGroups, setHandGroups] = useState<CardDto[][]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [selectedFinishCard, setSelectedFinishCard] = useState<CardDto | null>(null);
  const [turnPhase, setTurnPhase] = useState<'WAITING_DRAW' | 'WAITING_DISCARD' | 'ROUND_ENDED'>('WAITING_DRAW');
  const [remainingTurnTimeMs, setRemainingTurnTimeMs] = useState<number>(30000);
  const [opponents, setOpponents] = useState<OpponentData[]>([]);

  // Round Results State
  const [roundWinnerId, setRoundWinnerId] = useState<string>('');
  const [roundScores, setRoundScores] = useState<ScoreItem[]>([]);

  // Handle incoming ServerMessages
  const handleServerMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'ROOM_CREATED': {
        setActiveLobby({
          roomId: msg.payload.roomId,
          roomCode: msg.payload.roomCode,
          maxPlayers: msg.payload.maxPlayers,
          players: msg.payload.players,
          isHost: true,
          canStart: false
        });
        setIsCreateModalOpen(false);
        break;
      }

      case 'ROOM_LOBBY_UPDATE': {
        setActiveLobby((prev) => ({
          roomId: msg.payload.roomId,
          roomCode: msg.payload.roomCode,
          maxPlayers: msg.payload.maxPlayers,
          players: msg.payload.players,
          isHost: prev?.isHost ?? false,
          canStart: msg.payload.canStart
        }));
        setIsJoinModalOpen(false);
        break;
      }

      case 'GAME_STARTED': {
        setIsCreateModalOpen(false);
        setIsJoinModalOpen(false);
        setIsResultsModalOpen(false);
        setActiveLobby(null);
        setGameActive(true);
        setActiveRoomId(msg.payload.roomId);
        setActivePlayerId(msg.payload.activePlayerId);
        setWildJoker(msg.payload.wildJoker);
        setOpenPileTop(msg.payload.openCard);
        setTurnPhase('WAITING_DRAW');
        setRemainingTurnTimeMs(msg.payload.turnTimeoutMs);

        // Auto-group initial hand by suit
        const initialHand = msg.payload.initialHand;
        const sorted = [...initialHand].sort((a, b) => {
          if (a.suit !== b.suit) return (SUIT_ORDER[a.suit] ?? 0) - (SUIT_ORDER[b.suit] ?? 0);
          return (RANK_ORDER[a.rank] ?? 0) - (RANK_ORDER[b.rank] ?? 0);
        });

        // Group into suits
        const groupedMap = new Map<string, CardDto[]>();
        for (const card of sorted) {
          const key = card.suit;
          const list = groupedMap.get(key) || [];
          list.push(card);
          groupedMap.set(key, list);
        }
        setHandGroups(Array.from(groupedMap.values()));

        // Setup opponents
        const opps: OpponentData[] = msg.payload.players
          .filter((pid) => pid !== user?.id)
          .map((pid) => ({
            id: pid,
            username: `Player ${pid.slice(0, 6)}`,
            cardCount: 13,
            isActiveTurn: pid === msg.payload.activePlayerId,
            isDisconnected: false
          }));
        setOpponents(opps);
        break;
      }

      case 'CARD_DRAWN_PRIVATE': {
        const drawn = msg.payload.drawnCard;
        setHandGroups((prev) => {
          if (prev.length === 0) return [[drawn]];
          const next = [...prev];
          next[next.length - 1] = [...(next[next.length - 1] ?? []), drawn];
          return next;
        });
        setTurnPhase('WAITING_DISCARD');
        break;
      }

      case 'CARD_DRAWN_PUBLIC': {
        setOpponents((prev) =>
          prev.map((opp) =>
            opp.id === msg.payload.playerId
              ? { ...opp, cardCount: msg.payload.cardCount }
              : opp
          )
        );
        break;
      }

      case 'CARD_DISCARDED': {
        setOpenPileTop(msg.payload.discardedCard);
        setActivePlayerId(msg.payload.nextActivePlayerId);
        setTurnPhase('WAITING_DRAW');
        setRemainingTurnTimeMs(msg.payload.turnTimeoutMs);
        setSelectedCardIds([]);
        setSelectedFinishCard(null);

        // If I discarded, remove card from my hand
        if (msg.payload.playerId === user?.id) {
          const discardedId = msg.payload.discardedCard.id;
          setHandGroups((prev) =>
            prev
              .map((group) => group.filter((c) => c.id !== discardedId))
              .filter((group) => group.length > 0)
          );
        } else {
          // If opponent discarded, reduce their card count
          setOpponents((prev) =>
            prev.map((opp) =>
              opp.id === msg.payload.playerId
                ? { ...opp, cardCount: Math.max(13, opp.cardCount - 1), isActiveTurn: false }
                : opp.id === msg.payload.nextActivePlayerId
                ? { ...opp, isActiveTurn: true }
                : opp
            )
          );
        }
        break;
      }

      case 'ROUND_COMPLETED': {
        setRoundWinnerId(msg.payload.winnerId);
        setRoundScores(msg.payload.scores);
        setIsResultsModalOpen(true);
        setTurnPhase('ROUND_ENDED');
        break;
      }

      case 'GAME_RECONNECTED': {
        setGameActive(true);
        setActiveRoomId(msg.payload.roomId);
        setActivePlayerId(msg.payload.activePlayerId);
        setWildJoker(msg.payload.wildJoker);
        setOpenPileTop(msg.payload.openPileTop);
        setRemainingTurnTimeMs(msg.payload.remainingTurnTimeMs);

        // Organize hand
        const hand = msg.payload.hand;
        setHandGroups([hand]);
        break;
      }

      case 'ERROR': {
        alert(`${msg.payload.code}: ${msg.payload.message}`);
        break;
      }

      default:
        break;
    }
  }, [user]);

  const { isConnected, sendMessage } = useWebSocket({
    token,
    onMessage: handleServerMessage
  });

  // Card click: toggle selection
  const handleCardClick = (card: CardDto) => {
    setSelectedCardIds((prev) =>
      prev.includes(card.id) ? prev.filter((id) => id !== card.id) : [...prev, card.id]
    );
  };

  // Group selected cards into a new meld group
  const handleGroupSelected = () => {
    if (selectedCardIds.length < 2) return;

    const selectedCards: CardDto[] = [];
    const newGroups: CardDto[][] = [];

    for (const group of handGroups) {
      const remainingInGroup: CardDto[] = [];
      for (const card of group) {
        if (selectedCardIds.includes(card.id)) {
          selectedCards.push(card);
        } else {
          remainingInGroup.push(card);
        }
      }
      if (remainingInGroup.length > 0) {
        newGroups.push(remainingInGroup);
      }
    }

    newGroups.push(selectedCards);
    setHandGroups(newGroups);
    setSelectedCardIds([]);
  };

  // Auto-sort hand by suits and ascending rank
  const handleAutoSort = () => {
    const allCards = handGroups.flat();
    const sorted = [...allCards].sort((a, b) => {
      if (a.suit !== b.suit) return (SUIT_ORDER[a.suit] ?? 0) - (SUIT_ORDER[b.suit] ?? 0);
      return (RANK_ORDER[a.rank] ?? 0) - (RANK_ORDER[b.rank] ?? 0);
    });

    const suitGroupsMap = new Map<string, CardDto[]>();
    for (const card of sorted) {
      const list = suitGroupsMap.get(card.suit) || [];
      list.push(card);
      suitGroupsMap.set(card.suit, list);
    }
    setHandGroups(Array.from(suitGroupsMap.values()));
    setSelectedCardIds([]);
  };

  // Draw Card from Closed Pile
  const handleDrawClosed = () => {
    console.log('[CLIENT] handleDrawClosed called! activeRoomId:', activeRoomId);
    if (!activeRoomId) return;
    const sent = sendMessage({
      type: 'DRAW_CARD',
      payload: { roomId: activeRoomId, source: 'CLOSED' }
    });
    console.log('[CLIENT] DRAW_CARD message sent:', sent);
  };

  // Draw Card from Open Discard Pile
  const handleDrawOpen = () => {
    console.log('[CLIENT] handleDrawOpen called! activeRoomId:', activeRoomId);
    if (!activeRoomId) return;
    sendMessage({
      type: 'DRAW_CARD',
      payload: { roomId: activeRoomId, source: 'OPEN' }
    });
  };

  // Discard Selected Card
  const handleDiscard = () => {
    console.log('[CLIENT] handleDiscard called! activeRoomId:', activeRoomId, 'selectedCardIds:', selectedCardIds);
    if (!activeRoomId || selectedCardIds.length !== 1) return;
    sendMessage({
      type: 'DISCARD_CARD',
      payload: { roomId: activeRoomId, cardId: selectedCardIds[0]! }
    });
  };

  // Pick Finish Card for Declaration
  const handleFinishSlotClick = () => {
    if (selectedCardIds.length === 1) {
      const finishCard = handGroups.flat().find((c) => c.id === selectedCardIds[0]);
      if (finishCard) {
        setSelectedFinishCard(finishCard);
      }
    }
  };

  // Declare Hand Show
  const handleDeclare = () => {
    if (!activeRoomId) return;
    const finishCard = selectedFinishCard || (selectedCardIds.length === 1 ? handGroups.flat().find((c) => c.id === selectedCardIds[0]) : null);
    if (!finishCard) {
      alert('Please select 1 card to discard to the Finish Slot before declaring.');
      return;
    }

    // Melds must contain remaining 13 cards without finish card
    const melds = handGroups
      .map((group) => group.filter((c) => c.id !== finishCard.id))
      .filter((group) => group.length > 0);

    sendMessage({
      type: 'DECLARE_SHOW',
      payload: {
        roomId: activeRoomId,
        finishCardId: finishCard.id,
        melds
      }
    });
  };

  // Drop Hand
  const handleDrop = () => {
    if (!activeRoomId) return;
    if (confirm('Are you sure you want to drop this hand?')) {
      sendMessage({
        type: 'DROP_HAND',
        payload: { roomId: activeRoomId }
      });
    }
  };

  // Room Creation Handler
  const handleCreateRoom = async (maxPlayers: 2 | 6, chosenName?: string) => {
    setIsCreateModalOpen(false);
    if (chosenName && chosenName !== user?.username) {
      await updateDisplayName(chosenName);
    }
    sendMessage({
      type: 'CREATE_ROOM',
      payload: { maxPlayers }
    });
  };

  // Room Join Handler
  const handleJoinRoom = async (roomCode: string, chosenName?: string) => {
    setIsJoinModalOpen(false);
    if (chosenName && chosenName !== user?.username) {
      await updateDisplayName(chosenName);
    }
    sendMessage({
      type: 'JOIN_ROOM',
      payload: { roomId: roomCode }
    });
  };

  // Quick Matchmaking
  const handleQuickMatch = (maxPlayers: 2 | 6 = 2) => {
    sendMessage({
      type: 'JOIN_MATCHMAKING',
      payload: { maxPlayers, gameVariant: 'POINTS_13' }
    });
  };

  // Host Start Game
  const handleHostStartGame = () => {
    if (!activeLobby) return;
    sendMessage({
      type: 'START_ROOM_GAME',
      payload: { roomId: activeLobby.roomId }
    });
  };

  // Leave Room
  const handleLeaveRoom = () => {
    if (activeLobby) {
      sendMessage({
        type: 'LEAVE_ROOM',
        payload: { roomId: activeLobby.roomId }
      });
      setActiveLobby(null);
    }
  };

  return (
    <div className="app-container">
      {/* Navigation Header */}
      <header className="app-header">
        <div className="brand-logo">
          <span>🂡</span>
          <span>RUMMY MASTER</span>
        </div>

        <div className="header-user-info">
          {user?.role === 'ADMIN' && (
            <button
              type="button"
              id="btn-admin-portal"
              className={`header-admin-btn ${currentView === 'ADMIN' ? 'active' : ''}`}
              onClick={() => setCurrentView((prev) => (prev === 'ADMIN' ? 'LOBBY' : 'ADMIN'))}
            >
              <span>👑</span>
              <span>{currentView === 'ADMIN' ? 'Lobby' : 'Admin Portal'}</span>
            </button>
          )}

          <div
            className="user-badge"
            style={{ cursor: !user?.isVerified ? 'pointer' : 'default' }}
            onClick={() => {
              if (!user?.isVerified) {
                setIsGuestNameModalOpen(true);
              }
            }}
            title={!user?.isVerified ? 'Click to change display name' : undefined}
          >
            <span className={`status-dot ${isConnected ? '' : 'disconnected'}`} />
            <span>{user?.username || 'Guest Player'}</span>
            {!user?.isVerified && (
              <span style={{ fontSize: '0.72rem', color: '#d4af37', display: 'flex', alignItems: 'center', gap: '3px', marginLeft: '4px' }}>
                <Edit3 size={11} /> (Guest)
              </span>
            )}
            {user?.role === 'ADMIN' && (
              <span className="role-tag-gold">ADMIN</span>
            )}
          </div>

          {!user?.isVerified ? (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                id="btn-nav-login"
                className="header-auth-btn"
                onClick={() => {
                  setAuthModalTab('LOGIN');
                  setIsAuthModalOpen(true);
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                id="btn-nav-register"
                className="header-auth-btn register"
                onClick={() => {
                  setAuthModalTab('REGISTER');
                  setIsAuthModalOpen(true);
                }}
              >
                Sign Up
              </button>
            </div>
          ) : (
            <button
              type="button"
              id="btn-nav-logout"
              className="header-auth-btn"
              onClick={logout}
              title="Sign Out"
            >
              Sign Out
            </button>
          )}
        </div>
      </header>

      {/* View Routing */}
      {currentView === 'ADMIN' ? (
        <AdminDashboard onExit={() => setCurrentView('LOBBY')} />
      ) : gameActive ? (
        <GameTable
          myUserId={user?.id || ''}
          activePlayerId={activePlayerId}
          wildJoker={wildJoker}
          openPileTop={openPileTop}
          hand={handGroups.flat()}
          handGroups={handGroups}
          selectedCardIds={selectedCardIds}
          opponents={opponents}
          turnPhase={turnPhase}
          remainingTurnTimeMs={remainingTurnTimeMs}
          selectedFinishCard={selectedFinishCard}
          onCardClick={handleCardClick}
          onGroupSelected={handleGroupSelected}
          onAutoSort={handleAutoSort}
          onDrawClosed={handleDrawClosed}
          onDrawOpen={handleDrawOpen}
          onDiscard={handleDiscard}
          onDeclare={handleDeclare}
          onDrop={handleDrop}
          onFinishSlotClick={handleFinishSlotClick}
        />
      ) : activeLobby ? (
        <div className="home-lobby-view">
          <WaitingLobby
            roomId={activeLobby.roomId}
            roomCode={activeLobby.roomCode}
            maxPlayers={activeLobby.maxPlayers}
            players={activeLobby.players}
            isHost={activeLobby.isHost}
            canStart={activeLobby.canStart}
            onStartGame={handleHostStartGame}
            onLeaveRoom={handleLeaveRoom}
          />
        </div>
      ) : (
        <div className="home-lobby-view">
          <div className="home-hero-card">
            <h1 className="hero-title">13-Card Indian Rummy</h1>
            <p className="hero-subtitle">
              Play authentic real-time multiplayer rummy. Create private tables to share with your friends, or jump into instant matchmaking. No chips, zero barriers — pure skill.
            </p>

            {!user?.isVerified && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 14px',
                  background: 'rgba(212, 175, 55, 0.08)',
                  border: '1px solid rgba(212, 175, 55, 0.25)',
                  borderRadius: '20px',
                  marginBottom: '18px',
                  fontSize: '0.85rem',
                  color: '#cbd5e1'
                }}
              >
                <span>Playing as Guest: <strong style={{ color: '#f6e05e' }}>{user?.username}</strong></span>
                <button
                  type="button"
                  onClick={() => setIsGuestNameModalOpen(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#d4af37',
                    textDecoration: 'underline',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    padding: '0 4px',
                    fontWeight: 600
                  }}
                >
                  Change Name
                </button>
              </div>
            )}

            <div className="action-card-grid">
              <button
                id="btn-create-table"
                type="button"
                className="action-card-btn primary"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <div className="action-card-icon-wrap primary">
                  <PlusCircle size={26} />
                </div>
                <div className="action-card-content">
                  <div className="action-card-title">Create Table</div>
                  <div className="action-card-desc">Host a 2 or 6-player room and invite friends with code</div>
                </div>
                <div className="action-card-arrow">
                  <ChevronRight size={18} />
                </div>
              </button>

              <button
                id="btn-join-with-code"
                type="button"
                className="action-card-btn secondary"
                onClick={() => setIsJoinModalOpen(true)}
              >
                <div className="action-card-icon-wrap secondary">
                  <KeyRound size={26} />
                </div>
                <div className="action-card-content">
                  <div className="action-card-title">Join with Code</div>
                  <div className="action-card-desc">Enter a friend's 6-character room code to join</div>
                </div>
                <div className="action-card-arrow">
                  <ChevronRight size={18} />
                </div>
              </button>
            </div>

            <div className="rules-quick-guide">
              <button
                type="button"
                className="btn-rules-guide"
                onClick={() => setIsRulesModalOpen(true)}
              >
                <BookOpen size={16} />
                <span>How to Play & Scoring Rules</span>
                <span className="rules-guide-pill">Pure Sequence • Wild Jokers • 80 Pt Cap</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <GuestNameModal
        isOpen={isGuestNameModalOpen}
        currentName={user?.username || ''}
        onClose={() => setIsGuestNameModalOpen(false)}
        onConfirm={async (chosenName) => {
          setIsGuestNameModalOpen(false);
          await updateDisplayName(chosenName);
        }}
        onOpenAuthModal={() => {
          setAuthModalTab('LOGIN');
          setIsAuthModalOpen(true);
        }}
      />

      <RoomCreationModal
        isOpen={isCreateModalOpen}
        isConnected={isConnected}
        currentUsername={user?.username || ''}
        isGuest={!user?.isVerified}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateRoom}
      />

      <RoomJoinModal
        isOpen={isJoinModalOpen}
        isConnected={isConnected}
        currentUsername={user?.username || ''}
        isGuest={!user?.isVerified}
        onClose={() => setIsJoinModalOpen(false)}
        onJoin={handleJoinRoom}
      />

      <RoundResultsModal
        isOpen={isResultsModalOpen}
        winnerId={roundWinnerId}
        scores={roundScores}
        myUserId={user?.id || ''}
        onPlayAgain={() => {
          setIsResultsModalOpen(false);
          setGameActive(false);
          setActiveLobby(null);
          setActiveRoomId(null);
        }}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialTab={authModalTab}
      />

      <RulesModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
