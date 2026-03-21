import 'dotenv/config'
console.log('Starting server...')
import express from 'express'
import multer from 'multer'
import COS from 'cos-nodejs-sdk-v5'
import mongoose from 'mongoose'
import { nanoid } from 'nanoid'
import mime from 'mime-types'
import { promises as fs } from 'fs'
import path from 'path'

const app = express()
console.log('Express app created')
app.use(express.json())

// Serve static files from website directory
app.use(express.static(path.resolve(process.cwd(), '../website')))

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

// 本地内存存储（用于无MongoDB的本地开发）
let localWorks = []
let useDb = false
const WORKS_FILE = path.resolve(process.cwd(), '../website/data/works.json')

async function loadWorks() {
  try {
    const data = await fs.readFile(WORKS_FILE, 'utf-8')
    localWorks = JSON.parse(data)
    console.log(`Loaded ${localWorks.length} works from file`)
  } catch (e) {
    console.log('No local works file found, starting empty')
    localWorks = []
  }
}

async function saveWorks() {
  try {
    await fs.writeFile(WORKS_FILE, JSON.stringify(localWorks, null, 2))
  } catch (e) {
    console.error('Error saving works file:', e)
  }
}

// 尝试连接MongoDB，如果失败则使用内存存储
try {
  console.log('Checking MongoDB config...')
  if (MONGODB_URI) {
    console.log('Connecting to MongoDB...')
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
    console.log('已连接到MongoDB')
    useDb = true
  } else {
    console.log('未配置MongoDB，使用内存存储模式')
    await loadWorks()
  }
} catch (error) {
  console.log('MongoDB连接失败，使用内存存储模式:', error.message)
  await loadWorks()
}

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
  },
  pokedexId: String
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } })

const Work = mongoose.model('Work', workSchema)

const pokedexSchema = new mongoose.Schema({
  id: String, // unique id like "001", "001-1"
  name: String,
  type: String, // bird, geometric, flower, etc.
  category: String, // 原型, 结构, etc.
  description: String,
  icon: String, // url to image
  parentId: String, // parent id for tree structure
  sortOrder: Number
}, { timestamps: true })

const Pokedex = mongoose.model('Pokedex', pokedexSchema)

// Local storage for Pokedex
let localPokedex = []
const POKEDEX_FILE = path.resolve(process.cwd(), '../website/data/pokedex.json')

// Local storage for Pokedex Config
let localPokedexConfig = { types: [], categories: [] }
const POKEDEX_CONFIG_FILE = path.resolve(process.cwd(), '../website/data/pokedex-config.json')

async function loadPokedexConfig() {
  try {
    const data = await fs.readFile(POKEDEX_CONFIG_FILE, 'utf-8')
    localPokedexConfig = JSON.parse(data)
    console.log('Loaded pokedex config')
  } catch (e) {
    console.log('No local pokedex config found, using defaults')
    localPokedexConfig = {
       types: [
         { "key": "bird", "label": "🪽 鸟类纹系", "description": "线条如同飞翔的海鸥，也像波浪，是最具代表性的花格类型。" },
         { "key": "geometric", "label": "💠 几何纹系", "description": "由基础几何图形构成的严谨图案。" },
         { "key": "flower", "label": "🌷 花草纹系", "description": "以花瓣、枝叶与藤蔓为母题的柔和纹样。" },
         { "key": "other", "label": "❓ 其他纹系", "description": "尚未分类的未知纹样，待后续补充。" }
       ],
       categories: ["原型", "结构", "材质", "其他"]
    }
    await savePokedexConfig()
  }
}
loadPokedexConfig()

async function savePokedexConfig() {
  try {
    await fs.writeFile(POKEDEX_CONFIG_FILE, JSON.stringify(localPokedexConfig, null, 2))
  } catch (e) {
    console.error('Error saving pokedex config:', e)
  }
}

// Load initial pokedex data
async function loadPokedex() {
  try {
    const data = await fs.readFile(POKEDEX_FILE, 'utf-8')
    localPokedex = JSON.parse(data)
    console.log(`Loaded ${localPokedex.length} pokedex entries from file`)
  } catch (e) {
    console.log('No local pokedex file found or error reading it, starting empty')
    localPokedex = []
  }
}
loadPokedex()

async function savePokedex() {
  try {
    await fs.writeFile(POKEDEX_FILE, JSON.stringify(localPokedex, null, 2))
    console.log('Saved pokedex to file')
  } catch (e) {
    console.error('Error saving pokedex file:', e)
  }
}

const upload = multer({ storage: multer.memoryStorage() })

