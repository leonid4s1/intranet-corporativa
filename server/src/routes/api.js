const express = require('express')
const router = express.Router()
const User = require('../models/User')
const News = require('../models/News')
const Task = require('../models/Task')

// Obtener usuario
router.get('/user', async (req, res) => {
  const user = await User.findOne()
  res.json(user)
})

// Obtener noticias
router.get('/news', async (req, res) => {
  const news = await News.find()
  res.json(news)
})

// Obtener tareas
router.get('/tasks', async (req, res) => {
  const tasks = await Task.find()
  res.json(tasks)
})

// Endpoint para cargar datos de ejemplo
router.post('/seed', async (req, res) => {
  await User.deleteMany()
  await News.deleteMany()
  await Task.deleteMany()

  await User.create({
    name: 'Carlos',
    role: 'Arquitecto Senior',
    department: 'Diseño y Proyectos',
    avatar: '/ruta/a/avatar.jpg',
    unreadNotifications: 3
  })

  await News.insertMany([
    {
      title: 'Nueva política de vacaciones',
      excerpt: 'Actualización importante...',
      date: new Date('2023-11-15'),
      department: 'Recursos Humanos'
    },
    {
      title: 'Proyecto Centro Comercial - Avance',
      excerpt: 'La fase 2...',
      date: new Date('2023-11-10'),
      department: 'Gerencia de Proyectos'
    }
  ])

  await Task.insertMany([
    { title: 'Revisión de planos', status: 'completed' },
    { title: 'Presentación cliente', status: 'completed' },
    { title: 'Informe de avance', status: 'in-progress' },
    { title: 'Solicitud de materiales', status: 'pending' }
  ])

  res.send('Datos iniciales insertados')
})

module.exports = router
