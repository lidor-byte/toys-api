require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const mongoose = require('mongoose');

let connectionPromise;
function connectDatabase() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing. Add it to your environment variables.');
  if (!connectionPromise) connectionPromise = mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  return connectionPromise;
}

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['USER', 'ADMIN'], default: 'USER' }
}, { timestamps: { createdAt: 'date_created', updatedAt: 'date_updated' }, versionKey: false });
const toySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80, index: true },
  info: { type: String, required: true, trim: true, minlength: 2, maxlength: 1000 },
  category: { type: String, required: true, trim: true, lowercase: true, index: true },
  img_url: { type: String, trim: true, default: '' },
  price: { type: Number, required: true, min: 0, index: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }
}, { timestamps: { createdAt: 'date_created', updatedAt: 'date_updated' }, versionKey: false });
toySchema.index({ name: 'text', info: 'text' });
const User = mongoose.models.User || mongoose.model('User', userSchema);
const Toy = mongoose.models.Toy || mongoose.model('Toy', toySchema);

const registerSchema = Joi.object({ name: Joi.string().trim().min(2).max(60).required(), email: Joi.string().email().required(), password: Joi.string().min(8).max(128).required() });
const loginSchema = Joi.object({ email: Joi.string().email().required(), password: Joi.string().required() });
const idSchema = Joi.object({ id: Joi.string().hex().length(24).required() });
const toyInputSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  info: Joi.string().trim().min(2).max(1000).required(),
  category: Joi.string().trim().min(2).max(50).required(),
  img_url: Joi.string().uri().allow('').default(''),
  price: Joi.number().min(0).required()
});
const toyUpdateSchema = toyInputSchema.fork(['name', 'info', 'category', 'price'], (field) => field.optional()).min(1);
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { value, error } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ error: 'Validation failed', details: error.details.map((item) => item.message) });
    req[source] = value;
    return next();
  };
}
function requireAuth(req, res, next) {
  const token = req.header('x-api-key');
  if (!token) return res.status(401).json({ error: 'Authentication required: send x-api-key header.' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); return next(); }
  catch { return res.status(401).json({ error: 'Invalid or expired token.' }); }
}
function paging(query) { return { skip: Math.max(Number.parseInt(query.skip, 10) || 0, 0), limit: 10 }; }
async function list(res, filter, query) {
  const { skip, limit } = paging(query);
  const [items, total] = await Promise.all([Toy.find(filter).sort({ date_created: -1 }).skip(skip).limit(limit), Toy.countDocuments(filter)]);
  return res.json({ items, pagination: { skip, limit, total } });
}
function publicUser(user) { return { id: user._id, name: user.name, email: user.email, role: user.role, date_created: user.date_created }; }
function owns(toy, user) { return toy.user_id.toString() === user.sub || user.role === 'ADMIN'; }

const app = express();
app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.get('/', (req, res) => res.json({ name: 'Toys API', status: 'ok' }));
app.use(async (req, res, next) => { try { await connectDatabase(); return next(); } catch (error) { return next(error); } });

app.post('/users', validate(registerSchema), async (req, res, next) => {
  try {
    const email = req.body.email.toLowerCase();
    if (await User.exists({ email })) return res.status(409).json({ error: 'An account with this email already exists.' });
    const user = await User.create({ ...req.body, email, password: await bcrypt.hash(req.body.password, 12) });
    return res.status(201).json({ user: publicUser(user) });
  } catch (error) { return next(error); }
});
app.post('/users/login', validate(loginSchema), async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email.toLowerCase() }).select('+password');
    if (!user || !(await bcrypt.compare(req.body.password, user.password))) return res.status(401).json({ error: 'Incorrect email or password.' });
    return res.json({ token: jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }), user: publicUser(user) });
  } catch (error) { return next(error); }
});
app.get('/toys', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.s) filter.$or = [{ name: { $regex: req.query.s, $options: 'i' } }, { info: { $regex: req.query.s, $options: 'i' } }];
    if (req.query.category) filter.category = req.query.category.toLowerCase();
    return await list(res, filter, req.query);
  } catch (error) { return next(error); }
});
app.get('/toys/search', async (req, res, next) => { try { return await list(res, { $or: [{ name: { $regex: req.query.s || '', $options: 'i' } }, { info: { $regex: req.query.s || '', $options: 'i' } }] }, req.query); } catch (error) { return next(error); } });
app.get('/toys/category/:catname', async (req, res, next) => { try { return await list(res, { category: req.params.catname.toLowerCase() }, req.query); } catch (error) { return next(error); } });
app.get('/toys/prices', async (req, res, next) => {
  try {
    const price = {};
    if (req.query.min !== undefined) price.$gte = Number(req.query.min);
    if (req.query.max !== undefined) price.$lte = Number(req.query.max);
    if (Object.values(price).some(Number.isNaN)) return res.status(400).json({ error: 'min and max must be numbers.' });
    return await list(res, Object.keys(price).length ? { price } : {}, req.query);
  } catch (error) { return next(error); }
});
app.get('/toys/count', async (req, res, next) => { try { return res.json({ count: await Toy.countDocuments() }); } catch (error) { return next(error); } });
app.get('/toys/single/:id', validate(idSchema, 'params'), async (req, res, next) => { try { const toy = await Toy.findById(req.params.id); return toy ? res.json(toy) : res.status(404).json({ error: 'Toy not found.' }); } catch (error) { return next(error); } });
app.post('/toys', requireAuth, validate(toyInputSchema), async (req, res, next) => { try { return res.status(201).json(await Toy.create({ ...req.body, user_id: req.user.sub })); } catch (error) { return next(error); } });
app.put('/toys/:id', requireAuth, validate(idSchema, 'params'), validate(toyUpdateSchema), async (req, res, next) => {
  try { const toy = await Toy.findById(req.params.id); if (!toy) return res.status(404).json({ error: 'Toy not found.' }); if (!owns(toy, req.user)) return res.status(403).json({ error: 'You can only edit your own toys.' }); Object.assign(toy, req.body); await toy.save(); return res.json(toy); } catch (error) { return next(error); }
});
app.delete('/toys/:id', requireAuth, validate(idSchema, 'params'), async (req, res, next) => {
  try { const toy = await Toy.findById(req.params.id); if (!toy) return res.status(404).json({ error: 'Toy not found.' }); if (!owns(toy, req.user)) return res.status(403).json({ error: 'You can only delete your own toys.' }); await toy.deleteOne(); return res.status(204).send(); } catch (error) { return next(error); }
});
app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
app.use((error, req, res, next) => { if (error.name === 'CastError') return res.status(400).json({ error: 'Invalid resource id.' }); console.error(error); return res.status(500).json({ error: 'Internal server error.' }); });

if (require.main === module) connectDatabase().then(() => app.listen(process.env.PORT || 3001));
module.exports = app;
