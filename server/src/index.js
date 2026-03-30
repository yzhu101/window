import 'dotenv/config'
import express from 'express'
import multer from 'multer'
import COS from 'cos-nodejs-sdk-v5'
import mongoose from 'mongoose'
import { nanoid } from 'nanoid'
import mime from 'mime-types'

const app = express()
app.use(express.json())

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token, Accept, Origin')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

const MONGODB_URI = process.env.MONGODB_URI || ''
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'huage_admin_2024'
const PORT = process.env.PORT || 3000

await mongoose.connect(MONGODB_URI)

const workSchema = new mongoose.Schema({
  title: String,
  description: String,
  userId: String,
  rarity: { type: String, default: '普通' },
  images: [String],
  tags: [String],
  status: { type: String, default: 'pending' },
  location: {
    lat: Number,
    lng: Number,
    address: String,
    city: String
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

function computeCity(address = '') {
  if (!address) return ''
  const s = address.replace(/.*?省/, '')
  const mCity = s.match(/([一-龥]{2,}市)/)
  if (mCity) return mCity[1]
  const municipalities = ['北京','上海','天津','重庆','香港','澳门','台湾']
  for (const name of municipalities) {
    if (s.includes(name)) return ['香港','澳门','台湾'].includes(name) ? name : name + '市'
  }
  const common = ['深圳','广州','苏州','杭州','南京','武汉','西安','成都','郑州','青岛','厦门','福州','长沙','合肥','宁波','无锡','佛山','大连','沈阳']
  for (const name of common) {
    if (s.includes(name)) return name + '市'
  }
  return ''
}
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
    const { title = '', description = '', userId = '', rarity = '普通', lat, lng, address = '' } = req.body
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
      userId,
      rarity,
      images: uploadedUrls,
      tags: [],
      status: 'pending',
      location: {
        lat: lat ? Number(lat) : undefined,
        lng: lng ? Number(lng) : undefined,
        address,
        city: computeCity(address)
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

app.put('/api/works/:id', requireAdmin, async (req, res) => {
  try {
    const { title, description, rarity, address, lat, lng, city } = req.body
    const updateData = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (rarity !== undefined) updateData.rarity = rarity
    if (address !== undefined) {
      updateData['location.address'] = address
      updateData['location.city'] = computeCity(address)
    }
    if (city !== undefined) {
      updateData['location.city'] = city
    }
    if (lat !== undefined) {
      const numLat = Number(lat)
      if (!Number.isNaN(numLat)) updateData['location.lat'] = numLat
    }
    if (lng !== undefined) {
      const numLng = Number(lng)
      if (!Number.isNaN(numLng)) updateData['location.lng'] = numLng
    }
    
    const item = await Work.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true })
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

app.post('/api/tools/backfill-city', requireAdmin, async (req, res) => {
  try {
    const items = await Work.find({ $or: [ { 'location.city': { $exists: false } }, { 'location.city': '' }, { 'location.city': null } ] })
    let updated = 0
    for (const item of items) {
      const addr = item.location?.address || ''
      const city = computeCity(addr)
      if (city) {
        await Work.updateOne({ _id: item._id }, { $set: { 'location.city': city } })
        updated++
      }
    }
    const distinctCities = await Work.distinct('location.city', { 'location.city': { $exists: true, $ne: '' } })
    res.json({ success: true, scanned: items.length, updated, cityCount: distinctCities.length })
  } catch (e) {
    res.status(500).json({ error: e.message || 'backfill failed' })
  }
})

app.listen(PORT, () => {
  console.log(`server on :${PORT}`)
})
