export const getPayments = async (req, res) => {
  try {
    res.status(200).json({ success: true, data: [] })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const confirmCashPayment = async (req, res) => {
  try {
    res.status(200).json({ success: true, message: 'Đã xác nhận thu tiền mặt' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const refundPayment = async (req, res) => {
  try {
    res.status(200).json({ success: true, message: 'Đã hoàn tiền' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export default {
  getPayments,
  confirmCashPayment,
  refundPayment
}
