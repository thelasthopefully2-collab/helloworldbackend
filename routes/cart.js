const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { validateSession } = require('../middleware/security');

// Get cart by session ID
router.get('/:sessionId', async (req, res) => {
  try {
    // Validate session format
    const sessionPattern = /^session_\d+_[a-z0-9]+$/;
    if (!sessionPattern.test(req.params.sessionId)) {
      return res.status(400).json({ message: 'Invalid session ID format' });
    }

    let cart = await Cart.findOne({ sessionId: req.params.sessionId })
      .populate('items.productId');
    
    if (!cart) {
      // Return empty cart if not found
      return res.json({ sessionId: req.params.sessionId, items: [], total: 0 });
    }

    // Filter out items where product no longer exists (was deleted)
    const validItems = cart.items.filter(item => item.productId != null);

    // Calculate total only for valid items
    const total = validItems.reduce((sum, item) => {
      return sum + (item.productId.price * item.quantity);
    }, 0);

    res.json({
      sessionId: cart.sessionId,
      items: validItems,
      total: total
    });
  } catch (error) {
    console.error('Error getting cart:', error);
    res.status(500).json({ message: error.message });
  }
});

// Add item to cart
router.post('/add', validateSession, async (req, res) => {
  const { sessionId, productId, quantity = 1 } = req.body;

  // Validate quantity
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    return res.status(400).json({ message: 'Invalid quantity (1-99 allowed)' });
  }

  try {
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    let cart = await Cart.findOne({ sessionId });

    if (!cart) {
      // Create new cart
      cart = new Cart({
        sessionId,
        items: [{ productId, quantity }]
      });
    } else {
      // Check if item already in cart
      const itemIndex = cart.items.findIndex(
        item => item.productId.toString() === productId
      );

      if (itemIndex > -1) {
        // Update quantity
        cart.items[itemIndex].quantity += quantity;
      } else {
        // Add new item
        cart.items.push({ productId, quantity });
      }
    }

    await cart.save();
    
    // Populate and return
    cart = await Cart.findOne({ sessionId }).populate('items.productId');
    
    // Filter out items where product no longer exists
    const validItems = cart.items.filter(item => item.productId != null);
    
    const total = validItems.reduce((sum, item) => {
      return sum + (item.productId.price * item.quantity);
    }, 0);

    res.json({
      sessionId: cart.sessionId,
      items: validItems,
      total: total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update item quantity
router.put('/update', validateSession, async (req, res) => {
  const { sessionId, productId, quantity } = req.body;

  // Validate quantity
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99) {
    return res.status(400).json({ message: 'Invalid quantity (0-99 allowed)' });
  }

  try {
    let cart = await Cart.findOne({ sessionId });

    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    const itemIndex = cart.items.findIndex(
      item => item.productId.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }

    if (quantity <= 0) {
      // Remove item if quantity is 0 or less
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = quantity;
    }

    await cart.save();
    
    cart = await Cart.findOne({ sessionId }).populate('items.productId');
    
    // Filter out items where product no longer exists
    const validItems = cart.items.filter(item => item.productId != null);
    
    const total = validItems.reduce((sum, item) => {
      return sum + (item.productId.price * item.quantity);
    }, 0);

    res.json({
      sessionId: cart.sessionId,
      items: validItems,
      total: total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Remove item from cart
router.delete('/remove', validateSession, async (req, res) => {
  const { sessionId, productId } = req.body;

  try {
    let cart = await Cart.findOne({ sessionId });

    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    cart.items = cart.items.filter(
      item => item.productId.toString() !== productId
    );

    await cart.save();
    
    cart = await Cart.findOne({ sessionId }).populate('items.productId');
    
    // Filter out items where product no longer exists
    const validItems = cart.items ? cart.items.filter(item => item.productId != null) : [];
    
    const total = validItems.reduce((sum, item) => {
      return sum + (item.productId.price * item.quantity);
    }, 0);

    res.json({
      sessionId: cart.sessionId,
      items: validItems,
      total: total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Clear cart
router.delete('/clear/:sessionId', async (req, res) => {
  try {
    await Cart.findOneAndDelete({ sessionId: req.params.sessionId });
    res.json({ message: 'Cart cleared' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
