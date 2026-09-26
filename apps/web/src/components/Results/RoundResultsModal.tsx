import React from 'react';
import { Trophy, Award } from 'lucide-react';

export interface ScoreItem {
  playerId: string;
  points: number;
  penalty: number;
}

export interface RoundResultsModalProps {
  isOpen: boolean;
  winnerId: string;
  scores: ScoreItem[];
  myUserId: string;
  onPlayAgain: () => void;
}

export const RoundResultsModal: React.FC<RoundResultsModalProps> = ({
  isOpen,
  winnerId,
  scores,
  myUserId,
  onPlayAgain
}) => {
  if (!isOpen) return null;

  const isMeWinner = winnerId === myUserId;

  return (
    <div className="modal-overlay" data-testid="round-results-modal">
      <div className="modal-content" style={{ maxWidth: '540px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 12px auto',
              borderRadius: '50%',
              background: isMeWinner ? 'rgba(212, 175, 55, 0.15)' : 'rgba(148, 163, 184, 0.15)',
              border: isMeWinner ? '1px solid rgba(212, 175, 55, 0.4)' : '1px solid rgba(148, 163, 184, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isMeWinner ? '#fbbf24' : '#cbd5e1'
            }}
          >
            {isMeWinner ? <Trophy size={32} /> : <Award size={32} />}
          </div>
          <h2>{isMeWinner ? 'Victory' : 'Round Completed'}</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '4px' }}>
            {isMeWinner
              ? 'Congratulations! You won the round.'
              : `Winner: ${winnerId.slice(0, 10)}... scored 0 points`}
          </p>
        </div>

        {/* Scores Table */}
        <table className="results-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Penalty Points</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s) => {
              const isWinner = s.playerId === winnerId;
              const isMe = s.playerId === myUserId;

              return (
                <tr key={s.playerId} style={{ background: isWinner ? 'rgba(212, 175, 55, 0.1)' : 'transparent' }}>
                  <td>
                    <span style={{ fontWeight: isMe ? 700 : 500 }}>
                      {isMe ? 'You' : `Player (${s.playerId.slice(0, 6)})`}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        color: isWinner ? '#10b981' : '#f59e0b',
                        fontWeight: 700,
                        fontSize: '0.85rem'
                      }}
                    >
                      {isWinner ? 'WINNER' : s.points >= 80 ? 'FULL COUNT' : `${s.points} PTS`}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {s.penalty}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <button
          id="btn-play-again"
          type="button"
          className="quick-match-btn"
          onClick={onPlayAgain}
        >
          Return to Lobby
        </button>
      </div>
    </div>
  );
};