const COS_SECRET_ID = process.env.COS_SECRET_ID
const COS_SECRET_KEY = process.env.COS_SECRET_KEY
const COS_BUCKET = process.env.COS_BUCKET
const COS_REGION = process.env.COS_REGION
const UPLOAD_PREFIX = process.env.UPLOAD_PREFIX || 'uploads/'
const UPLOAD_BASE = process.env.UPLOAD_BASE || ''

// 只有在配置了COS密钥时才初始化COS客户端
const cos = (COS_SECRET_ID && COS_SECRET_KEY) ? new COS({
  SecretId: COS_SECRET_ID,
  SecretKey: COS_SECRET_KEY
}) : null

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
  try {
    if (useDb) {
      const items = await Work.find({ status: 'approved' }).sort({ createdAt: -1 })
      res.json({ success: true, data: items })
    } else {
      const items = localWorks.filter(work => work.status === 'approved')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      res.json({ success: true, data: items })
    }
  } catch (error) {
    console.error('获取作品失败:', error)
    res.status(500).json({ error: '获取作品失败' })
  }
})

app.get('/api/works/admin/all', requireAdmin, async (req, res) => {
  if (useDb) {
    const items = await Work.find({}).sort({ createdAt: -1 })
    res.json({ success: true, data: items })
  } else {
    const items = [...localWorks].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    res.json({ success: true, data: items })
  }
})

app.post('/api/works', upload.array('images'), async (req, res) => {
  try {
    const { title = '', description = '', userId = '', rarity = '普通', lat, lng, address = '', pokedexId = '' } = req.body
    const files = req.files || []
    const uploadedUrls = []

    // 本地开发模式：如果没有配置COS，使用本地存储路径
    if (!COS_BUCKET || !COS_SECRET_ID || !COS_SECRET_KEY) {
      const uploadsDir = path.resolve(process.cwd(), '../website/uploads')
      await fs.mkdir(uploadsDir, { recursive: true })
      for (const f of files) {
        const ext = mime.extension(f.mimetype) || 'jpg'
        const filename = `${nanoid()}.${ext}`
        const filePath = path.join(uploadsDir, filename)
        await fs.writeFile(filePath, f.buffer)
        const url = `/uploads/${filename}`
        uploadedUrls.push(url)
      }
    } else {
      // 生产模式：上传到COS
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
    }

    let doc
    if (useDb) {
      doc = await Work.create({
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
        },
        pokedexId
      })
    } else {
      doc = {
        _id: nanoid(),
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
        },
        pokedexId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      localWorks.push(doc)
      await saveWorks()
      console.log('新增作品到内存存储:', doc.title)
    }
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
    if (useDb) {
      const item = await Work.findByIdAndUpdate(req.params.id, { status }, { new: true })
      if (!item) return res.status(404).json({ error: 'not found' })
      res.json({ success: true, data: item })
    } else {
      const idx = localWorks.findIndex(w => w._id === req.params.id)
      if (idx === -1) return res.status(404).json({ error: 'not found' })
      localWorks[idx].status = status
      await saveWorks()
      res.json({ success: true, data: localWorks[idx] })
    }
  } catch (e) {
    res.status(400).json({ error: e.message || 'failed' })
  }
})

app.put('/api/works/:id', requireAdmin, async (req, res) => {
  try {
    const { title, description, rarity, address, lat, lng, city, pokedexId } = req.body
    const updateData = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (rarity !== undefined) updateData.rarity = rarity
    if (pokedexId !== undefined) updateData.pokedexId = pokedexId
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
    
    if (useDb) {
      const item = await Work.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true })
      if (!item) return res.status(404).json({ error: 'not found' })
      res.json({ success: true, data: item })
    } else {
      const idx = localWorks.findIndex(w => w._id === req.params.id)
      if (idx === -1) return res.status(404).json({ error: 'not found' })
      
      const work = localWorks[idx]
      // manually apply updates for flat fields
      if (updateData.title) work.title = updateData.title
      if (updateData.description) work.description = updateData.description
      if (updateData.rarity) work.rarity = updateData.rarity
      if (updateData.pokedexId !== undefined) work.pokedexId = updateData.pokedexId
      
      // manually apply nested location updates
      if (updateData['location.address']) work.location.address = updateData['location.address']
      if (updateData['location.city']) work.location.city = updateData['location.city']
      if (updateData['location.lat']) work.location.lat = updateData['location.lat']
      if (updateData['location.lng']) work.location.lng = updateData['location.lng']
      
      work.updatedAt = new Date()
      await saveWorks()
      res.json({ success: true, data: work })
    }
  } catch (e) {
    res.status(400).json({ error: e.message || 'failed' })
  }
})

