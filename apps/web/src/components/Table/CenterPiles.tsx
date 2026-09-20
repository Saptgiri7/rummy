import React from 'react';
import { CardDto } from '@rummy/shared';
import { PlayingCard } from './PlayingCard.js';

export interface CenterPilesProps {
  wildJoker?: CardDto | null;
  openCard?: CardDto | null;
  closedDeckCount?: number;
  canDraw?: boolean;
  onDrawClosed?: () => void;
  onDrawOpen?: () => void;
  onFinishSelect?: () => void;
  selectedFinishCard?: CardDto | null;
}

export const CenterPiles: React.FC<CenterPilesProps> = ({
  wildJoker,
  openCard,
  canDraw = false,
  onDrawClosed,
  onDrawOpen,
  onFinishSelect,
  selectedFinishCard
}) => {
  return (
    <div className="center-piles-container">
      {/* 1. Closed Draw Deck + Wild Joker */}
      <div
        id="closed-draw-deck"
        className="deck-pile-slot"
        onClick={canDraw ? onDrawClosed : undefined}
        style={{ cursor: canDraw ? 'pointer' : 'default' }}
      >
        <span className="deck-slot-label">Closed Deck</span>
        <div style={{ position: 'relative' }}>
          {/* Wild Joker Cut Card angled under closed deck */}
          {wildJoker && (
            <div className="wild-cut-card">
              <PlayingCard card={wildJoker} isWildJoker={true} />
            </div>
          )}

          {/* Top Closed Card */}
          <div style={{ position: 'relative', zIndex: 10 }}>
            <PlayingCard isBack={true} />
          </div>
        </div>
        {canDraw && (
          <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>
            Tap to Draw
          </span>
        )}
      </div>

      {/* 2. Open Discard Pile */}
      <div
        id="open-discard-pile"
        className="deck-pile-slot"
        onClick={canDraw && openCard ? onDrawOpen : undefined}
        style={{ cursor: canDraw && openCard ? 'pointer' : 'default' }}
      >
        <span className="deck-slot-label">Open Pile</span>
        {openCard ? (
          <PlayingCard card={openCard} />
        ) : (
          <div
            style={{
              width: '72px',
              height: '104px',
              border: '2px dashed rgba(255,255,255,0.2)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.3)',
              fontSize: '0.75rem'
            }}
          >
            Empty
          </div>
        )}
        {canDraw && openCard && (
          <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700 }}>
            Pick Discard
          </span>
        )}
      </div>

      {/* 3. Finish Slot */}
      <div
        id="finish-slot"
        className="deck-pile-slot"
        onClick={onFinishSelect}
      >
        <span className="deck-slot-label" style={{ color: '#d4af37' }}>Finish Slot</span>
        {selectedFinishCard ? (
          <PlayingCard card={selectedFinishCard} isSelected={true} />
        ) : (
          <div
            style={{
              width: '72px',
              height: '104px',
              border: '2px dashed rgba(212, 175, 55, 0.4)',
              borderRadius: '6px',
              background: 'rgba(212, 175, 55, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d4af37',
              fontSize: '0.72rem',
              fontWeight: 700,
              textAlign: 'center',
              padding: '6px'
            }}
          >
            <span>Declare Slot</span>
          </div>
        )}
      </div>
    </div>
  );
};
