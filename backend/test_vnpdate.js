function formatVnpDate(date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  let y = '', m = '', d = '', h = '', min = '', s = ''
  parts.forEach(part => {
    if (part.type === 'year') y = part.value
    if (part.type === 'month') m = part.value
    if (part.type === 'day') d = part.value
    if (part.type === 'hour') h = part.value
    if (part.type === 'minute') min = part.value
    if (part.type === 'second') s = part.value
  })
  if (h === '24') h = '00'
  return `${y}${m}${d}${h}${min}${s}`
}
console.log(formatVnpDate(new Date('2026-08-19T15:35:00.000Z')))
console.log(formatVnpDate(new Date('2026-08-19T17:00:00.000Z')))