app.delete('/api/works/:id', requireAdmin, async (req, res) => {
  if (useDb) {
    const item = await Work.findByIdAndDelete(req.params.id)
    if (!item) return res.status(404).json({ error: 'not found' })
    res.json({ success: true })
  } else {
    const idx = localWorks.findIndex(w => w._id === req.params.id)
    if (idx === -1) return res.status(404).json({ error: 'not found' })
    localWorks.splice(idx, 1)
    await saveWorks()
    res.json({ success: true })
  }
})

app.post('/api/tools/backfill-city', requireAdmin, async (req, res) => {
  try {
    let updated = 0
    let scanned = 0
    let cityCount = 0
    
    if (useDb) {
      const items = await Work.find({ $or: [ { 'location.city': { $exists: false } }, { 'location.city': '' }, { 'location.city': null } ] })
      scanned = items.length
      for (const item of items) {
        const addr = item.location?.address || ''
        const city = computeCity(addr)
        if (city) {
          await Work.updateOne({ _id: item._id }, { $set: { 'location.city': city } })
          updated++
        }
      }
      const distinctCities = await Work.distinct('location.city', { 'location.city': { $exists: true, $ne: '' } })
      cityCount = distinctCities.length
    } else {
      scanned = localWorks.length
      const cities = new Set()
      for (const w of localWorks) {
        if (!w.location.city) {
          const c = computeCity(w.location.address)
          if (c) {
            w.location.city = c
            updated++
          }
        }
        if (w.location.city) cities.add(w.location.city)
      }
      if (updated > 0) await saveWorks()
      cityCount = cities.size
    }
    res.json({ success: true, scanned, updated, cityCount })
  } catch (e) {
    res.status(500).json({ error: e.message || 'backfill failed' })
  }
})

// Pokedex APIs
app.get('/api/pokedex/config', async (req, res) => {
  res.json({ success: true, data: localPokedexConfig })
})

app.get('/api/pokedex/:id/works', async (req, res) => {
    try {
      const { id } = req.params
      const pokedexItem = localPokedex.find(p => p.id === id) || { name: '' }
      const name = pokedexItem.name
      const coreName = name ? name.replace(/基础|纹|的|简易|拼接/g, '') : ''

      if (useDb) {
        const items = await Work.find({
          $or: [
            { pokedexId: id },
            { pokedexId: { $regex: new RegExp(`^${id}-`) } }
          ],
          status: 'approved'
        }).sort({ createdAt: -1 })

        if (items.length === 0 && name) {
          const smartItems = await Work.find({
            pokedexId: { $in: [null, '', undefined] },
            status: 'approved',
            title: { $regex: coreName.length >= 1 ? coreName : name }
          }).sort({ createdAt: -1 })
          res.json({ success: true, data: smartItems })
        } else {
          res.json({ success: true, data: items })
        }
      } else {
        let items = localWorks.filter(w => {
          if (w.status !== 'approved') return false
          if (w.pokedexId === id) return true
          if (w.pokedexId && w.pokedexId.startsWith(`${id}-`)) return true
          return false
        }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

        if (items.length === 0 && name) {
          items = localWorks.filter(w => {
            if (w.status !== 'approved') return false
            if (w.pokedexId) return false // 已经绑定其他图鉴的不匹配
            if (w.title && w.title.includes(name)) return true
            if (coreName && coreName.length >= 1 && w.title && w.title.includes(coreName)) return true
            return false
          }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        }

        res.json({ success: true, data: items })
      }
    } catch (e) {
      console.error('Fetch pokedex works failed:', e)
      res.status(500).json({ error: 'fetch failed' })
    }
  })

app.put('/api/pokedex/config', requireAdmin, async (req, res) => {
  try {
    const { types, categories } = req.body
    if (types && Array.isArray(types)) localPokedexConfig.types = types
    if (categories && Array.isArray(categories)) localPokedexConfig.categories = categories
    await savePokedexConfig()
    res.json({ success: true, data: localPokedexConfig })
  } catch (e) {
    res.status(500).json({ error: 'save config failed' })
  }
})

app.get('/api/pokedex', async (req, res) => {
  try {
    if (useDb) {
      const items = await Pokedex.find({}).sort({ sortOrder: 1 })
      res.json({ success: true, data: items })
    } else {
      res.json({ success: true, data: localPokedex.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)) })
    }
  } catch (error) {
    console.error('获取图鉴失败:', error)
    res.status(500).json({ error: '获取图鉴失败' })
  }
})

