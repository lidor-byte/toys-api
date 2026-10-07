require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, lowercase: true },
  password: String,
  role: { type: String, default: 'USER' }
}, { timestamps: { createdAt: 'date_created', updatedAt: 'date_updated' }, versionKey: false });
const toySchema = new mongoose.Schema({
  name: String, info: String, category: String, img_url: { type: String, default: '' }, price: Number,
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: { createdAt: 'date_created', updatedAt: 'date_updated' }, versionKey: false });
const User = mongoose.models.User || mongoose.model('User', userSchema);
const Toy = mongoose.models.Toy || mongoose.model('Toy', toySchema);
const toys = [
  ['Rocket Blocks', 'Magnetic building blocks for creative play.', 'building', 89], ['Ocean Puzzle', 'A 500-piece illustrated ocean puzzle.', 'puzzles', 65], ['Racing Car', 'Durable pull-back racing car.', 'vehicles', 42], ['Castle Set', 'Medieval castle with figures and accessories.', 'building', 119], ['Space Puzzle', 'Glow-in-the-dark 300-piece space puzzle.', 'puzzles', 55], ['Fire Engine', 'Die-cast fire engine with moving ladder.', 'vehicles', 74], ['Robot Kit', 'Buildable robot with simple gears.', 'building', 140], ['Animal Puzzle', 'Wooden animal puzzle for young children.', 'puzzles', 38], ['Rescue Helicopter', 'Toy helicopter with spinning rotor.', 'vehicles', 69], ['Bridge Blocks', 'Wooden blocks for bridges and towers.', 'building', 95], ['World Map Puzzle', 'Educational world map puzzle.', 'puzzles', 79], ['City Bus', 'Miniature city bus with opening doors.', 'vehicles', 48]
];

async function seed() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing.');
  await mongoose.connect(process.env.MONGODB_URI);
  await Toy.deleteMany({});
  let user = await User.findOne({ email: 'demo@toys.api' });
  if (!user) user = await User.create({ name: 'Demo User', email: 'demo@toys.api', password: await bcrypt.hash('DemoPass123!', 12) });
  await Toy.insertMany(toys.map(([name, info, category, price]) => ({ name, info, category, price, user_id: user._id })));
  console.log('Created 12 toys. Demo login: demo@toys.api / DemoPass123!');
  await mongoose.disconnect();
}
seed().catch(async (error) => { console.error(error); await mongoose.disconnect(); process.exitCode = 1; });
