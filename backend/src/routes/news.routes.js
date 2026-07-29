import { Router } from 'express'
import * as news from '../controllers/news.controller.js'

const router = Router()

router.get('/', news.list)
router.get('/:slug', news.detail)

export default router
