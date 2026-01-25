import {
  Thermometer,
  Droplet,
  Zap,
  Home,
  Cloud,
  Sun,
  Square,
  Trees,
  Shield,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react'

const iconMap: Record<string, LucideIcon> = {
  thermometer: Thermometer,
  droplet: Droplet,
  zap: Zap,
  home: Home,
  cloud: Cloud,
  sun: Sun,
  square: Square,
  tree: Trees,
  shield: Shield,
  'more-horizontal': MoreHorizontal,
}

export function CategoryIcon({ icon, className }: { icon: string | null | undefined; className?: string }) {
  if (!icon) return null
  const Icon = iconMap[icon]
  if (!Icon) return null
  return <Icon className={className} />
}
