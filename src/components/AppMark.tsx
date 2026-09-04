import { APP_NAME } from '../lib/brand'

type Props = {
  size?: 'sm' | 'md'
  className?: string
}

/** Compact Guide mark for chrome — not the wordmark. */
export function AppMark({ size = 'sm', className = '' }: Props) {
  return (
    <img
      className={`app-mark app-mark-${size}${className ? ` ${className}` : ''}`}
      src="/favicon.svg?v=2"
      width={size === 'md' ? 36 : 28}
      height={size === 'md' ? 36 : 28}
      alt={APP_NAME}
      decoding="async"
    />
  )
}
