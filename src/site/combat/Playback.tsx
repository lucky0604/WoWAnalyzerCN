import { useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';

import { Button } from 'site/ui/Button';

interface PlaybackProps {
  current: string;
  duration: string;
  /** 0–1 */
  progress: number;
  onSeek?: (progress: number) => void;
}

const SPEEDS = ['1×', '2×', '4×'];

/** 回放条：播放头呼吸，速度切换为视觉稿演示态 */
export function Playback({ current, duration, progress, onSeek }: PlaybackProps) {
  const scrubRef = useRef<HTMLDivElement>(null);
  const [speed, setSpeed] = useState(0);

  const clamp = (p: number) => Math.min(1, Math.max(0, p));

  const seek = (e: MouseEvent) => {
    const el = scrubRef.current;
    if (!el || !onSeek) {
      return;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) {
      return;
    }
    onSeek(clamp((e.clientX - rect.left) / rect.width));
  };

  const seekBy = (delta: number) => {
    onSeek?.(clamp(progress + delta));
  };

  const onScrubKeyDown = (e: KeyboardEvent) => {
    if (!onSeek) {
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      seekBy(-0.02);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      seekBy(0.02);
    } else if (e.key === 'Home') {
      e.preventDefault();
      onSeek(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      onSeek(1);
    }
  };

  return (
    <div className="playback">
      <Button variant="ghost" className="playback-play" aria-label="播放 / 暂停">
        <svg width="11" height="12" viewBox="0 0 11 12" aria-hidden="true">
          <path d="M1 1l9 5-9 5z" fill="currentColor" />
        </svg>
      </Button>
      <span className="playback-time t-mono">
        {current} / {duration}
      </span>
      <div
        ref={scrubRef}
        className="playback-scrub"
        onClick={seek}
        role="slider"
        aria-label="回放进度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        tabIndex={0}
        onKeyDown={onScrubKeyDown}
      >
        <div className="playback-scrub-fill" style={{ width: `${progress * 100}%` }} />
        <div className="playback-scrub-handle playhead" style={{ left: `${progress * 100}%` }} />
      </div>
      <div className="playback-speeds">
        {SPEEDS.map((s, i) => (
          <button
            key={s}
            className={`playback-speed ${i === speed ? 'is-on' : ''}`}
            onClick={() => setSpeed(i)}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
