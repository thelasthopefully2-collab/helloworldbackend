const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  brand: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  oldPrice: {
    type: Number
  },
  discount: {
    type: Number,
    default: 0
  },
  image: {
    type: String,
    required: true
  },
  images: [{
    type: String
  }],
  description: {
    type: String
  },
  category: {
    type: String,
    required: true
  },
  vendor: {
    type: String,
    default: 'Frávega'
  },
  stock: {
    type: Number,
    default: 10
  },
  specifications: {
    type: Map,
    of: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Product', productSchema);
