const base = { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export const HomeIcon = () => (
  <svg {...base}>
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </svg>
)
export const ListIcon = () => (
  <svg {...base}>
    <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </svg>
)
export const GaugeIcon = () => (
  <svg {...base}>
    <path d="M4 18a9 9 0 1 1 16 0" />
    <path d="m12 14 4-5" />
  </svg>
)
export const ChartIcon = () => (
  <svg {...base}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
)
export const WalletIcon = () => (
  <svg {...base}>
    <rect x="3" y="6" width="18" height="14" rx="2" />
    <path d="M16 13h2M3 10h18M6 6V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </svg>
)
export const PlusIcon = () => (
  <svg {...base} width={28} height={28} strokeWidth={2.4}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const EyeIcon = ({ off }: { off?: boolean }) => (
  <svg {...base} width={20} height={20}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M3 3l18 18" />}
  </svg>
)
