// server/src/services/uploadService.js
import multer from 'multer'
import fs from 'fs'
import path from 'path'

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/tmp/uploads' // seguro en Render

// garantiza el directorio
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now()
    const safe = file.originalname.replace(/[^\w.-]/g, '_')
    cb(null, `${ts}-${safe}`)
  },
})

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    // 🔍 Log para ver qué llega
    console.log('[uploadService] recibido archivo:', {
      fieldname: file.fieldname,
      mimetype: file.mimetype,
      originalname: file.originalname,
      size: file.size,
    })

    // ✅ Acepta cualquier image/*
    if (/^image\//i.test(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Tipo de archivo no permitido (se esperaba image/*)'))
    }
  },
})
