import {
  login
} from "../controllers/authController.js"
import { limitarLogin } from "../middlewares/limitarLogin.js"

export default function authRoutes(app) {
  app.post("/login", limitarLogin, login)
}
