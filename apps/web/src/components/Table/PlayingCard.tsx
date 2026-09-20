import React from 'react';
import { CardDto, Suit } from '@rummy/shared';

export interface PlayingCardProps {
  card?: CardDto;
  isBack?: boolean;
  isSelected?: boolean;
  isWildJoker?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const SUIT_SYMBOLS: Record<Suit, string> = {
  HEARTS: '♥',
  DIAMONDS: '♦',
  CLUBS: '♣',
  SPADES: '♠',
  NONE: '★'
};

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  isBack = false,
  isSelected = false,
  isWildJoker = false,
  onClick,
  className = '',
  style
}) => {
  if (isBack || !card) {
    return (
      <div
        className={`rummy-card back ${className}`}
        onClick={onClick}
        style={style}
        data-testid="card-back"
      />
    );
  }

  const isRed = card.suit === 'HEARTS' || card.suit === 'DIAMONDS';
  const suitSymbol = SUIT_SYMBOLS[card.suit] || '★';
  const isJokerCard = card.isPrintedJoker || isWildJoker;

  return (
    <div
      id={`card-${card.id}`}
      className={`rummy-card ${isSelected ? 'selected' : ''} ${className}`}
      onClick={onClick}
      style={style}
    >
      {/* Wild / Printed Joker Badge */}
      {isJokerCard && (
        <span className="wild-joker-badge">
          {card.isPrintedJoker ? 'JOKER' : 'WILD'}
        </span>
      )}

      {/* Top Left Corner */}
      <div className={`card-corner ${isRed ? 'suit-red' : 'suit-black'}`}>
        <span className="card-rank">{card.rank === 'JOKER' ? '★' : card.rank}</span>
        <span className="card-suit-symbol">{suitSymbol}</span>
      </div>

      {/* Center Main Symbol */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontSize: '1.75rem',
          lineHeight: 1
        }}
        className={isRed ? 'suit-red' : 'suit-black'}
      >
        {card.rank === 'JOKER' ? '🃏' : suitSymbol}
      </div>

      {/* Bottom Right Corner (Inverted) */}
      <div
        className={`card-corner ${isRed ? 'suit-red' : 'suit-black'}`}
        style={{ transform: 'rotate(180deg)' }}
      >
        <span className="card-rank">{card.rank === 'JOKER' ? '★' : card.rank}</span>
        <span className="card-suit-symbol">{suitSymbol}</span>
      </div>
    </div>
  );
};
