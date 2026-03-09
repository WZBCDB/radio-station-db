const express = require('express');
const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ storage: multer.memoryStorage() });

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB error:', err));

// ── SCHEMAS ──────────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema({
  email:       { type: String, required: true, unique: true, lowercase: true },
  password:    { type: String, required: true },
  stationName: { type: String, required: true },
  createdAt:   { type: Date, default: Date.now },
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcryptjs.genSalt(10);
  this.password = await bcryptjs.hash(this.password, salt);
  next();
});

const mediaSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mediaType: { type: String, enum: ['vinyl', '45', 'cd'], required: true },
  title:     { type: String, required: true },
  artist:    { type: String, required: true },
  label:     String,
  year:      Number,
  genres:    [String],
  location:  String,
  condition: { type: String, enum: ['mint','near-mint','excellent','good','fair','poor'] },
  notes:     String,
  photos: [{
    type:        { type: String, enum: ['cover','condition','tag'] },
    url:         String,
    description: String,
    uploadedAt:  { type: Date, default: Date.now },
  }],
  dateAdded: { type: Date, default: Date.now },
});

const User  = mongoose.model('User', userSchema);
const Media = mongoose.model('Media', mediaSchema);

// ── AUTH ──────────────────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, stationName } = req.body;
    if (!email || !password || !stationName)
      return res.status(400).json({ message: 'All fields required' });

    if (await User.findOne({ email: email.toLowerCase() }))
      return res.status(400).json({ message: 'Email already registered' });

    const user = new User({ email: email.toLowerCase(), password, stationName });
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ token, user: { id: user._id, email: user.email, stationName: user.stationName } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await bcryptjs.compare(password, user.password)))
      return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user._id, email: user.email, stationName: user.stationName } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Login failed' });
  }
});

// ── AUTH MIDDLEWARE ────────────────────────────────────────────────────────────

const auth = (req, res, next) => {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.userId = decoded.userId;
    next();
  });
};

// ── HELPERS ────────────────────────────────────────────────────────────────────

async function uploadToCloudinary(buffer, type, description) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'radio-db', resource_type: 'auto', quality: 'auto' },
      (err, result) => {
        if (err) reject(err);
        else resolve({ type, url: result.secure_url, description: description || '' });
      }
    );
    stream.end(buffer);
  });
}

// ── MEDIA ROUTES ───────────────────────────────────────────────────────────────

app.get('/api/media', auth, async (req, res) => {
  try {
    const media = await Media.find({ userId: req.userId }).sort({ dateAdded: -1 });
    res.json(media);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching media' });
  }
});

app.get('/api/media/:id', auth, async (req, res) => {
  try {
    const media = await Media.findOne({ _id: req.params.id, userId: req.userId });
    if (!media) return res.status(404).json({ message: 'Not found' });
    res.json(media);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching item' });
  }
});

app.post('/api/media', auth, upload.array('photos', 10), async (req, res) => {
  try {
    const { mediaType, title, artist, label, year, genres, location, condition, notes, photoTypes } = req.body;
    if (!mediaType || !title || !artist)
      return res.status(400).json({ message: 'mediaType, title, and artist are required' });

    const photos = [];
    if (req.files && req.files.length > 0) {
      const types = JSON.parse(photoTypes || '[]');
      for (let i = 0; i < req.files.length; i++) {
        try {
          const photo = await uploadToCloudinary(
            req.files[i].buffer,
            types[i] || 'cover',
            req.body[`photoDescription_${i}`]
          );
          photos.push(photo);
        } catch (e) { console.error('Photo upload error:', e.message); }
      }
    }

    const media = new Media({
      userId: req.userId, mediaType, title, artist,
      label: label || '', year: year ? parseInt(year) : null,
      genres: genres ? JSON.parse(genres) : [],
      location, condition, notes, photos,
    });
    await media.save();
    res.status(201).json(media);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error saving media' });
  }
});

app.put('/api/media/:id', auth, upload.array('photos', 10), async (req, res) => {
  try {
    const media = await Media.findOne({ _id: req.params.id, userId: req.userId });
    if (!media) return res.status(404).json({ message: 'Not found' });

    const { mediaType, title, artist, label, year, genres, location, condition, notes, photoTypes, removePhotos } = req.body;

    if (mediaType)             media.mediaType = mediaType;
    if (title)                 media.title = title;
    if (artist)                media.artist = artist;
    if (label !== undefined)   media.label = label;
    if (year)                  media.year = parseInt(year);
    if (genres)                media.genres = JSON.parse(genres);
    if (location !== undefined) media.location = location;
    if (condition)             media.condition = condition;
    if (notes !== undefined)   media.notes = notes;

    if (removePhotos) {
      const removeIds = JSON.parse(removePhotos);
      media.photos = media.photos.filter((_, idx) => !removeIds.includes(idx));
    }

    if (req.files && req.files.length > 0) {
      const types = JSON.parse(photoTypes || '[]');
      for (let i = 0; i < req.files.length; i++) {
        try {
          const photo = await uploadToCloudinary(
            req.files[i].buffer,
            types[i] || 'cover',
            req.body[`photoDescription_${i}`]
          );
          media.photos.push(photo);
        } catch (e) { console.error('Photo upload error:', e.message); }
      }
    }

    await media.save();
    res.json(media);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating media' });
  }
});

app.delete('/api/media/:id', auth, async (req, res) => {
  try {
    const media = await Media.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!media) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting media' });
  }
});

app.get('/api/stats', auth, async (req, res) => {
  try {
    const total   = await Media.countDocuments({ userId: req.userId });
    const byType  = await Media.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.userId) } },
      { $group: { _id: '$mediaType', count: { $sum: 1 } } },
    ]);
    res.json({ total, byType: Object.fromEntries(byType.map(b => [b._id, b.count])) });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching stats' });
  }
});

app.get('/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🎵 Server on port ${PORT}`));