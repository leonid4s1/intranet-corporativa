// server/src/services/uploadService.js
import multer from 'multer'
import fs from 'fs'
import path from 'path'

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || '/var/data/uploads')

console.log('📦 [uploadService] UPLOAD_DIR:', UPLOAD_DIR)

// garantiza el directorio
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true, mode: 0o755 })
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
    console.log('[uploadService] recibido archivo:', {
      fieldname: file.fieldname,
      mimetype: file.mimetype,
      originalname: file.originalname,
    })

    // ✅ Acepta cualquier image/*
    if (/^image\//i.test(file.mimetype)) return cb(null, true)

    return cb(new Error('Tipo de archivo no permitido (se esperaba image/*)'))
  },
})
