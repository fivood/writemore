import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LoaderCircle } from 'lucide-react';
import { publicAsset } from '../lib/assets';
import { playKeystroke } from '../lib/soundEngine';
import type { DailyBox } from '../store';

/** kinotype 标定的古董打字机圆键帽坐标 */
const KEYBOARD_LAYOUT: Record<string, { top: string; left: string; img?: string; width?: string }> = {
  '2': { top: '54.25%', left: '21.25%' },
  '3': { top: '54.25%', left: '28.00%' },
  '4': { top: '54.25%', left: '34.25%' },
  '5': { top: '54.25%', left: '40.25%' },
  '6': { top: '54.25%', left: '46.63%' },
  '7': { top: '54.25%', left: '53.00%' },
  '8': { top: '54.25%', left: '59.25%' },
  '9': { top: '54.25%', left: '65.63%' },
  '0': { top: '54.25%', left: '71.75%' },
  '*': { top: '54.25%', left: '78.25%', img: 'star' },
  'backspace': { top: '54.25%', left: '84.63%' },

  'q': { top: '61.85%', left: '24.25%' },
  'w': { top: '61.85%', left: '30.38%' },
  'e': { top: '61.85%', left: '36.75%' },
  'r': { top: '61.85%', left: '43.13%' },
  't': { top: '61.85%', left: '49.38%' },
  'y': { top: '61.85%', left: '55.75%' },
  'u': { top: '61.85%', left: '62.00%' },
  'i': { top: '61.85%', left: '68.38%' },
  'o': { top: '61.85%', left: '74.75%' },
  'p': { top: '61.85%', left: '81.25%' },

  'capslock': { top: '69.35%', left: '18.13%' },
  'a': { top: '69.35%', left: '25.87%' },
  's': { top: '69.35%', left: '32.25%' },
  'd': { top: '69.35%', left: '38.75%' },
  'f': { top: '69.35%', left: '44.88%' },
  'g': { top: '69.35%', left: '51.50%' },
  'h': { top: '69.35%', left: '57.88%' },
  'j': { top: '69.35%', left: '64.50%' },
  'k': { top: '69.35%', left: '70.75%' },
  'l': { top: '69.35%', left: '77.13%' },
  ';': { top: '69.35%', left: '83.75%', img: 'semicolon' },

  'shift': { top: '76.75%', left: '20.38%' },
  'z': { top: '76.75%', left: '28.75%' },
  'x': { top: '76.75%', left: '35.00%' },
  'c': { top: '76.75%', left: '41.63%' },
  'v': { top: '76.75%', left: '48.00%' },
  'b': { top: '76.75%', left: '54.37%' },
  'n': { top: '76.75%', left: '60.88%' },
  'm': { top: '76.75%', left: '67.50%' },
  '.': { top: '76.75%', left: '74.25%', img: 'dot' },
  '?': { top: '76.75%', left: '80.63%', img: 'question' },
  'enter': { top: '76.75%', left: '87.50%' },

  'space': { top: '84.61%', left: '52.25%', width: '45%' },
};

function normalizeEventKey(e: KeyboardEvent): string {
  const key = e.key.toLowerCase();
  if (key === 'process' || key === 'unidentified') {
    if (e.code?.startsWith('Key')) return e.code.slice(3).toLowerCase();
    if (e.code?.startsWith('Digit')) return e.code.slice(5);
    if (e.code === 'Space') return 'space';
    if (e.code === 'Backspace') return 'backspace';
    if (e.code === 'Enter') return 'enter';
    return 'a';
  }
  if (key === ' ') return 'space';
  if (key === ',') return '.';
  if (key === '!') return '2';
  if (key === '@') return '2';
  if (key === '#') return '3';
  if (key === '$') return '4';
  if (key === '%') return '5';
  if (key === '^') return '6';
  if (key === '&') return '7';
  return key;
}

export function VintageKeycap({ keyName, className = 'w-6 h-6' }: { keyName: string; className?: string }) {
  return (
    <img
      src={publicAsset(`typewriter/keys/key-${keyName}.png`)}
      alt={keyName}
      draggable={false}
      className={`inline-block select-none object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.28)] ${className}`}
    />
  );
}

/**
 * 完整无裁切的古董打字机分层组装体
 */
