import axios from 'axios'

// Cấu hình axios dùng chung cho mọi lời gọi API.
// GIAI ĐOẠN HIỆN TẠI: chưa có backend, các service đang trả về mock data nên file này
// CHƯA được dùng. Nhưng đã cấu hình sẵn để sau này chỉ cần bật lên là chạy.

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
})

// Interceptor request: tự gắn token JWT vào mọi request (nếu đã đăng nhập)
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor response: nếu token hết hạn (401) thì đăng xuất và đưa về trang login
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default axiosInstance
