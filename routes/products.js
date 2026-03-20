const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { adminAuth } = require('../middleware/security');

// Get all products (public)
router.get('/', async (req, res) => {
  try {
    const products = await Product.find().select('-__v');
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products' });
  }
});

// Get product by ID (public)
router.get('/:id', async (req, res) => {
  try {
    // Validate MongoDB ObjectId format
    if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) {
      return res.status(400).json({ message: 'Invalid product ID format' });
    }
    
    const product = await Product.findById(req.params.id).select('-__v');
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching product' });
  }
});

// Get products by category (public)
router.get('/category/:category', async (req, res) => {
  try {
    const products = await Product.find({ category: req.params.category }).select('-__v');
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products' });
  }
});

// Create a new product (admin only)
router.post('/', adminAuth, async (req, res) => {
  const product = new Product(req.body);
  try {
    const newProduct = await product.save();
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(400).json({ message: 'Error creating product' });
  }
});

// Update a product (admin only)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    // Validate MongoDB ObjectId format
    if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) {
      return res.status(400).json({ message: 'Invalid product ID format' });
    }
    
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(400).json({ message: 'Error updating product' });
  }
});

// Delete a product (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    // Validate MongoDB ObjectId format
    if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) {
      return res.status(400).json({ message: 'Invalid product ID format' });
    }
    
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting product' });
  }
});

module.exports = router;