function TypewriterAssembly({
  pressedKeys,
  carriageOffsetPct = 0,
  leverKick = false,
  striking = false,
}: {
  pressedKeys?: Set<string>;
  carriageOffsetPct?: number;
  leverKick?: boolean;
  striking?: boolean;
}) {
  return (
    <div className="relative w-full select-none drop-shadow-[0_8px_14px_rgba(0,0,0,0.18)]">
      <div
        className="absolute inset-0 z-[1] transition-transform duration-100 ease-out"
        style={{ transform: `translateX(${carriageOffsetPct}%)` }}
      >
        <img
          src={publicAsset('typewriter/typewriter-paper-table.png')}
          alt=""
          draggable={false}
          className="absolute top-0 left-0 w-full h-auto"
        />
        <img
          src={publicAsset('typewriter/typewriter-carriage.png')}
          alt=""
          draggable={false}
          className="absolute top-0 left-0 w-full h-auto"
        />
        <img
          src={publicAsset('typewriter/typewriter-lever.png')}
          alt=""
          draggable={false}
          className={`absolute top-0 left-0 w-full h-auto z-[4] origin-[12%_22%] ${leverKick ? 'animate-lever-return' : ''}`}
        />
      </div>

      <img
        src={publicAsset('typewriter/typewriter-body.png')}
        alt="复古打字机"
        draggable={false}
        className="relative z-[2] block w-full h-auto"
      />

      <i
        className="absolute z-[3] left-[49.6%] top-[22%] w-[1%] h-[16%] pointer-events-none transition-opacity duration-75"
        style={{
          background: 'linear-gradient(90deg, #4b4739, #d4c3a1, #4b4739)',
          opacity: striking ? 0.92 : 0,
          transform: striking ? 'translateY(-2px)' : 'translateY(8px)',
        }}
      />

      <span className="brass-nameplate absolute z-[12] left-[41.5%] top-[46.8%] w-[22%] h-[4.6%] flex items-center justify-center font-bold text-[7px] sm:text-[8px]">
        WRITEMORE
      </span>

      <div className="absolute inset-0 z-[10]">
        {Object.entries(KEYBOARD_LAYOUT).map(([keyChar, pos]) => {
          const pressed = pressedKeys?.has(keyChar) ?? false;
          const file = pos.img ?? keyChar;
          return (
            <img
              key={keyChar}
              src={publicAsset(`typewriter/keys/key-${file}.png`)}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                top: pos.top,
                left: pos.left,
                width: pos.width ?? '5.8%',
                transform: pressed
                  ? 'translate(-50%, -34%) scale(0.94)'
                  : 'translate(-50%, -50%) scale(1)',
                filter: pressed ? 'brightness(0.78)' : 'brightness(1)',
                transition: 'transform 65ms ease-out, filter 65ms ease-out',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * 写作页底部的完整古董打字机联动底座
 */
export function WritingMachineDock({
  open,
  sidebarCollapsed = false,
  onToggle,
}: {
  open: boolean;
  sidebarCollapsed?: boolean;
  onToggle: (next: boolean) => void;
}) {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [carriageStep, setCarriageStep] = useState(0);
  const [leverKick, setLeverKick] = useState(false);
  const [striking, setStriking] = useState(false);
  const strikeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const leverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const inEditor =
        !!target &&
        (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable);

      const norm = normalizeEventKey(e);

      if (inEditor) {
        playKeystroke(norm === 'space' ? ' ' : norm);
      }

      if (!open) return;

      setPressedKeys(prev => {
        if (prev.has(norm)) return prev;
        const next = new Set(prev);
        next.add(norm);
        return next;
      });

      if (norm === 'enter') {
        setCarriageStep(0);
        setLeverKick(false);
        requestAnimationFrame(() => setLeverKick(true));
        clearTimeout(leverTimer.current);
        leverTimer.current = setTimeout(() => setLeverKick(false), 380);
      } else if (norm === 'backspace') {
        setCarriageStep(s => Math.max(0, s - 1));
      } else if (norm.length === 1 || norm === 'space') {
        setCarriageStep(s => (s + 1) % 38);
        if (norm !== 'space') {
          setStriking(true);
          clearTimeout(strikeTimer.current);
          strikeTimer.current = setTimeout(() => setStriking(false), 110);
        }
      }

      if (e.key === 'Process' || norm === 'capslock') {
        setTimeout(() => {
          setPressedKeys(prev => {
            if (!prev.has(norm)) return prev;
            const next = new Set(prev);
            next.delete(norm);
            return next;
          });
        }, 130);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const norm = normalizeEventKey(e);
      setPressedKeys(prev => {
        if (!prev.has(norm)) return prev;
        const next = new Set(prev);
        next.delete(norm);
        return next;
      });
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      clearTimeout(strikeTimer.current);
      clearTimeout(leverTimer.current);
    };
  }, [open]);

  if (!open) return null;

  const carriageOffsetPct = -(carriageStep * 0.16);

  return (
    <div
      className={`hidden md:flex fixed bottom-[40px] right-0 z-20 justify-center pointer-events-none select-none transition-[left] duration-300 ${
        sidebarCollapsed ? 'left-0' : 'left-[320px]'
      }`}
      aria-hidden="true"
    >
      <div className="relative w-[330px] lg:w-[370px] group">
        <button
          onClick={() => onToggle(false)}
          title="收起打字机"
          className="pointer-events-auto absolute -right-2 top-3 z-30 p-1 bg-surface-container text-on-surface-variant border border-on-surface/25 opacity-0 group-hover:opacity-100 hover:text-primary transition-all cursor-pointer"
        >
          <ChevronDown size={14} />
        </button>

        <TypewriterAssembly
          pressedKeys={pressedKeys}
          carriageOffsetPct={carriageOffsetPct}
          leverKick={leverKick}
          striking={striking}
        />
      </div>
    </div>
  );
}

/**
 * 左上头条插图框：古董打字机与今日灵感盲盒（嵌在参考海报左上大横图位）
 */
export function DailyDispatchMachine({
  box,
  isOpening,
  onOpen,
  onStart,
}: {
  box: DailyBox | null;
  isOpening: boolean;
  onOpen: () => void;
  onStart: () => void;
}) {
  return (
    <div className="border border-on-surface/22 bg-surface/35 p-6 md:p-8 min-h-[250px] md:min-h-[280px] flex items-center">
      <div className="w-full grid grid-cols-1 sm:grid-cols-12 gap-6 md:gap-7 items-center">
        {/* 左：全貌打字机 */}
        <div
          onClick={!box && !isOpening ? onOpen : undefined}
          title={!box ? '点击打字机拆开今日盲盒' : undefined}
          className={`sm:col-span-6 flex items-center justify-center ${!box ? 'cursor-pointer group' : ''}`}
        >
          <div className={`w-[240px] md:w-[295px] transition-transform duration-300 ${!box ? 'group-hover:-translate-y-0.5' : ''}`}>
            <TypewriterAssembly
              carriageOffsetPct={isOpening ? -1.4 : 0}
              leverKick={isOpening}
              striking={isOpening}
            />
          </div>
        </div>

        {/* 右：盲盒文字区 */}
        <div className="sm:col-span-6 flex flex-col justify-center text-center sm:text-left sm:border-l sm:border-dashed sm:border-on-surface/35 sm:pl-7">
          {!box ? (
            <div className="space-y-4">
              <h2 className="font-headline text-2xl md:text-[26px] font-bold text-on-surface">
                今日灵感盲盒
              </h2>
              <p className="font-body text-sm md:text-[15px] text-on-surface-variant leading-relaxed">
                每日一次，随机抽取三个词条与一道场景或挑战题。点击打字机或下方按钮开启。
              </p>
              <div className="pt-1">
                <button
                  onClick={onOpen}
                  disabled={isOpening}
                  className="px-5 py-2.5 bg-primary text-on-primary hover:bg-primary-dim transition-colors font-label text-sm disabled:opacity-60 inline-flex items-center gap-2 cursor-pointer"
                >
                  {isOpening ? (
                    <>
                      <LoaderCircle size={15} className="animate-spin" />
                      <span>抽取中…</span>
                    </>
                  ) : (
                    <span>拆开今日盲盒</span>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-paper-eject">
              <div className="flex items-center justify-center sm:justify-start gap-2.5 pb-2 border-b border-dashed border-on-surface/30">
                <h2 className="font-headline text-xl md:text-2xl font-bold text-on-surface">今日盲盒</h2>
                <span className="px-2 py-0.5 border border-on-surface/35 text-xs font-label text-on-surface-variant">
                  {box.promptType === 'scene' ? '场景描写' : '写作挑战'}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                {box.words.map(w => (
                  <span
                    key={w.id}
                    title={w.explanation || undefined}
                    className="px-3 py-1 bg-surface-bright border border-on-surface/40 font-headline text-base font-bold text-on-surface"
                  >
                    {w.text}
                  </span>
                ))}
              </div>

              <p className="font-body text-sm md:text-[15px] text-on-surface-variant leading-relaxed text-left line-clamp-3">
                {box.promptType === 'scene' ? box.promptData.description : box.promptData.text}
              </p>

              <div className="pt-0.5">
                <button
                  onClick={onStart}
                  className="px-5 py-2.5 bg-primary text-on-primary hover:bg-primary-dim transition-colors font-label text-sm inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span>以此开始写作 →</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
