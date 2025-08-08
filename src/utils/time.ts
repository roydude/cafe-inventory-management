export function getCurrentTimeslot(date: Date = new Date()): string {
  const d = new Date(date)
  d.setMinutes(0, 0, 0)
  const startHour = d.getHours().toString().padStart(2, '0')
  const endHour = ((d.getHours() + 1) % 24).toString().padStart(2, '0')
  return `${startHour}:00-${endHour}:00`
}

export function formatDateYYYYMMDD(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = (date.getMonth() + 1).toString().padStart(2, '0')
  const d = date.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getDayStartEnd(date: Date = new Date()): { start: number; end: number } {
  const startDate = new Date(date)
  startDate.setHours(0, 0, 0, 0)
  const endDate = new Date(date)
  endDate.setHours(23, 59, 59, 999)
  return { start: startDate.getTime(), end: endDate.getTime() }
}


