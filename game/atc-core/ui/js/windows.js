// ATC Window Manager — z-index stack, focus management, ESC closes top panel
window.ATC = window.ATC || {}
ATC.Windows = (() => {
  const _stack = []
  const BASE_Z = 100

  function open(panelId) {
    const el = document.getElementById(panelId)
    if (!el) return
    // bring to front
    _stack.push(panelId)
    _stack.forEach((id, i) => {
      const e = document.getElementById(id)
      if (e) { e.style.zIndex = BASE_Z + i; e.classList.remove('hidden') }
    })
    el.style.zIndex = BASE_Z + _stack.length
    el.classList.remove('hidden')
    el.focus?.()
    document.dispatchEvent(new CustomEvent('atc:window:opened', { detail: { id: panelId } }))
  }

  function close(panelId) {
    const idx = _stack.lastIndexOf(panelId)
    if (idx !== -1) _stack.splice(idx, 1)
    const el = document.getElementById(panelId)
    if (el) el.classList.add('hidden')
    document.dispatchEvent(new CustomEvent('atc:window:closed', { detail: { id: panelId } }))
  }

  function closeTop() {
    if (!_stack.length) return
    close(_stack[_stack.length - 1])
  }

  function isOpen(panelId) { return !document.getElementById(panelId)?.classList.contains('hidden') }

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeTop() })

  return { open, close, closeTop, isOpen }
})()
