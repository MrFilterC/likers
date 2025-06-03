'use client'

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--background)] py-6 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center gap-3 text-sm text-[var(--muted-foreground)]">
          <span>Powered by</span>
          <span className="font-medium text-[var(--foreground)]">
            Launchcoin creator rewards
          </span>
        </div>
      </div>
    </footer>
  )
} 