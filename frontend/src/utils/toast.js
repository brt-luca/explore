/**
 * utils/toast.js
 * Mostra notifiche brevi in basso (non invasive).
 */

let toastTimer = null

export function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast')
  if (!toast) return

  clearTimeout(toastTimer)
  toast.textContent = message
  toast.classList.remove('hidden')

  toastTimer = setTimeout(() => {
    toast.classList.add('hidden')
  }, duration)
}
