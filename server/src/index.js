import 'dotenv/config'
import express from 'express'
import multer from 'multer'
import COS from 'cos-nodejs-sdk-v5'
import mongoose from 'mongoose'
import { nanoid } from 'nanoid'
import mime from 'mime-types'

const app = express()
app.use(express.json())

const MONGODB_URI = process.env.MONGODB_URI || ''
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'huage_admin_2024'
const PORT = process.env.PORT || 3000

await mongoose.connect(MONGODB_URI)

const workSchema = new mongoose.Schema({
  title: String,
  description: String,
  images: [String],
  tags: [String],
  status: { type: String, default: 'pending' },
  location: {
    lat: Number,
    lng: Number,
    address: String
  }
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } })

const Work = mongoose.model('Work', workSchema)

const upload = multer({ storage: multer.memoryStorage() })

const cos = new COS({
  SecretId: process.env.COS_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY
})

const COS_BUCKET = process.env.COS_BUCKET
const COS_REGION = process.env.COS_REGION
const UPLOAD_PREFIX = process.env.UPLOAD_PREFIX || 'uploads/'
const UPLOAD_BASE = process.env.UPLOAD_BASE || ''

function requireAdmin(req, res, next) {
  const token = (req.headers['x-admin-token'] || '').toString()
  const cookie = (req.headers.cookie || '').toString()
  const hasCookie = cookie.includes(`admin_token=${ADMIN_TOKEN}`)
  if (token === ADMIN_TOKEN || hasCookie) return next()
  res.status(401).json({ error: 'Unauthorized' })
}

app.get('/api/works', async (req, res) => {
  const items = await Work.find({ status: 'approved' }).sort({ createdAt: -1 })
  res.json({ success: true, data: items })
})

app.get('/api/works/admin/all', requireAdmin, async (req, res) => {
  const items = await Work.find({}).sort({ createdAt: -1 })
  res.json({ success: true, data: items })
})

app.post('/api/works', upload.array('images'), async (req, res) => {
  try {
    const { title = '', description = '', lat, lng, address = '' } = req.body
    const files = req.files || []
    const uploadedUrls = []

    for (const f of files) {
      const ext = mime.extension(f.mimetype) || 'jpg'
      const key = `${UPLOAD_PREFIX}${nanoid()}.${ext}`
      await new Promise((resolve, reject) => {
        cos.putObject({
          Bucket: COS_BUCKET,
          Region: COS_REGION,
          Key: key,
          Body: f.buffer,
          ContentType: f.mimetype
        }, (err, data) => {
          if (err) reject(err)
          else resolve(data)
        })
      })
      const url = UPLOAD_BASE ? `${UPLOAD_BASE}/${key}` : key
      uploadedUrls.push(url)
    }

    const doc = await Work.create({
      title,
      description,
      images: uploadedUrls,
      tags: [],
      status: 'pending',
      location: {
        lat: lat ? Number(lat) : undefined,
        lng: lng ? Number(lng) : undefined,
        address
      }
    })
    res.json({ success: true, data: doc })
  } catch (e) {
    res.status(400).json({ error: e.message || 'upload failed' })
  }
})

app.patch('/api/works/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body
    const allowed = ['pending', 'approved', 'rejected']
    if (!allowed.includes(status)) return res.status(400).json({ error: 'bad status' })
    const item = await Work.findByIdAndUpdate(req.params.id, { status }, { new: true })
    if (!item) return res.status(404).json({ error: 'not found' })
    res.json({ success: true, data: item })
  } catch (e) {
    res.status(400).json({ error: e.message || 'failed' })
  }
})

app.delete('/api/works/:id', requireAdmin, async (req, res) => {
  const item = await Work.findByIdAndDelete(req.params.id)
  if (!item) return res.status(404).json({ error: 'not found' })
  res.json({ success: true })
})

app.listen(PORT, () => {
  console.log(`server on :${PORT}`)
})

