import { Link } from 'react-router-dom'

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      className={`brand-mark ${compact ? 'brand-mark-compact' : ''}`}
      aria-label="JC Cogumelos"
    >
      <span className="brand-cap">
        <span className="brand-script">JC</span>
        <span className="brand-title">Cogumelos</span>
      </span>
    </Link>
  )
}
