import fs from 'fs'
import path from 'path'
import 'dotenv/config'
import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI || ''
await mongoose.connect(MONGODB_URI)

const workSchema = new mongoose.Schema({
  title: String,
  description: String,
  images: [String],
  tags: [String],
  status: String,
  location: { lat: Number, lng: Number, address: String },
  createdAt: Date
})
const Work = mongoose.model('Work', workSchema)

const file = path.resolve('website/data/admin-all.json')
const raw = fs.readFileSync(file, 'utf-8')
const json = JSON.parse(raw)
const arr = json.data || json || []

for (const w of arr) {
  const doc = {
    title: w.title || '',
    description: w.description || '',
    images: Array.isArray(w.images) ? w.images : [],
    tags: Array.isArray(w.tags) ? w.tags : [],
    status: w.status || 'approved',
    location: {
      lat: w.location?.lat,
      lng: w.location?.lng,
      address: w.location?.address || ''
    },
    createdAt: w.createdAt ? new Date(w.createdAt) : new Date()
  }
  await Work.updateOne({ title: doc.title, 'location.lat': doc.location.lat, 'location.lng': doc.location.lng }, { $setOnInsert: doc }, { upsert: true })
}

console.log('done')
process.exit(0)

