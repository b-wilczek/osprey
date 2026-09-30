interface SpinnerProps {
  label?: string
  className?: string
}

export function Spinner({ label = 'Loading', className = '' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700 ${className}`}
    />
  )
}