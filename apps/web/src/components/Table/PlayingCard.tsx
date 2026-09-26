import React from 'react';
import { CardDto, Suit } from '@rummy/shared';

export interface PlayingCardProps {
  card?: CardDto;
  isBack?: boolean;
  isSelected?: boolean;
  isWildJoker?: boolean;
  draggable?: boolean;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  onTouchStart?: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchMove?: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchEnd?: (e: React.TouchEvent<HTMLDivElement>) => void;
  className?: string;
  style?: React.CSSProperties;
  dataAttributes?: Record<string, string | number>;
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
  draggable = false,
  onClick,
  onDragStart,
  onDragOver,
  onDrop,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  className = '',
  style,
  dataAttributes
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
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={style}
      {...dataAttributes}
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
