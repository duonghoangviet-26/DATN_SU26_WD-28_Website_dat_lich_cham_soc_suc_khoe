import { useState, useEffect } from 'react'
import Modal from '@/components/common/Modal'
import Icon from '@/components/admin/icons'

interface Setup2FAModalProps {
  onClose: () => void
  onSuccess: () => void
}

export default function Setup2FAModal({ onClose, onSuccess }: Setup2FAModalProps) {
  const [loading, setLoading] = useState(true)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    // Gọi API để lấy secret và QR
    fetch('/api/auth/2fa/setup', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setQrCodeUrl(data.data.qrCodeUrl)
          setSecret(data.data.secret)
        } else {
          setError(data.message || 'Lỗi tạo QR')
        }
      })
      .catch(() => setError('Lỗi kết nối máy chủ'))
      .finally(() => setLoading(false))
  }, [])

  const handleVerify = async () => {
    if (token.length !== 6) {
      setError('Mã phải gồm 6 chữ số')
      return
    }
    setVerifying(true)
    setError('')
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ token })
      })
      const data = await res.json()
      if (data.success) {
        onSuccess()
      } else {
        setError(data.message || 'Mã không chính xác')
      }
    } catch (err) {
      setError('Lỗi kết nối máy chủ')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <Modal isOpen={true} title="Cài đặt xác thực 2 bước (2FA)" onClose={onClose} size="md">
      <div className="p-6">
        {loading ? (
          <div className="flex justify-center p-8">
            <Icon name="spinner" className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : error && !qrCodeUrl ? (
          <div className="text-red-500 text-center p-4 bg-red-50 rounded-lg">
            {error}
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Sử dụng ứng dụng Google Authenticator
              </h3>
              <p className="text-sm text-gray-500 max-w-sm">
                Quét mã QR dưới đây bằng ứng dụng Google Authenticator hoặc Authy trên điện thoại của bạn.
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
            </div>

            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nhập mã 6 số từ ứng dụng
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-center text-xl tracking-[0.5em] font-mono"
                placeholder="000000"
              />
              {error && <p className="mt-2 text-sm text-red-600 text-center">{error}</p>}
            </div>

            <div className="flex w-full gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleVerify}
                disabled={verifying || token.length !== 6}
                className="flex-1 px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {verifying ? <Icon name="spinner" className="w-5 h-5 animate-spin" /> : 'Xác nhận'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
