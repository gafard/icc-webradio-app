'use client';

import { type ReactNode } from 'react';
import {
  Clipboard,
  Eye,
  FileText,
  Highlighter,
  MessageSquare,
  Pause,
  Play,
  Search,
} from 'lucide-react';

type ToolMode = 'read' | 'highlight' | 'note';
type HighlightColor = 'yellow' | 'green' | 'pink' | 'blue' | 'orange' | 'purple';
type AudioVerseSegment = {
  verse: number;
  start: number;
  end: number;
};

const HIGHLIGHT_OPTIONS: Array<{ id: HighlightColor; label: string }> = [
  { id: 'yellow', label: 'Jaune' },
  { id: 'green', label: 'Vert' },
  { id: 'pink', label: 'Rose' },
  { id: 'blue', label: 'Bleu' },
  { id: 'orange', label: 'Orange' },
  { id: 'purple', label: 'Violet' },
];

type ToolbarBtnProps = {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
};

function MobileToolbarBtn({ active, label, icon, onClick }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-extrabold leading-none transition ${
        active
          ? 'border-[color:var(--accent-border)]/60 bg-[color:var(--accent-soft)]/45 text-[color:var(--foreground)]'
          : 'border-white/15 bg-white/10 text-[color:var(--foreground)]/82 hover:bg-white/15'
      }`}
      title={label}
    >
      <span className="leading-none">{icon}</span>
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

function AudioVerseTimeline({
  segments,
  activeVerseNumber,
  playerProgress,
  onSeekToVerse,
}: {
  segments: AudioVerseSegment[];
  activeVerseNumber: number | null;
  playerProgress: number;
  onSeekToVerse: (verse: number) => void;
}) {
  if (!segments.length) return null;

  const first = segments[0];
  const last = segments[segments.length - 1];
  const totalSpan = Math.max(0.12, (last?.end ?? 0) - (first?.start ?? 0));
  const currentTime = (first?.start ?? 0) + totalSpan * Math.max(0, Math.min(1, playerProgress));

  return (
    <div className="mt-1 mx-auto w-full max-w-[780px] rounded-lg border border-white/12 bg-white/8 px-1 py-1">
      <div className="w-full overflow-x-auto pb-0.5">
        <div
          className="mx-auto flex min-w-full items-center gap-[3px]"
          aria-label={activeVerseNumber ? `Verset audio actif ${activeVerseNumber}` : 'Timeline audio'}
        >
          {segments.map((segment) => {
            const duration = Math.max(0.08, segment.end - segment.start);
            const ratio = duration / totalSpan;
            const isDone = currentTime >= segment.end - 0.02;
            const isActive = activeVerseNumber === segment.verse;
            return (
              <button
                key={`audio-segment-${segment.verse}`}
                type="button"
                onClick={() => onSeekToVerse(segment.verse)}
                className={`h-2 rounded-full border transition ${
                  isActive
                    ? 'border-orange-300/80 bg-orange-300 shadow-[0_0_0_2px_rgba(251,146,60,0.26)]'
                    : isDone
                      ? 'border-[color:var(--accent-border)]/65 bg-[color:var(--accent)]/85'
                      : 'border-white/20 bg-white/18 hover:bg-white/30'
                }`}
                style={{
                  flexGrow: Math.max(0.4, ratio * 100),
                  flexBasis: 0,
                  minWidth: '5px',
                  maxWidth: '18px',
                }}
                title={`Aller au verset ${segment.verse}`}
                aria-label={`Aller au verset ${segment.verse}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

type BibleToolbarProps = {
  tool: ToolMode;
  setTool: (t: ToolMode) => void;
  onCopy: () => void;
  onOpenCompare: () => void;
  highlightColor: HighlightColor;
  setHighlightColor: (color: HighlightColor) => void;
  onOpenAdvancedStudyTools: () => void;
  playerProgress: number;
  playerPlaying: boolean;
  onTogglePlayer: () => void;
  audioAvailable: boolean;
  isClient: boolean;
  audioVerseSegments: AudioVerseSegment[];
  activeAudioVerseNumber: number | null;
  onSeekToAudioVerse: (verse: number) => void;
};

export default function BibleToolbar({
  tool,
  setTool,
  onCopy,
  onOpenCompare,
  highlightColor,
  setHighlightColor,
  onOpenAdvancedStudyTools,
  playerProgress,
  playerPlaying,
  onTogglePlayer,
  audioAvailable,
  isClient,
  audioVerseSegments,
  activeAudioVerseNumber,
  onSeekToAudioVerse,
}: BibleToolbarProps) {
  const COLOR_DOT: Record<HighlightColor, string> = {
    yellow: 'bg-yellow-300',
    green: 'bg-green-300',
    pink: 'bg-pink-300',
    blue: 'bg-blue-300',
    orange: 'bg-orange-300',
    purple: 'bg-violet-300',
  };
  return (
    <div className="block">
      <div className="bible-toolbar w-full rounded-2xl p-2 shadow-[0_18px_45px_rgba(0,0,0,0.28)]">
        <div className="overflow-x-auto pb-0.5">
          <div className="mx-auto flex min-w-max flex-nowrap items-center gap-1.5">
            <MobileToolbarBtn
              active={tool === 'read'}
              label="Lecture"
              icon={<Eye size={16} />}
              onClick={() => setTool('read')}
            />
            <MobileToolbarBtn
              active={tool === 'highlight'}
              label="Surligner"
              icon={<Highlighter size={16} />}
              onClick={() => setTool(tool === 'highlight' ? 'read' : 'highlight')}
            />
            <MobileToolbarBtn
              active={tool === 'note'}
              label="Note"
              icon={<FileText size={16} />}
              onClick={() => setTool('note')}
            />
            <MobileToolbarBtn
              active={false}
              label="Comparer"
              icon={<Search size={16} />}
              onClick={onOpenCompare}
            />
            <MobileToolbarBtn
              active={false}
              label="Étudier"
              icon={<MessageSquare size={16} />}
              onClick={onOpenAdvancedStudyTools}
            />
            {tool === 'highlight' &&
              HIGHLIGHT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`shrink-0 rounded-xl px-2.5 py-2 text-[11px] font-bold transition ${
                    highlightColor === option.id
                      ? 'border border-[color:var(--accent-border)]/60 bg-[color:var(--accent-soft)]/45 text-[color:var(--foreground)]'
                      : 'border border-white/15 bg-white/10 text-[color:var(--foreground)]/80 hover:bg-white/15'
                  }`}
                  onClick={() => setHighlightColor(option.id)}
                >
                  <span className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-full ${COLOR_DOT[option.id]}`} />
                  {option.label}
                </button>
              ))}
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-2.5 text-[11px] font-bold"
            >
              <Clipboard size={14} />
              Copier
            </button>
            <div className="relative shrink-0">
              <svg className="pointer-events-none absolute -inset-1 h-11 w-11" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="18" stroke="var(--border-soft)" strokeWidth="3" fill="none" />
                <circle
                  cx="24"
                  cy="24"
                  r="18"
                  stroke="var(--accent)"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 18}
                  strokeDashoffset={2 * Math.PI * 18 * (1 - playerProgress)}
                  style={{ transition: 'stroke-dashoffset 0.4s ease' }}
                />
              </svg>
              <button
                type="button"
                onClick={onTogglePlayer}
                className={`btn-icon h-9 w-9 bg-white/80${
                  isClient && audioAvailable ? '' : ' opacity-50 cursor-not-allowed'
                }`}
                aria-label={playerPlaying ? 'Pause' : 'Play'}
                title={playerPlaying ? 'Pause' : 'Play'}
                disabled={!isClient || !audioAvailable}
              >
                {playerPlaying ? <Pause size={14} /> : <Play size={14} />}
              </button>
            </div>
          </div>
        </div>
        {playerPlaying ? (
          <AudioVerseTimeline
            segments={audioVerseSegments}
            activeVerseNumber={activeAudioVerseNumber}
            playerProgress={playerProgress}
            onSeekToVerse={onSeekToAudioVerse}
          />
        ) : null}
      </div>
    </div>
  );
}
