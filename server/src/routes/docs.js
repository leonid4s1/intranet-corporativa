// server/src/routes/docs.js (ESM)
import { Router } from 'express'
import authenticate from '../middleware/auth.js'
import { listDocs } from '../controllers/docsController'

const router = Router()

// Todos los usuarios Logueados pueden ver documentacion
router.get('/', authenticate, listDocs)

export default router