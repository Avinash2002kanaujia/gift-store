const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// Get all products
router.get('/products', async (req, res) => {
    const data = await Product.find();
    res.json(data);
});

// Add a new product
router.post('/products', async (req, res) => {
    const p = new Product(req.body);
    await p.save();
    res.json(p);
});

router.delete('/products/:id', async (req, res) => {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted" });
});

module.exports = router;