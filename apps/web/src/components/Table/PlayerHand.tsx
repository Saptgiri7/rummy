import React from 'react';
import { CardDto } from '@rummy/shared';
import { isPureSequence, validateSequence, isValidSet, Card } from '@rummy/engine';
import { PlayingCard } from './PlayingCard.js';

export interface PlayerHandProps {
  cards: CardDto[];
  groups: CardDto[][];
  wildJoker: CardDto | null;
  selectedCardIds: string[];
  onCardClick: (card: CardDto) => void;
  onGroupSelected: () => void;
  onAutoSort: () => void;
}

export function evaluateMeldTag(group: CardDto[], wildJoker: CardDto | null): { label: string; type: 'pure' | 'impure' | 'set' | 'invalid' } {
  if (group.length < 3) {
    return { label: `${group.length} Cards`, type: 'invalid' };
  }

  // Cast CardDto to Card since shape matches
  const engineGroup = group as unknown as Card[];
  const engineJoker = wildJoker as unknown as Card;

  if (isPureSequence(engineGroup)) {
    return { label: 'Pure Seq', type: 'pure' };
  }

  const seqRes = validateSequence(engineGroup, engineJoker);
  if (seqRes.isValid) {
    return { label: 'Impure Seq', type: 'impure' };
  }

  if (isValidSet(engineGroup, engineJoker)) {
    return { label: 'Set', type: 'set' };
  }

  return { label: 'Invalid', type: 'invalid' };
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  groups,
  wildJoker,
  selectedCardIds,
  onCardClick,
  onGroupSelected,
  onAutoSort
}) => {
  const canGroup = selectedCardIds.length >= 2;

  return (
    <div className="player-hand-container">
      {/* Hand Controls: Auto-Sort & Group buttons */}
      <div className="hand-actions-bar">
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            id="btn-auto-sort"
            type="button"
            onClick={onAutoSort}
            style={{
              padding: '6px 14px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '9999px',
              color: '#f8fafc',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            ⚡ Auto-Sort
          </button>

          <button
            id="btn-group-cards"
            type="button"
            disabled={!canGroup}
            onClick={onGroupSelected}
            style={{
              padding: '6px 16px',
              background: canGroup ? 'linear-gradient(135deg, #d4af37, #b8860b)' : 'rgba(255,255,255,0.05)',
              border: canGroup ? 'none' : '1px solid rgba(255,255,255,0.1)',
              borderRadius: '9999px',
              color: canGroup ? '#000' : 'rgba(255,255,255,0.3)',
              fontSize: '0.8rem',
              fontWeight: 700
            }}
          >
            Group ({selectedCardIds.length})
          </button>
        </div>

        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
          Select cards to Group or Discard
        </div>
      </div>

      {/* Melds Display Row */}
      <div className="meld-groups-wrapper">
        {groups.map((group, groupIndex) => {
          const meldInfo = evaluateMeldTag(group, wildJoker);

          return (
            <div key={`group-${groupIndex}`} className="meld-group-slot">
              <span className={`meld-tag ${meldInfo.type}`}>
                {meldInfo.label}
              </span>

              <div className="meld-cards-row">
                {group.map((card) => {
                  const isSelected = selectedCardIds.includes(card.id);
                  const isWild = wildJoker ? card.rank === wildJoker.rank : false;

                  return (
                    <PlayingCard
                      key={card.id}
                      card={card}
                      isSelected={isSelected}
                      isWildJoker={isWild}
                      onClick={() => onCardClick(card)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
