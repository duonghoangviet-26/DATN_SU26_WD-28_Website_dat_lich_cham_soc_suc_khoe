// Bat class body.printing-ticket TRUOC khi in — @media print trong index.css chi
// an toan bo trang khi co class nay, de khong lam trang trong khi in cua cac luong
// khac (vd Payments.tsx) khong co #queue-ticket-print.
export function printTicket() {
  document.body.classList.add('printing-ticket')
  window.print()
  document.body.classList.remove('printing-ticket')
}
