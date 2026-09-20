import React, { useEffect, useState } from 'react';

export interface TurnTimerProps {
  initialSeconds?: number;
  remainingMs?: number;
  totalDurationMs?: number;
  isActive?: boolean;
}

export const TurnTimer: React.FC<TurnTimerProps> = ({
  initialSeconds = 30,
  remainingMs,
  totalDurationMs = 30000,
  isActive = true
}) => {
  const [timeLeft, setTimeLeft] = useState(
    remainingMs !== undefined ? Math.ceil(remainingMs / 1000) : initialSeconds
  );

  useEffect(() => {
    if (remainingMs !== undefined) {
      setTimeLeft(Math.max(0, Math.ceil(remainingMs / 1000)));
    }
  }, [remainingMs]);

  useEffect(() => {
    if (!isActive || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, timeLeft]);

  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, Math.max(0, (timeLeft * 1000) / totalDurationMs));
  const strokeDashoffset = circumference * (1 - progress);

  let strokeColor = '#10b981'; // Emerald
  if (timeLeft <= 5) {
    strokeColor = '#ef4444'; // Red urgency
  } else if (timeLeft <= 10) {
    strokeColor = '#f59e0b'; // Amber warning
  }

  return (
    <div className="timer-container" data-testid="turn-timer">
      <svg className="timer-svg" viewBox="0 0 60 60">
        <circle className="timer-circle-bg" cx="30" cy="30" r={radius} />
        <circle
          className="timer-circle-progress"
          cx="30"
          cy="30"
          r={radius}
          stroke={strokeColor}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <span
        className="timer-text"
        style={{
          color: strokeColor,
          animation: timeLeft <= 5 ? 'pulse 1s infinite' : 'none'
        }}
      >
        {timeLeft}s
      </span>
    </div>
  );
};
