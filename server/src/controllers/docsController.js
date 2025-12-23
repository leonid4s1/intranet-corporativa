// server/src/controllers/docsController.js (ESM)
const CATEGORIES = ['manuales', 'reglamentos', 'politicas']

// Por ahora: catalogo "mock" (luego Lo conectamos a Drive/DB)
const DOCS = [
    {
        id: 'm-ops-3-2',
        category: 'manuales',
        title: 'Manual de Procedimientos Operativos',
        version: '3.2',
        updatedAt: '2025-03-15',
        sizeMB: 2.4,
        status: 'Actualizado',
        viewUrl: null,
        downloadUrl: null,
    },
    {
    id: 'm-seg-2-1',
    category: 'manuales',
    title: 'Manual de Seguridad en Obra',
    version: '2.1',
    updatedAt: '2025-02-02',
    sizeMB: 3.8,
    status: null,
    viewUrl: null,
    downloadUrl: null,
  },
  {
    id: 'm-cal-1-5',
    category: 'manuales',
    title: 'Manual de Gestión de Calidad',
    version: '1.5',
    updatedAt: '2025-01-20',
    sizeMB: 5.2,
    status: null,
    viewUrl: null,
    downloadUrl: null,
  },
]

export const listDocs = async (req, res, next) => {
    try {
        const category = String(req.query.category || 'manuales').toLowerCase()

        if (!CATEGORIES.includes(category)) {
            return res.status(400).json({
                ok: false,
                message: `category inválida. Usa: ${CATEGORIES.join(', ')}`,
            })
        }

        const items = DOCS
            .filter((d) => d.category === category)
            .map((d) => ({
                ...d,
                // Si luego se usa Drive: aqui devolvemos viewUrl/downloadUrl reales
            }))
        return res.json({ ok: true, data: items })
    } catch (err) {
        next(err)
    }
}