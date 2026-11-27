/**
 * 橡果 × 钢笔尖 版画印章图标（直边零圆角，契合报刊铅字版面）
 */
export default function AcornIcon({ size = 26, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      {/* 外框版画方印底 */}
      <rect width="32" height="32" fill="currentColor" />
      {/* 内层细白刻线框 */}
      <rect x="2" y="2" width="28" height="28" stroke="#FAF7F0" strokeWidth="1" strokeOpacity="0.55" />

      {/* 橡果果柄 */}
      <path
        d="M16 7.2C16 5.3 17.6 4.2 19.6 4.5"
        stroke="#FAF7F0"
        strokeWidth="1.7"
        strokeLinecap="square"
      />

      {/* 橡果帽斗（带版画斜格刻纹感） */}
      <path
        d="M7.5 12.8C7.5 9.2 11.1 7.2 16 7.2C20.9 7.2 24.5 9.2 24.5 12.8H7.5Z"
        fill="#FAF7F0"
      />
      {/* 帽斗网纹刻线 */}
      <path
        d="M11 7.8L9 12.8M15 7.2L12.8 12.8M19 7.5L16.8 12.8M22.2 8.8L20.6 12.8"
        stroke="currentColor"
        strokeWidth="1"
      />
      {/* 帽沿横梁 */}
      <rect x="6.5" y="12.2" width="19" height="1.8" fill="#FAF7F0" />

      {/* 橡果果仁（底部收尖化作钢笔尖开缝与呼吸孔） */}
      <path
        d="M9 15.2H23C23 21.1 19.9 25.1 16 27.8C12.1 25.1 9 21.1 9 15.2Z"
        fill="#FAF7F0"
      />
      {/* 笔尖中缝与墨孔（负空间刻痕） */}
      <line x1="16" y1="28" x2="16" y2="21.6" stroke="currentColor" strokeWidth="1.35" />
      <circle cx="16" cy="20.4" r="1.25" fill="currentColor" />
    </svg>
  );
}
