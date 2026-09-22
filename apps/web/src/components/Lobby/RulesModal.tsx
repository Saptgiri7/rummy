import React from 'react';
import { Modal } from '../ui/Modal.js';
import { Button } from '../ui/Button.js';
import { BookOpen, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="How to Play & Scoring Rules"
      subtitle="Standard 13-Card Indian Points Rummy Guidelines"
      icon={<BookOpen size={20} />}
      maxWidth="580px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontSize: '0.88rem', color: '#cbd5e1' }}>
        {/* Objective */}
        <div style={{ padding: '14px 16px', background: 'rgba(212, 175, 55, 0.06)', borderRadius: '10px', border: '1px solid rgba(212, 175, 55, 0.2)' }}>
          <h4 style={{ margin: '0 0 6px 0', color: '#d4af37', fontSize: '0.95rem', fontWeight: 700 }}>
            🃏 Game Objective
          </h4>
          <p style={{ margin: 0, lineHeight: 1.5, color: '#e2e8f0' }}>
            Arrange your 13 cards into valid melds: at least <strong>two sequences</strong> (one must be a Pure Sequence), and the remaining cards into sequences or sets.
          </p>
        </div>

        {/* Sequences */}
        <div>
          <h4 style={{ margin: '0 0 10px 0', color: '#f8fafc', fontSize: '0.92rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} color="#10b981" />
            Mandatory Sequences (First & Second Life)
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ padding: '10px 14px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
              <div style={{ color: '#34d399', fontWeight: 600, marginBottom: '2px' }}>1. Pure Sequence (First Life — Mandatory)</div>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                3 or more consecutive cards of the same suit <em>without jokers</em>. E.g. <strong style={{ color: '#f1f5f9' }}>4♠ - 5♠ - 6♠</strong>.
              </div>
            </div>

            <div style={{ padding: '10px 14px', background: 'rgba(56, 189, 248, 0.08)', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
              <div style={{ color: '#38bdf8', fontWeight: 600, marginBottom: '2px' }}>2. Second Sequence (Second Life — Mandatory)</div>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                Can be pure or impure with Wild or Printed Jokers. E.g. <strong style={{ color: '#f1f5f9' }}>8♥ - 9♥ - 🃏</strong>.
              </div>
            </div>
          </div>
        </div>

        {/* Sets */}
        <div>
          <h4 style={{ margin: '0 0 6px 0', color: '#f8fafc', fontSize: '0.92rem', fontWeight: 700 }}>
            Valid Sets
          </h4>
          <p style={{ margin: '0 0 6px 0', fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5 }}>
            3 or 4 cards of the same rank with <em>different suits</em> (e.g. <strong style={{ color: '#f1f5f9' }}>7♠ - 7♦ - 7♣</strong>). Duplicate suits in the same set are strictly invalid.
          </p>
        </div>

        {/* Scoring & Penalties */}
        <div>
          <h4 style={{ margin: '0 0 10px 0', color: '#f8fafc', fontSize: '0.92rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} color="#f59e0b" />
            Scoring & Penalties
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ padding: '10px 12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ color: '#10b981', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>0 Points</div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Valid Declaration Winner</div>
            </div>
            <div style={{ padding: '10px 12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ color: '#f59e0b', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>20 Points</div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>First Drop (before 1st draw)</div>
            </div>
            <div style={{ padding: '10px 12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ color: '#f97316', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>40 Points</div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Middle Drop (after ≥1 draw)</div>
            </div>
            <div style={{ padding: '10px 12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ color: '#ef4444', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>80 Points</div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Bogus Show / Max Penalty Cap</div>
            </div>
          </div>
        </div>

        {/* Turn Timer Notice */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.8rem', color: '#94a3b8' }}>
          <Clock size={16} color="#d4af37" />
          <span>Each turn has a <strong>30-second timer</strong>. If the timer expires, the server will auto-draw and discard. 3 consecutive timeouts trigger an auto-drop.</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <Button variant="primary" onClick={onClose} style={{ minWidth: '120px' }}>
            Got It
          </Button>
        </div>
      </div>
    </Modal>
  );
};
