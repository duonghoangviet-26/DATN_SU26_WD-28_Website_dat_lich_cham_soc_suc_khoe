// Bat class body.printing-invoice TRUOC khi in — @media print trong index.css chi
// an toan bo trang khi co class nay, de khong lam trang trong khi in cua cac luong
// khac (vd printTicket) khong co #invoice-print.
export function printInvoice() {
  document.body.classList.add('printing-invoice')
  window.print()
  document.body.classList.remove('printing-invoice')
}
