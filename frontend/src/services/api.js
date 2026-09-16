import axios from "axios"

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const token = localStorage.getItem("token")
    const authorization = error.config?.headers?.Authorization
    if (error.response?.status === 401 && token &&
        authorization === `Bearer ${token}` && error.config?.url !== "/login") {
      localStorage.removeItem("token")
      localStorage.removeItem("usuario")
      window.dispatchEvent(new Event("sessao-expirada"))
    }
    return Promise.reject(error)
  }
)

export default api