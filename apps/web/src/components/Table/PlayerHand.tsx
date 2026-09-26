import React, { useState, useRef } from 'react';
import { CardDto } from '@rummy/shared';
import { isPureSequence, validateSequence, isValidSet, Card } from '@rummy/engine';
import { Wand2, Layers, Plus } from 'lucide-react';
import { PlayingCard } from './PlayingCard.js';

export interface PlayerHandProps {
  cards: CardDto[];
  groups: CardDto[][];
  wildJoker: CardDto | null;
  selectedCardIds: string[];
  onCardClick: (card: CardDto) => void;
  onGroupSelected: () => void;
  onAutoSort: () => void;
  onMoveCard?: (cardId: string, targetGroupIndex: number, targetCardIndex?: number) => void;
  onDiscardCard?: (cardId: string) => void;
  onDropFinishCard?: (cardId: string) => void;
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
  onAutoSort,
  onMoveCard,
  onDiscardCard,
  onDropFinishCard
}) => {
  const canGroup = selectedCardIds.length >= 2;
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverGroupIndex, setDragOverGroupIndex] = useState<number | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);

  const touchDragRef = useRef<{
    cardId: string;
    sourceGroupIndex: number;
    startX: number;
    startY: number;
    hasMoved: boolean;
  } | null>(null);

  // HTML5 Drag Handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, card: CardDto, groupIndex: number, cardIndex: number) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({
      cardId: card.id,
      sourceGroupIndex: groupIndex,
      sourceCardIndex: cardIndex
    }));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedCardId(card.id);
  };

  const handleDragEnd = () => {
    setDraggedCardId(null);
    setDragOverGroupIndex(null);
    setDragOverCardId(null);
  };

  const handleDropOnCard = (e: React.DragEvent<HTMLDivElement>, targetGroupIndex: number, targetCardIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverGroupIndex(null);
    setDragOverCardId(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.cardId && onMoveCard) {
        onMoveCard(data.cardId, targetGroupIndex, targetCardIndex);
      }
    } catch (err) {}
  };

  const handleDropOnGroup = (e: React.DragEvent<HTMLDivElement>, targetGroupIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverGroupIndex(null);
    setDragOverCardId(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.cardId && onMoveCard) {
        onMoveCard(data.cardId, targetGroupIndex);
      }
    } catch (err) {}
  };

  // Touch Handlers for Mobile
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>, card: CardDto, groupIndex: number) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchDragRef.current = {
      cardId: card.id,
      sourceGroupIndex: groupIndex,
      startX: touch.clientX,
      startY: touch.clientY,
      hasMoved: false
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch || !touchDragRef.current) return;

    const dx = Math.abs(touch.clientX - touchDragRef.current.startX);
    const dy = Math.abs(touch.clientY - touchDragRef.current.startY);
    if (dx > 8 || dy > 8) {
      touchDragRef.current.hasMoved = true;
      if (draggedCardId !== touchDragRef.current.cardId) {
        setDraggedCardId(touchDragRef.current.cardId);
      }

      // Check element under touch position
      const elem = document.elementFromPoint(touch.clientX, touch.clientY);
      if (elem) {
        const groupEl = elem.closest('[data-group-index]');
        if (groupEl) {
          const gIdx = Number(groupEl.getAttribute('data-group-index'));
          setDragOverGroupIndex(gIdx);
        } else if (elem.closest('#open-discard-pile')) {
          setDragOverGroupIndex(-1); // Special code for discard
        } else {
          setDragOverGroupIndex(null);
        }
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>, card: CardDto) => {
    if (!touchDragRef.current) return;
    const { cardId, hasMoved } = touchDragRef.current;
    const touch = e.changedTouches[0];

    if (hasMoved && touch) {
      const elem = document.elementFromPoint(touch.clientX, touch.clientY);
      if (elem) {
        // 1. Drop on Discard Pile
        if (elem.closest('#open-discard-pile') && onDiscardCard) {
          onDiscardCard(cardId);
        }
        // 2. Drop on Finish Slot
        else if (elem.closest('#finish-slot') && onDropFinishCard) {
          onDropFinishCard(cardId);
        }
        // 3. Drop on New Group Slot
        else if (elem.closest('.new-group-drop-slot') && onMoveCard) {
          onMoveCard(cardId, groups.length);
        }
        // 4. Drop on Target Group
        else if (elem.closest('[data-group-index]') && onMoveCard) {
          const groupEl = elem.closest('[data-group-index]');
          const gIdx = Number(groupEl?.getAttribute('data-group-index'));
          const cardEl = elem.closest('[data-card-index]');
          const cIdx = cardEl ? Number(cardEl.getAttribute('data-card-index')) : undefined;
          onMoveCard(cardId, gIdx, cIdx);
        }
      }
    } else if (!hasMoved) {
      // Clean tap/click
      onCardClick(card);
    }

    touchDragRef.current = null;
    setDraggedCardId(null);
    setDragOverGroupIndex(null);
    setDragOverCardId(null);
  };

  return (
    <div className="player-hand-container">
      {/* Hand Controls: Auto-Sort & Group buttons */}
      <div className="hand-actions-bar">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            id="btn-auto-sort"
            type="button"
            className="btn-hand-action"
            onClick={onAutoSort}
            title="Sort hand by suit and rank"
          >
            <Wand2 size={13} />
            <span>Auto-Sort</span>
          </button>

          <button
            id="btn-group-cards"
            type="button"
            className={`btn-hand-action group ${canGroup ? 'active' : ''}`}
            disabled={!canGroup}
            onClick={onGroupSelected}
            title="Group selected cards"
          >
            <Layers size={13} />
            <span>Group ({selectedCardIds.length})</span>
          </button>
        </div>

        <div className="hand-help-text">
          Drag cards to arrange, group, or discard
        </div>
      </div>

      {/* Melds Display Row */}
      <div className="meld-groups-wrapper">
        {groups.map((group, groupIndex) => {
          const meldInfo = evaluateMeldTag(group, wildJoker);
          const isGroupDragOver = dragOverGroupIndex === groupIndex;

          return (
            <div
              key={`group-${groupIndex}`}
              className={`meld-group-slot ${isGroupDragOver ? 'drag-over-group' : ''}`}
              data-group-index={groupIndex}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverGroupIndex !== groupIndex) {
                  setDragOverGroupIndex(groupIndex);
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  if (dragOverGroupIndex === groupIndex) {
                    setDragOverGroupIndex(null);
                  }
                }
              }}
              onDrop={(e) => handleDropOnGroup(e, groupIndex)}
            >
              <span className={`meld-tag ${meldInfo.type}`}>
                {meldInfo.label}
              </span>

              <div className="meld-cards-row">
                {group.map((card, cardIndex) => {
                  const isSelected = selectedCardIds.includes(card.id);
                  const isWild = wildJoker ? card.rank === wildJoker.rank : false;
                  const isDraggingThis = draggedCardId === card.id;
                  const isDragOverThis = dragOverCardId === card.id;

                  return (
                    <PlayingCard
                      key={card.id}
                      card={card}
                      isSelected={isSelected}
                      isWildJoker={isWild}
                      draggable={true}
                      className={`${isDraggingThis ? 'is-dragging' : ''} ${isDragOverThis ? 'drag-over-card' : ''}`}
                      onClick={() => onCardClick(card)}
                      onDragStart={(e) => handleDragStart(e, card, groupIndex, cardIndex)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverCardId !== card.id) {
                          setDragOverCardId(card.id);
                        }
                      }}
                      onDrop={(e) => handleDropOnCard(e, groupIndex, cardIndex)}
                      onTouchStart={(e) => handleTouchStart(e, card, groupIndex)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={(e) => handleTouchEnd(e, card)}
                      dataAttributes={{
                        'data-card-id': card.id,
                        'data-card-index': cardIndex,
                        'data-group-index': groupIndex
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Drop slot to create a brand new group */}
        <div
          className={`new-group-drop-slot ${dragOverGroupIndex === groups.length ? 'drop-target-active' : ''}`}
          data-group-index={groups.length}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (dragOverGroupIndex !== groups.length) {
              setDragOverGroupIndex(groups.length);
            }
          }}
          onDragLeave={() => {
            if (dragOverGroupIndex === groups.length) {
              setDragOverGroupIndex(null);
            }
          }}
          onDrop={(e) => handleDropOnGroup(e, groups.length)}
          title="Drop here to form a new group"
        >
          <Plus size={16} />
          <span>New Group</span>
        </div>
      </div>
    </div>
  );
};
