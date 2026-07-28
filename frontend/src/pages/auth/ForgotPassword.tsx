import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Form, Input, Button, message } from 'antd'
import { authService } from '@/services/auth.service'

export default function ForgotPassword() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const onFinish = async (values: { email: string }) => {
    setLoading(true)
    try {
      await authService.forgotPassword(values.email)
      message.success('Liên kết đặt lại mật khẩu đã được gửi đến email của bạn!')
      setSuccess(true)
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Gửi yêu cầu thất bại'
      message.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-2xl border border-slate-100 shadow-sm text-left">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Quên mật khẩu</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Nhập địa chỉ email đã đăng ký của bạn để nhận liên kết khôi phục mật khẩu.
        </p>
      </div>

      {success ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-700">
            Hệ thống đã nhận được yêu cầu khôi phục mật khẩu. Vui lòng kiểm tra hộp thư đến (và thư rác) của bạn để nhấp vào đường liên kết hướng dẫn.
          </div>
          <div className="text-center pt-2">
            <Link to="/login" className="text-sm font-semibold text-brand-600 hover:text-brand-800">
              Quay lại đăng nhập
            </Link>
          </div>
        </div>
      ) : (
        <Form
          name="forgot_password"
          layout="vertical"
          onFinish={onFinish}
          requiredMark={false}
          className="space-y-4"
        >
          <Form.Item
            label={<span className="text-slate-700 font-semibold text-sm">Địa chỉ Email</span>}
            name="email"
            rules={[
              { required: true, message: 'Vui lòng nhập địa chỉ Email!' },
              { type: 'email', message: 'Email không đúng định dạng!' },
            ]}
          >
            <Input
              type="email"
              placeholder="example@gmail.com"
              className="rounded-lg h-11 border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              disabled={loading}
            />
          </Form.Item>

          <Form.Item className="mb-0">
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              className="w-full h-11 bg-brand-600 hover:bg-brand-700 border-none rounded-lg text-sm font-extrabold text-white shadow-md shadow-brand-100 transition-colors"
            >
              Gửi yêu cầu đặt lại mật khẩu
            </Button>
          </Form.Item>

          <div className="text-center pt-4 border-t border-slate-50 flex justify-between items-center text-xs">
            <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-800">
              Quay lại đăng nhập
            </Link>
            <Link to="/register" className="font-semibold text-slate-500 hover:text-slate-800">
              Đăng ký tài khoản
            </Link>
          </div>
        </Form>
      )}
    </div>
  )
}
