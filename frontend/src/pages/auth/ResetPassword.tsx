import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Form, Input, Button, message } from 'antd'
import { authService } from '@/services/auth.service'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: { mat_khau_moi: string }) => {
    if (!token) {
      message.error('Mã token xác thực không tìm thấy hoặc đã hết hạn!')
      return
    }

    setLoading(true)
    try {
      await authService.resetPassword(token, values.mat_khau_moi)
      message.success('Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.')
      navigate('/login', { replace: true })
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Đặt lại mật khẩu thất bại'
      message.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="w-full max-w-md mx-auto p-6 bg-white rounded-2xl border border-slate-100 shadow-sm text-center">
        <h1 className="text-2xl font-bold text-slate-800">Liên kết không hợp lệ</h1>
        <p className="mt-2 text-sm text-red-500">
          Đường dẫn đặt lại mật khẩu của bạn bị thiếu hoặc không chính xác. Vui lòng kiểm tra kỹ hòm thư hoặc gửi lại yêu cầu quên mật khẩu.
        </p>
        <div className="mt-6 pt-4 border-t border-slate-50">
          <Link to="/forgot-password" className="text-sm font-semibold text-brand-600 hover:text-brand-800">
            Yêu cầu lại liên kết mới
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-2xl border border-slate-100 shadow-sm text-left">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Đặt lại mật khẩu</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Tạo mật khẩu mới cho tài khoản của bạn. Mật khẩu phải dài tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường và chữ số.
        </p>
      </div>

      <Form
        name="reset_password"
        layout="vertical"
        onFinish={onFinish}
        requiredMark={false}
        className="space-y-4"
      >
        <Form.Item
          label={<span className="text-slate-700 font-semibold text-sm">Mật khẩu mới</span>}
          name="mat_khau_moi"
          rules={[
            { required: true, message: 'Vui lòng nhập mật khẩu mới!' },
            { min: 8, message: 'Mật khẩu phải tối thiểu 8 ký tự!' },
            {
              pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
              message: 'Mật khẩu phải gồm chữ hoa, chữ thường và số!',
            },
          ]}
        >
          <Input.Password
            placeholder="Nhập mật khẩu mới"
            className="rounded-lg h-11 border-slate-200 focus:border-brand-500"
            disabled={loading}
          />
        </Form.Item>

        <Form.Item
          label={<span className="text-slate-700 font-semibold text-sm">Xác nhận mật khẩu</span>}
          name="xac_nhan_mat_khau"
          dependencies={['mat_khau_moi']}
          rules={[
            { required: true, message: 'Vui lòng nhập lại mật khẩu!' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('mat_khau_moi') === value) {
                  return Promise.resolve()
                }
                return Promise.reject(new Error('Mật khẩu nhập lại không trùng khớp!'))
              },
            }),
          ]}
        >
          <Input.Password
            placeholder="Nhập lại mật khẩu mới"
            className="rounded-lg h-11 border-slate-200 focus:border-brand-500"
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
            Đặt lại mật khẩu
          </Button>
        </Form.Item>

        <div className="text-center pt-4 border-t border-slate-50 flex justify-between items-center text-xs">
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-800">
            Quay lại đăng nhập
          </Link>
          <Link to="/forgot-password" className="font-semibold text-slate-500 hover:text-slate-800">
            Gửi lại yêu cầu khác
          </Link>
        </div>
      </Form>
    </div>
  )
}
