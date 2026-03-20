const mongoose = require('mongoose');
const Product = require('./models/Product');
require('dotenv').config();

const products = [
  {
    name: 'iPhone 17 Pro Max 256GB',
    brand: 'Apple',
    price: 675000,
    oldPrice: 5500000,
    discount: 12,
    image: 'assets/images/Iphone/product.jpg',
    images: [
      'assets/images/Iphone/product.jpg',
      'assets/images/Iphone/image2.webp',
      'assets/images/Iphone/image3.webp',
      'assets/images/Iphone/image4.webp'
    ],
    description: 'iPhone 17 Pro Max 256GB - Dynamic Island, cámara de 48MP, chip A19 Bionic',
    category: 'smartphones',
    vendor: 'MercadoPagoStock',
    stock: 50,
    specifications: {
      'Modelo': 'iPhone 17 Pro Max',
      'Capacidad': '256GB',
      'Color': 'Negro',
      'Pantalla': '6.3 pulgadas Super Retina XDR OLED',
      'Chip': 'A19 Bionic',
      'Cámara Principal': '48MP',
      'Cámara Frontal': '12MP TrueDepth',
      'Batería': 'Hasta 26 horas de reproducción de video',
      'Conectividad': '5G, Wi-Fi 7, Bluetooth 5.4',
      'Sistema Operativo': 'iOS 19'
    }
  },
  {
    name: 'Samsung TV 65" Crystal UHD 4K',
    brand: 'Samsung',
    price: 499000,
    oldPrice: 1299000,
    discount: 38,
    image: 'assets/images/SamsngTV/TV1.webp',
    images: [
      'assets/images/SamsngTV/TV1.webp',
      'assets/images/SamsngTV/TV2.webp',
      'assets/images/SamsngTV/TV3.webp',
      'assets/images/SamsngTV/TV4.webp'
    ],
    description: 'Smart TV Samsung 65 pulgadas Crystal UHD 4K con Tizen',
    category: 'tv',
    vendor: 'MercadoPagoStock',
    stock: 30,
    specifications: {
      'Modelo': 'UN65CU7000GCZB',
      'Tamaño de Pantalla': '65 pulgadas',
      'Resolución': '4K Ultra HD (3840 x 2160)',
      'Tecnología de Panel': 'Crystal UHD',
      'HDR': 'HDR10+',
      'Procesador': 'Crystal Processor 4K',
      'Sistema Operativo': 'Tizen Smart TV',
      'Conectividad': 'Wi-Fi, Bluetooth, 3x HDMI, 2x USB',
      'Audio': '20W, Dolby Digital Plus',
      'Dimensiones': '145.4 x 83.7 x 6.0 cm'
    }
  },
  {
    name: 'MacBook Air 13" M4',
    brand: 'Apple',
    price: 1099000,
    oldPrice: 4878999,
    discount: 27,
    image: 'assets/images/MacBook/Pic1.webp',
    images: [
      'assets/images/MacBook/Pic1.webp',
      'assets/images/MacBook/Pic2.webp',
      'assets/images/MacBook/Pic3.webp',
      'assets/images/MacBook/Pic4.webp'
    ],
    description: 'MacBook Air 13 pulgadas con chip M4, 8GB RAM, 256GB SSD',
    category: 'laptops',
    vendor: 'MercadoPagoStock',
    stock: 25,
    specifications: {
      'Modelo': 'MacBook Air M4 2024',
      'Chip': 'Apple M4 (CPU 10 núcleos, GPU 10 núcleos)',
      'Memoria RAM': '8GB Memoria Unificada',
      'Almacenamiento': '256GB SSD',
      'Pantalla': '13.6 pulgadas Liquid Retina (2560 x 1664)',
      'Batería': 'Hasta 18 horas de reproducción de video',
      'Cámara': '1080p FaceTime HD',
      'Audio': 'Sistema de 4 altavoces con Spatial Audio',
      'Conectividad': 'Wi-Fi 6E, Bluetooth 5.3, MagSafe 3, 2x Thunderbolt/USB 4',
      'Sistema Operativo': 'macOS Sonoma'
    }
  },
  {
    name: 'iPad Air 11" 128GB',
    brand: 'Apple',
    price: 799000,
    oldPrice: 2299999,
    discount: 20,
    image: 'assets/images/Tablet/Img1.webp',
    images: [
      'assets/images/Tablet/Img1.webp',
      'assets/images/Tablet/Img2.webp',
      'assets/images/Tablet/Img3.webp',
      'assets/images/Tablet/Img4.webp'
    ],
    description: 'iPad Air 11 pulgadas con chip M2, 128GB, compatible con Apple Pencil Pro',
    category: 'tablets',
    vendor: 'MercadoPagoStock',
    stock: 40,
    specifications: {
      'Modelo': 'iPad Air 11" (2024)',
      'Chip': 'Apple M2 (CPU 8 núcleos, GPU 10 núcleos)',
      'Capacidad': '128GB',
      'Pantalla': '11 pulgadas Liquid Retina (2360 x 1640)',
      'Cámara Trasera': '12MP gran angular',
      'Cámara Frontal': '12MP ultra gran angular con Center Stage',
      'Conectividad': 'Wi-Fi 6E, Bluetooth 5.3, USB-C',
      'Batería': 'Hasta 10 horas de navegación web',
      'Accesorios Compatibles': 'Apple Pencil Pro, Magic Keyboard',
      'Sistema Operativo': 'iPadOS 17'
    }
  }
];
// Ensure discount percentage matches oldPrice -> price relation
products.forEach(p => {
  if (p.oldPrice && p.price) {
    const computed = Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100);
    p.discount = isFinite(computed) ? computed : 0;
  } else {
    p.discount = p.discount || 0;
  }
});

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing products
    await Product.deleteMany({});
    console.log('Cleared existing products');

    // Insert new products
    const insertedProducts = await Product.insertMany(products);
    console.log(`Inserted ${insertedProducts.length} products`);

    // Log product IDs for reference
    insertedProducts.forEach(product => {
      console.log(`${product.name}: ${product._id}`);
    });

    await mongoose.connection.close();
    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