app.post('/api/pokedex', requireAdmin, upload.single('icon'), async (req, res) => {
  try {
    const { id, name, type, category, description, parentId, sortOrder } = req.body
    let iconUrl = req.body.iconUrl || ''
    
    // Handle file upload if present
    if (req.file) {
      const f = req.file
      // Logic similar to existing upload
      if (!COS_BUCKET || !COS_SECRET_ID || !COS_SECRET_KEY) {
        const uploadsDir = path.resolve(process.cwd(), '../website/uploads')
        await fs.mkdir(uploadsDir, { recursive: true })
        const ext = mime.extension(f.mimetype) || 'png'
        const filename = `pokedex-${nanoid()}.${ext}`
        const filePath = path.join(uploadsDir, filename)
        await fs.writeFile(filePath, f.buffer)
        iconUrl = `/uploads/${filename}`
      } else {
         const ext = mime.extension(f.mimetype) || 'png'
         const key = `${UPLOAD_PREFIX}pokedex-${nanoid()}.${ext}`
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
         iconUrl = UPLOAD_BASE ? `${UPLOAD_BASE}/${key}` : key
      }
    }

    const newEntry = {
      id: id || nanoid(6),
      name,
      type,
      category,
      description,
      icon: iconUrl,
      parentId: parentId || null,
      sortOrder: Number(sortOrder) || 0
    }

    if (useDb) {
      const doc = await Pokedex.create(newEntry)
      // Sync to local file as backup
      localPokedex.push(newEntry)
      await savePokedex()
      res.json({ success: true, data: doc })
    } else {
      localPokedex.push(newEntry)
      await savePokedex()
      res.json({ success: true, data: newEntry })
    }
  } catch (e) {
    res.status(400).json({ error: e.message || 'create failed' })
  }
})

app.put('/api/pokedex/:id', requireAdmin, upload.single('icon'), async (req, res) => {
  try {
    const { id } = req.params
    const { name, type, category, description, parentId, sortOrder } = req.body
    let iconUrl = req.body.iconUrl

    // Handle file upload if present
    if (req.file) {
      const f = req.file
      if (!COS_BUCKET || !COS_SECRET_ID || !COS_SECRET_KEY) {
        const uploadsDir = path.resolve(process.cwd(), '../website/uploads')
        await fs.mkdir(uploadsDir, { recursive: true })
        const ext = mime.extension(f.mimetype) || 'png'
        const filename = `pokedex-${nanoid()}.${ext}`
        const filePath = path.join(uploadsDir, filename)
        await fs.writeFile(filePath, f.buffer)
        iconUrl = `/uploads/${filename}`
      } else {
         const ext = mime.extension(f.mimetype) || 'png'
         const key = `${UPLOAD_PREFIX}pokedex-${nanoid()}.${ext}`
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
         iconUrl = UPLOAD_BASE ? `${UPLOAD_BASE}/${key}` : key
      }
    }

    const updateData = {
      name, type, category, description, 
      parentId: parentId || null, 
      sortOrder: Number(sortOrder) || 0
    }
    if (iconUrl) updateData.icon = iconUrl

    if (useDb) {
      const item = await Pokedex.findOneAndUpdate({ id: id }, updateData, { new: true })
      if (!item) return res.status(404).json({ error: 'not found' })
      
      // Sync to local file as backup
      const idx = localPokedex.findIndex(p => p.id === id)
      if (idx !== -1) {
        localPokedex[idx] = { ...localPokedex[idx], ...updateData }
        if (iconUrl) localPokedex[idx].icon = iconUrl
      } else {
        localPokedex.push(item.toObject())
      }
      await savePokedex()
      
      res.json({ success: true, data: item })
    } else {
      const idx = localPokedex.findIndex(p => p.id === id)
      if (idx === -1) return res.status(404).json({ error: 'not found' })
      
      localPokedex[idx] = { ...localPokedex[idx], ...updateData }
      await savePokedex()
      res.json({ success: true, data: localPokedex[idx] })
    }
  } catch (e) {
    res.status(400).json({ error: e.message || 'update failed' })
  }
})

app.delete('/api/pokedex/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    if (useDb) {
      await Pokedex.findOneAndDelete({ id: id })
      
      // Sync to local file as backup
      const idx = localPokedex.findIndex(p => p.id === id)
      if (idx !== -1) {
        localPokedex.splice(idx, 1)
        await savePokedex()
      }
    } else {
      const idx = localPokedex.findIndex(p => p.id === id)
      if (idx !== -1) {
        localPokedex.splice(idx, 1)
        await savePokedex()
      }
    }
    res.json({ success: true })
  } catch (e) {
    res.status(400).json({ error: e.message || 'delete failed' })
  }
})

app.listen(PORT, () => {
  console.log(`server on :${PORT}`)
})
