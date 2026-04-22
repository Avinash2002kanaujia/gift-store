// api/products.js (Vercel serverless function)
const mongoose = require('mongoose');
const Product = require('../backend/models/Product');

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/giftstore";

async function dbConnect() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  }
}

module.exports = async (req, res) => {
  await dbConnect();
  if (req.method === 'GET') {
    try {
      const data = await Product.find().sort({ createdAt: -1 }).lean().exec();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch products.' });
    }
  }
  if (req.method === 'POST') {
    try {
      const p = new Product(req.body);
      await p.save();
      return res.status(201).json(p);
    } catch (err) {
      return res.status(400).json({ error: 'Unable to add product.' });
    }
  }
  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      await Product.findByIdAndDelete(id);
      return res.status(200).json({ message: 'Product deleted' });
    } catch (err) {
      return res.status(400).json({ error: 'Unable to delete product.' });
    }
  }
  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
};
