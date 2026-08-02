import { Router } from 'express'
import { sendMessage } from '../controllers/chatbot.controller.js'

const router = Router()

router.post('/message', sendMessage)

export default router
