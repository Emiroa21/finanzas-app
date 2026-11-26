export type ThemeMode = 'auto' | 'light' | 'dark'

export function getTheme(): ThemeMode {
  try {
    const v = JSON.parse(localStorage.getItem('theme') ?? '"auto"')
    return v === 'light' || v === 'dark' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

/** Aplica el tema al documento y a la barra de estado de iOS. */
export function applyTheme(mode: ThemeMode = getTheme()) {
  const root = document.documentElement
  if (mode === 'auto') delete root.dataset.theme
  else root.dataset.theme = mode
  const dark = mode === 'dark' || (mode === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    if (mode === 'auto') m.setAttribute('content', m.getAttribute('media')?.includes('dark') ? '#000000' : '#f2f2f7')
    else m.setAttribute('content', dark ? '#000000' : '#f2f2f7')
  })
}
