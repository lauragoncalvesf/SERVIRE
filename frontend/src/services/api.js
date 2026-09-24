import axios from "axios"

const apiLocalUrl = new URL(window.location.origin)
apiLocalUrl.port = "3333"

const api = axios.create({
  baseURL: import.meta.env.DEV
    ? apiLocalUrl.origin
    : import.meta.env.VITE_API_URL || apiLocalUrl.origin
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
