import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { isSupabaseConfigured, supabase } from './lib/supabase.js';
import '../styles.css';

const defaultProducts = [
  {
    id: 'bordado-criadero',
    name: 'Bordado Criadero Montana',
    category: 'Bordado',
    price: null,
    image: 'images/bordado-criadero.jpg',
    description: 'Logo ecuestre bordado en una prenda.'
  },
  {
    id: 'parches-corporativos',
    name: 'Parches bordados corporativos',
    category: 'Parches',
    price: null,
    image: 'images/parches-corporativos.jpg',
    description: 'Diseños bordados personalizados para marcas y equipos.'
  },
  {
    id: 'bordado-floral',
    name: 'Bordado floral en prenda',
    category: 'Bordado',
    price: null,
    image: 'images/bordado-floral.jpg',
    description: 'Bordado floral de colores sobre una prenda azul.'
  },
  {
    id: 'bordado-blessed',
    name: 'Bordado Blessed',
    category: 'Bordado',
    price: null,
    image: 'images/bordado-blessed.jpg',
    description: 'Frase bordada en una sudadera.'
  },
  {
    id: 'bordado-uniforme',
    name: 'Bordado para uniforme',
    category: 'Uniformes',
    price: null,
    image: 'images/bordado-uniforme.jpg',
    description: 'Logos bordados para personalizar prendas de trabajo.'
  },
  {
    id: 'parche-circular',
    name: 'Parche bordado circular',
    category: 'Parches',
    price: null,
    image: 'images/parche-circular.jpg',
    description: 'Parche circular con diseño bordado personalizado.'
  },
  {
    id: 'remera-navidad-reno',
    name: 'Remera navideña con reno',
    category: 'Remeras',
    price: null,
    image: 'images/remera-navidad-reno.webp',
    description: 'Remera blanca con una ilustración festiva de reno y el texto “Merry Christmas”.'
  },
  {
    id: 'remera-navidad-arbol',
    name: 'Remera navideña con árbol',
    category: 'Remeras',
    price: null,
    image: 'images/remera-navidad-arbol.webp',
    description: 'Diseño navideño con árbol, regalos y muñeco de nieve, mostrado sobre una remera negra.'
  }
];

const defaultCategories = ['Bordado', 'Parches', 'Uniformes', 'Accesorios', 'Remeras'];

const defaultSiteInfo = {
  id: 1,
  business_name: 'Punto a Punto',
  contact_email: 'sanchezariasmabeldahiana@gmail.com',
  whatsapp_number: '573233120676'
};

const businessMapUrl = 'https://maps.app.goo.gl/KG6SmsbzNR47qs4s9';
const businessMapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent('EDS Terpel - Afas, San Vicente, Antioquia')}&output=embed`;

function getWhatsAppUrl(number, message) {
  const digits = number.replace(/\D/g, '');
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

function getSupabaseLoginErrorMessage(error) {
  if (/failed to fetch|load failed|networkerror/i.test(error?.message ?? '')) {
    return 'No se pudo conectar con Supabase. Verifica que VITE_SUPABASE_URL en .env.local coincida exactamente con el Project URL de tu proyecto activo y reinicia npm run dev.';
  }
  return `Supabase no pudo iniciar sesión: ${error.message}`;
}

async function readApiResponse(response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `La solicitud falló (${response.status}).`);
  return result;
}

function isCloudinaryImage(imageUrl) {
  try {
    return new URL(imageUrl).hostname === 'res.cloudinary.com';
  } catch {
    return false;
  }
}

function formatPrice(value) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(Number(value));
}

function formatProductPrice(value) {
  return value == null ? 'Consultar' : formatPrice(value);
}

function isValidProductImage(value) {
  if (/^(?!\/)[A-Za-z0-9._/-]+$/.test(value) && !value.split('/').includes('..')) return true;
  if (/^\/[A-Za-z0-9._/-]+$/.test(value) && !value.split('/').includes('..')) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function App() {
  const [products, setProducts] = useState(defaultProducts);
  const [orders, setOrders] = useState([]);
  const [categories, setCategories] = useState(defaultCategories);
  const [siteInfo, setSiteInfo] = useState(defaultSiteInfo);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [productSearch, setProductSearch] = useState('');
  const [cart, setCart] = useState({});
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [session, setSession] = useState(null);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [backendError, setBackendError] = useState('');
  const [orderWhatsAppUrl, setOrderWhatsAppUrl] = useState('');
  const [inspirationQuery, setInspirationQuery] = useState('parches bordados');
  const [inspirationPhotos, setInspirationPhotos] = useState([]);
  const [inspirationMessage, setInspirationMessage] = useState('');
  const [isSearchingInspiration, setIsSearchingInspiration] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const adminUserRef = useRef(null);

  useEffect(() => {
    if (adminOpen && !isAdmin) {
      adminUserRef.current?.focus();
    }
  }, [adminOpen, isAdmin]);

  useEffect(() => {
    document.title = `${siteInfo.business_name} | Bordados y parches personalizados`;
  }, [siteInfo.business_name]);

  useEffect(() => {
    if (!supabase) {
      setBackendError('El backend no está configurado. Copia .env.example a .env.local y agrega los datos de tu proyecto Supabase.');
      return undefined;
    }

    let active = true;
    const loadCatalog = async () => {
      const [productsResult, categoriesResult, settingsResult] = await Promise.all([
        supabase.from('products').select('*').order('created_at', { ascending: true }),
        supabase.from('categories').select('name').order('created_at', { ascending: true }),
        supabase.from('site_settings').select('*').eq('id', 1).maybeSingle()
      ]);

      if (!active) return;
      if (productsResult.error || categoriesResult.error) {
        setBackendError('No se pudo cargar el catálogo de Supabase. Verifica que hayas ejecutado supabase/schema.sql.');
        return;
      }
      if (settingsResult.error) {
        setBackendError(`No se pudieron cargar los datos del negocio: ${settingsResult.error.message}`);
        return;
      }

      setProducts(productsResult.data);
      setCategories(categoriesResult.data.map((category) => category.name));
      if (settingsResult.data) setSiteInfo(settingsResult.data);
      setBackendError('');
    };

    loadCatalog().catch((error) => {
      if (active) setBackendError(`Error al conectar con Supabase: ${error.message}`);
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setAdminMessage(`No se pudo verificar la sesión: ${error.message}`);
        return;
      }
      setSession(data.session);
    }).catch((error) => {
      if (active) setAdminMessage(`No se pudo verificar la sesión: ${error.message}`);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setIsAdmin(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session) {
      setIsAdmin(false);
      setOrders([]);
      return undefined;
    }

    let active = true;
    const verifyAdministrator = async () => {
      const { data, error } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!active) return;
      if (error) {
        setAdminMessage(`No se pudo verificar el permiso de administrador: ${error.message}`);
        return;
      }
      if (!data) {
        setAdminMessage('Esta cuenta no tiene permisos de administrador.');
        await supabase.auth.signOut();
        return;
      }

      setAdminMessage('');
      setIsAdmin(true);
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (!active) return;
      if (orderError) {
        setAdminMessage(`No se pudieron cargar los pedidos: ${orderError.message}`);
        return;
      }
      const ordersWithReferences = await Promise.all(orderData.map(async (order) => {
        if (!order.reference_image_path) return order;
        const { data: imageData, error: imageError } = await supabase.storage
          .from('order-references')
          .createSignedUrl(order.reference_image_path, 60 * 60);
        if (imageError) {
          throw new Error(`No se pudo abrir la imagen de referencia del pedido: ${imageError.message}`);
        }
        return { ...order, reference_image_url: imageData.signedUrl };
      }));
      if (!active) return;
      setOrders(ordersWithReferences);
    };

    verifyAdministrator().catch((error) => {
      if (active) setAdminMessage(`No se pudo verificar el permiso de administrador: ${error.message}`);
    });

    return () => {
      active = false;
    };
  }, [session]);

  async function submitOrder(event) {
    event.preventDefault();
    setFormMessage('');
    setOrderWhatsAppUrl('');
    const form = event.currentTarget;
    const formData = new FormData(form);
    const order = {
      name: formData.get('name').toString().trim(),
      phone: formData.get('phone').toString().trim(),
      service: cartItems.length ? 'Pedido de catálogo' : formData.get('service').toString(),
      details: formData.get('details').toString().trim()
    };
    const referenceImage = formData.get('referenceImage');
    const cartSummary = cartItems
      .map(({ product, quantity }) => `${product.name} x ${quantity} (${formatProductPrice(product.price)} c/u)`)
      .join('\n');
    if (cartSummary) order.details = `Productos del carrito:\n${cartSummary}\n\nDetalles adicionales: ${order.details}`;
    if (order.details.length > 2000) {
      setFormMessage('El pedido supera el límite de texto. Reduce las notas o la cantidad de productos.');
      return;
    }

    if (!supabase) {
      setFormMessage('El formulario no está conectado al backend. Por favor, contáctanos directamente por WhatsApp.');
      return;
    }

    if (referenceImage.size > 5 * 1024 * 1024) {
      setFormMessage('La imagen debe pesar 5 MB o menos.');
      return;
    }

    if (referenceImage.size > 0 && !['image/jpeg', 'image/png', 'image/webp'].includes(referenceImage.type)) {
      setFormMessage('Adjunta una imagen JPG, PNG o WebP.');
      return;
    }

    setIsSubmittingOrder(true);
    try {
      let referenceImagePath = null;
      if (referenceImage.size > 0) {
        const fileExtension = referenceImage.type === 'image/jpeg' ? 'jpg' : referenceImage.type.split('/')[1];
        referenceImagePath = `${crypto.randomUUID()}.${fileExtension}`;
        const { error: uploadError } = await supabase.storage
          .from('order-references')
          .upload(referenceImagePath, referenceImage, { contentType: referenceImage.type, upsert: false });
        if (uploadError) {
          setFormMessage(`No se pudo guardar la imagen de referencia: ${uploadError.message}`);
          return;
        }
      }

      const savedOrder = { ...order, reference_image_path: referenceImagePath };
      const { error } = await supabase.from('orders').insert(savedOrder);
      if (error) {
        setFormMessage(`No se pudo guardar el pedido: ${error.message}. Puedes contactarnos directamente por WhatsApp.`);
        return;
      }

      const message = `Hola ${siteInfo.business_name}, quiero hacer un pedido.\n\nNombre: ${order.name}\nWhatsApp: ${order.phone}\nServicio: ${order.service}\nDetalles: ${order.details}${referenceImagePath ? '\nAdjunté una imagen de referencia en el formulario del sitio.' : ''}`;
      const whatsappUrl = getWhatsAppUrl(siteInfo.whatsapp_number, message);
      setOrders([{ ...savedOrder, status: 'pending', created_at: new Date().toISOString() }, ...orders]);
      setOrderWhatsAppUrl(whatsappUrl);
      setFormMessage('Guardamos tu pedido. Ahora pulsa el botón para abrir WhatsApp y enviárnoslo.');
      setCart({});
      form.reset();
    } catch (error) {
      setFormMessage(`No se pudo enviar el pedido: ${error.message}. Puedes contactarnos directamente por WhatsApp.`);
    } finally {
      setIsSubmittingOrder(false);
    }
  }

  async function loginAdmin(event) {
    event.preventDefault();
    if (!supabase) {
      setAdminMessage('Configura Supabase para habilitar el acceso seguro al panel.');
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: adminUsername.trim(),
        password: adminPassword
      });
      if (error) {
        setAdminMessage(error.message === 'Invalid login credentials'
          ? 'Supabase rechazó el correo o la contraseña. Confirma que el usuario esté en Authentication → Users del mismo proyecto conectado a .env.local y restablece su contraseña si hace falta.'
          : getSupabaseLoginErrorMessage(error));
      }
    } catch (error) {
      setAdminMessage(getSupabaseLoginErrorMessage(error));
    }
  }

  async function uploadProductImage(file) {
    if (!session?.access_token) throw new Error('Inicia sesión nuevamente para subir imágenes.');
    const formData = new FormData();
    formData.append('image', file);
    const response = await fetch('/api/admin/images', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: formData
    });
    const result = await readApiResponse(response);
    return result.image;
  }

  async function deleteProductImage(imageUrl) {
    if (!isCloudinaryImage(imageUrl)) return;
    if (!session?.access_token) throw new Error('Inicia sesión nuevamente para administrar imágenes.');
    const response = await fetch('/api/admin/images/delete', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ image: imageUrl })
    });
    await readApiResponse(response);
  }

  async function searchInspiration(event) {
    event.preventDefault();
    const query = inspirationQuery.trim();
    setInspirationMessage('');
    setIsSearchingInspiration(true);
    try {
      const response = await fetch(`/api/inspiration?query=${encodeURIComponent(query)}`);
      const result = await readApiResponse(response);
      setInspirationPhotos(result.photos);
      setInspirationMessage(result.photos.length ? '' : 'No encontramos fotos de parches bordados para esa búsqueda. Prueba con otras palabras.');
    } catch (error) {
      setInspirationPhotos([]);
      setInspirationMessage(`No se pudo buscar inspiración: ${error.message}`);
    } finally {
      setIsSearchingInspiration(false);
    }
  }

  async function addProduct(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const newCategory = formData.get('newCategory').toString().trim();
    const category = newCategory || formData.get('category').toString();
    const imageFile = formData.get('imageFile');
    let image = formData.get('image').toString().trim();
    const newProduct = {
      id: crypto.randomUUID(),
      name: formData.get('name').toString().trim(),
      category,
      price: Number(formData.get('price')),
      image,
      description: formData.get('description').toString().trim()
    };

    if (!newProduct.name || newProduct.name.length > 120
      || !Number.isFinite(newProduct.price) || newProduct.price < 0
      || (imageFile.size === 0 && !isValidProductImage(image))
      || (imageFile.size > 0 && (!['image/jpeg', 'image/png', 'image/webp'].includes(imageFile.type)
        || imageFile.size > 5 * 1024 * 1024))
      || !newProduct.description || newProduct.description.length > 2000) {
      setAdminMessage('Revisa los datos: nombre y descripción obligatorios, precio no negativo e imagen JPG, PNG, WebP o URL HTTPS válida (máximo 5 MB).');
      return;
    }

    if (!supabase) {
      setAdminMessage('Configura Supabase para guardar productos.');
      return;
    }

    setIsSavingProduct(true);
    setAdminMessage(imageFile.size > 0 ? 'Subiendo imagen y guardando producto…' : '');
    let uploadedImage = '';
    try {
      if (imageFile.size > 0) {
        image = await uploadProductImage(imageFile);
        newProduct.image = image;
        uploadedImage = image;
      }

      if (newCategory && !categories.includes(newCategory)) {
        const { error: categoryError } = await supabase.from('categories').insert({ name: newCategory });
        if (categoryError) throw new Error(`No se pudo crear la categoría: ${categoryError.message}`);
        setCategories([...categories, newCategory]);
      }

      const { data, error } = await supabase.from('products').insert(newProduct).select().single();
      if (error) throw new Error(`No se pudo guardar el producto: ${error.message}`);
      setProducts([data, ...products]);
      form.reset();
      setAdminMessage('Se guardó el producto.');
    } catch (error) {
      let message = error.message;
      if (uploadedImage) {
        try {
          await deleteProductImage(uploadedImage);
        } catch (cleanupError) {
          message += ` Además, no se pudo retirar la imagen recién subida: ${cleanupError.message}`;
        }
      }
      setAdminMessage(message);
    } finally {
      setIsSavingProduct(false);
    }
  }

  async function updateProduct(productId, event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const newCategory = formData.get('newCategory').toString().trim();
    const imageFile = formData.get('imageFile');
    let image = formData.get('image').toString().trim();
    const updatedProduct = {
      name: formData.get('name').toString().trim(),
      category: newCategory || formData.get('category').toString(),
      price: formData.get('price').toString() === '' ? null : Number(formData.get('price')),
      image,
      description: formData.get('description').toString().trim()
    };

    if (!updatedProduct.name || updatedProduct.name.length > 120
      || (updatedProduct.price !== null && (!Number.isFinite(updatedProduct.price) || updatedProduct.price < 0))
      || (imageFile.size === 0 && !isValidProductImage(image))
      || (imageFile.size > 0 && (!['image/jpeg', 'image/png', 'image/webp'].includes(imageFile.type)
        || imageFile.size > 5 * 1024 * 1024))
      || !updatedProduct.description || updatedProduct.description.length > 2000) {
      setAdminMessage('Revisa los datos: nombre y descripción obligatorios, precio no negativo e imagen JPG, PNG, WebP o URL HTTPS válida (máximo 5 MB).');
      return;
    }

    if (!supabase) {
      setAdminMessage('Configura Supabase para actualizar productos.');
      return;
    }

    const currentProduct = products.find((product) => product.id === productId);
    setIsSavingProduct(true);
    setAdminMessage(imageFile.size > 0 ? 'Subiendo imagen y actualizando producto…' : '');
    let uploadedImage = '';
    try {
      if (imageFile.size > 0) {
        image = await uploadProductImage(imageFile);
        updatedProduct.image = image;
        uploadedImage = image;
      }

      if (newCategory && !categories.includes(newCategory)) {
        const { error: categoryError } = await supabase.from('categories').insert({ name: newCategory });
        if (categoryError) throw new Error(`No se pudo crear la categoría: ${categoryError.message}`);
        setCategories([...categories, newCategory]);
      }

      const { data, error } = await supabase
        .from('products')
        .update(updatedProduct)
        .eq('id', productId)
        .select()
        .single();
      if (error) throw new Error(`No se pudo actualizar el producto: ${error.message}`);

      setProducts(products.map((product) => product.id === productId ? data : product));
      setEditingProductId(null);
      if (uploadedImage && currentProduct?.image) {
        try {
          await deleteProductImage(currentProduct.image);
        } catch (cleanupError) {
          setAdminMessage(`Se actualizó el producto, pero no se pudo eliminar su imagen anterior de Cloudinary: ${cleanupError.message}`);
          return;
        }
      }
      setAdminMessage('Se actualizó el producto.');
    } catch (error) {
      let message = error.message;
      if (uploadedImage) {
        try {
          await deleteProductImage(uploadedImage);
        } catch (cleanupError) {
          message += ` Además, no se pudo retirar la imagen recién subida: ${cleanupError.message}`;
        }
      }
      setAdminMessage(message);
    } finally {
      setIsSavingProduct(false);
    }
  }

  async function updateSiteInfo(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const updatedInfo = {
      business_name: formData.get('businessName').toString().trim(),
      contact_email: formData.get('contactEmail').toString().trim(),
      whatsapp_number: formData.get('whatsappNumber').toString().trim()
    };

    if (!supabase) return;
    setAdminMessage('');
    const { data, error } = await supabase
      .from('site_settings')
      .update(updatedInfo)
      .eq('id', 1)
      .select()
      .single();
    if (error) {
      setAdminMessage(`No se pudo guardar la información del negocio: ${error.message}`);
      return;
    }

    setSiteInfo(data);
    setAdminMessage('Se guardaron los datos del negocio.');
  }

  async function deleteProduct(productId) {
    if (!supabase) return;
    const product = products.find((item) => item.id === productId);
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) {
      setAdminMessage(`No se pudo eliminar el producto: ${error.message}`);
      return;
    }
    setProducts(products.filter((product) => product.id !== productId));
    if (product?.image && isCloudinaryImage(product.image)) {
      try {
        await deleteProductImage(product.image);
      } catch (cleanupError) {
        setAdminMessage(`Se eliminó el producto, pero no se pudo eliminar su imagen de Cloudinary: ${cleanupError.message}`);
      }
    }
  }

  async function deleteCategory(categoryToDelete) {
    if (!supabase) return;
    const { error } = await supabase.rpc('delete_category', { p_category: categoryToDelete });
    if (error) {
      setAdminMessage(`No se pudo eliminar la categoría: ${error.message}`);
      return;
    }
    const hasProducts = products.some((product) => product.category === categoryToDelete);
    const remainingCategories = categories.filter((category) => category !== categoryToDelete);
    const replacementCategory = categoryToDelete === 'Sin categoría' && hasProducts
      ? 'Sin categoría (restaurada)'
      : 'Sin categoría';
    const needsReplacement = hasProducts && !remainingCategories.includes(replacementCategory);
    setCategories([
      ...remainingCategories,
      ...(needsReplacement || remainingCategories.length === 0 ? [replacementCategory] : [])
    ]);
    setProducts(products.map((product) => ({
      ...product,
      category: product.category === categoryToDelete ? replacementCategory : product.category
    })));
    if (selectedCategory === categoryToDelete) setSelectedCategory('all');
  }

  async function updateOrderStatus(orderId, status) {
    if (!supabase || !['pending', 'delivered'].includes(status)) return;
    setAdminMessage('');
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);
    if (error) {
      setAdminMessage(`No se pudo actualizar el estado del pedido: ${error.message}`);
      return;
    }
    setOrders((currentOrders) => currentOrders.map((order) => (
      order.id === orderId ? { ...order, status } : order
    )));
  }

  const normalizedSearch = productSearch.trim().toLocaleLowerCase('es');
  const filteredProducts = products.filter((product) => {
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesSearch = !normalizedSearch
      || product.name.toLocaleLowerCase('es').includes(normalizedSearch)
      || product.category.toLocaleLowerCase('es').includes(normalizedSearch);
    return matchesCategory && matchesSearch;
  });
  const cartItems = Object.entries(cart)
    .map(([productId, quantity]) => ({
      product: products.find((product) => product.id === productId),
      quantity
    }))
    .filter((item) => item.product);
  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cartItems.reduce((total, { product, quantity }) => (
    total + (product.price == null ? 0 : Number(product.price) * quantity)
  ), 0);
  const pendingOrderCount = orders.filter((order) => order.status === 'pending').length;
  const deliveredOrderCount = orders.filter((order) => order.status === 'delivered').length;

  function addToCart(product) {
    setCart((currentCart) => ({
      ...currentCart,
      [product.id]: (currentCart[product.id] ?? 0) + 1
    }));
  }

  function changeCartQuantity(productId, quantity) {
    setCart((currentCart) => {
      const nextCart = { ...currentCart };
      if (quantity <= 0) delete nextCart[productId];
      else nextCart[productId] = quantity;
      return nextCart;
    });
  }

  async function logoutAdmin() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAdminMessage(`No se pudo cerrar la sesión: ${error.message}`);
      return;
    }
    setIsAdmin(false);
    setAdminOpen(false);
  }

  return (
    <>
      <header className="topbar">
        <div className="container nav">
          <div className="brand">
            <span className="brand-mark">P</span>
            <div>
              <strong>{siteInfo.business_name}</strong>
              <small>Bordados a medida</small>
            </div>
          </div>
          <nav className="nav-links" aria-label="Navegación principal">
            <a href="#inicio">Inicio</a>
            <a href="#servicios">Servicios</a>
            <a href="#catalogo">Catálogo</a>
            <a href="#carrito">Carrito ({cartCount})</a>
            <a href="#galeria">Galería</a>
            <a href="#inspiracion">Inspiración</a>
            <a href="#ubicacion">Ubicación</a>
            <a href="#pedidos">Pedidos</a>
            <button
              className="admin-link"
              onClick={() => {
                setAdminOpen(true);
                setAdminUsername('');
                setAdminPassword('');
                setAdminMessage('');
              }}
              type="button"
            >
              Admin
            </button>
          </nav>
        </div>
      </header>

      <main>
        <section id="inicio" className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">Personalizados · Hechos a mano · Con estilo</p>
              <h1>Diseños únicos para prendas, accesorios y regalos.</h1>
              <p className="lead">
                En {siteInfo.business_name} diseñamos bordados y parches personalizados para
                marcas, eventos, equipos y momentos especiales.
              </p>
              <div className="cta-row">
                <a className="btn btn-primary" href="#catalogo">Ver catálogo</a>
                <a className="btn btn-secondary" href="#pedidos">Solicitar pedido</a>
              </div>
              <ul className="hero-badges" aria-label="Ventajas">
                <li>Diseños a medida</li>
                <li>Entrega rápida</li>
                <li>Calidad premium</li>
              </ul>
            </div>
            <div className="hero-visual" aria-label="Trabajos realizados en bordado">
              <div className="image-stack">
                <img src="images/maquina-bordado.jpg" alt="Máquina de bordar trabajando en diseños personalizados" />
                <div className="floating-card">
                  <span>Hecho a mano</span>
                  <small>Bordados y parches para prendas</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="servicios" className="section">
          <div className="container">
            <div className="section-heading">
              <p className="eyebrow">Nuestros servicios</p>
              <h2>Todo lo que necesitás para personalizar tu estilo</h2>
            </div>
            <div className="services-grid">
              <article className="service-card">
                <div className="icon">✂️</div>
                <h3>Bordado textil</h3>
                <p>Prendas, uniformes, remeras, mochilas, delantales y más.</p>
              </article>
              <article className="service-card">
                <div className="icon">🧵</div>
                <h3>Parches personalizados</h3>
                <p>Diseños exclusivos para logos, frases, nombres y motivos.</p>
              </article>
              <article className="service-card">
                <div className="icon">🎨</div>
                <h3>Diseño a medida</h3>
                <p>Te acompañamos en la creación del diseño ideal para tu idea.</p>
              </article>
              <article className="service-card">
                <div className="icon">📦</div>
                <h3>Pedidos por volumen</h3>
                <p>Ideal para emprendimientos, regalos empresariales y eventos.</p>
              </article>
            </div>
          </div>
        </section>

        <section id="catalogo" className="section alt-section">
          <div className="container">
            <div className="section-heading">
              <p className="eyebrow">Catálogo</p>
              <h2>Inspiración para tu próximo pedido</h2>
            </div>
            <div className="catalog-toolbar">
              <label className="catalog-search">
                Buscar productos
                <input
                  type="search"
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Nombre o categoría"
                  aria-label="Buscar productos por nombre o categoría"
                />
              </label>
              {['all', ...categories].map((category) => (
                <button
                  className={`filter-btn${selectedCategory === category ? ' is-active' : ''}`}
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  type="button"
                >
                  {category === 'all' ? 'Todos' : category}
                </button>
              ))}
            </div>
            {backendError && <p className="backend-notice" role="status">{backendError}</p>}
            <div id="catalogGrid" className="catalog-grid" aria-live="polite">
              {filteredProducts.map((product) => (
                <article className="product-card" key={product.id}>
                  <img src={product.image} alt={product.name} />
                  <div className="product-info">
                    <span className="product-badge">{product.category}</span>
                    <div className="product-top">
                      <h3>{product.name}</h3>
                      <span className="price-tag">{formatProductPrice(product.price)}</span>
                    </div>
                    <p>{product.description}</p>
                    <div className="product-actions">
                      {product.price == null && (
                        <a
                          className="btn btn-primary"
                          href={getWhatsAppUrl(
                            siteInfo.whatsapp_number,
                            `Hola ${siteInfo.business_name}, quisiera consultar el precio y la disponibilidad de ${product.name}.`
                          )}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Consultar por WhatsApp el precio de ${product.name}`}
                        >
                          Consultar por WhatsApp
                        </a>
                      )}
                      <button
                        className={`btn ${product.price == null ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={() => addToCart(product)}
                        type="button"
                      >
                        Agregar al carrito
                      </button>
                    </div>
                  </div>
                </article>
              ))}
              {filteredProducts.length === 0 && (
                <p className="empty-products">No encontramos productos con esa búsqueda.</p>
              )}
            </div>
            <section id="carrito" className="cart-section" aria-labelledby="cart-title">
              <div className="cart-heading">
                <div>
                  <p className="eyebrow">Tu selección</p>
                  <h3 id="cart-title">Carrito de compras ({cartCount})</h3>
                </div>
                <a className="btn btn-secondary" href="#pedidos">Continuar con el pedido</a>
              </div>
              {cartItems.length > 0 ? (
                <>
                  <div className="cart-list">
                    {cartItems.map(({ product, quantity }) => (
                      <article className="cart-item" key={product.id}>
                        <div>
                          <strong>{product.name}</strong>
                          <small>{formatProductPrice(product.price)} cada uno</small>
                        </div>
                        <div className="cart-controls" aria-label={`Cantidad de ${product.name}`}>
                          <button
                            type="button"
                            onClick={() => changeCartQuantity(product.id, quantity - 1)}
                            aria-label={`Quitar una unidad de ${product.name}`}
                          >−</button>
                          <span>{quantity}</span>
                          <button
                            type="button"
                            onClick={() => changeCartQuantity(product.id, quantity + 1)}
                            aria-label={`Agregar una unidad de ${product.name}`}
                          >+</button>
                          <button
                            className="cart-remove"
                            type="button"
                            onClick={() => changeCartQuantity(product.id, 0)}
                          >Eliminar</button>
                        </div>
                      </article>
                    ))}
                  </div>
                  <p className="cart-total">
                    Total de precios publicados: {formatPrice(cartTotal)}
                    <small>Los productos sin precio publicado se cotizan por WhatsApp.</small>
                  </p>
                </>
              ) : (
                <p className="empty-cart">Tu carrito está vacío. Agrega productos del catálogo para armar tu pedido.</p>
              )}
            </section>
          </div>
        </section>

        <section id="galeria" className="section">
          <div className="container">
            <div className="section-heading">
              <p className="eyebrow">Galería</p>
              <h2>Bordados y parches para prendas</h2>
              <p>¿Buscas un parche navideño para una prenda? Cuéntanos tu idea en el formulario y solicita un diseño personalizado.</p>
            </div>
            <div className="gallery-grid">
              <figure className="gallery-item">
                <img src="images/bordado-toalla.jpg" alt="Bordado personalizado en una toalla para un evento" />
              </figure>
              <figure className="gallery-item">
                <img src="images/bordado-dulceria.jpg" alt="Bordado de un logotipo de repostería sobre una sudadera" />
              </figure>
              <figure className="gallery-item">
                <video controls preload="metadata" aria-label="Video de un trabajo de bordado">
                  <source src="images/video-trabajo.mp4" type="video/mp4" />
                  Tu navegador no puede reproducir este video.
                </video>
              </figure>
            </div>
          </div>
        </section>

        <section id="inspiracion" className="section alt-section">
          <div className="container">
            <div className="section-heading">
              <p className="eyebrow">Ideas para tus diseños</p>
              <h2>Inspiración para bordados y parches</h2>
              <p>Busca fotografías de referencia de parches bordados en Pixabay para encontrar ideas para tu próximo diseño.</p>
            </div>
            <form className="inspiration-search" onSubmit={searchInspiration}>
              <label>
                Buscar ideas
                <input
                  type="search"
                  value={inspirationQuery}
                  onChange={(event) => setInspirationQuery(event.target.value)}
                  minLength="2"
                  maxLength="80"
                  placeholder="Ej.: parches bordados navideños"
                  required
                />
              </label>
              <button className="btn btn-primary" type="submit" disabled={isSearchingInspiration}>
                {isSearchingInspiration ? 'Buscando…' : 'Buscar en Pixabay'}
              </button>
            </form>
            {inspirationMessage && <p className="form-message" role="status">{inspirationMessage}</p>}
            {inspirationPhotos.length > 0 && (
              <>
                <div className="inspiration-grid">
                  {inspirationPhotos.map((photo) => (
                    <figure className="inspiration-card" key={photo.id}>
                      <a href={photo.photoUrl} target="_blank" rel="noreferrer">
                        <img src={photo.image} alt={photo.alt} loading="lazy" />
                      </a>
                      <figcaption>
                        Foto de {photo.photographer}
                        {' · '}
                        <a href={photo.photoUrl} target="_blank" rel="noreferrer">Ver en Pixabay</a>
                      </figcaption>
                    </figure>
                  ))}
                </div>
                <p className="photo-attribution">
                  Fotografías de <a href="https://pixabay.com/" target="_blank" rel="noreferrer">Pixabay</a>, mostradas como referencia.
                </p>
              </>
            )}
          </div>
        </section>

        <section className="section accent-section">
          <div className="container values-grid">
            <div>
              <p className="eyebrow">¿Por qué elegirnos?</p>
              <h2>Diseños pensados para durar y destacar</h2>
            </div>
            <div className="value-list">
              <div>
                <strong>01</strong>
                <p>Materiales de calidad y terminaciones cuidadosas.</p>
              </div>
              <div>
                <strong>02</strong>
                <p>Atención personalizada para cada pedido y presupuesto.</p>
              </div>
              <div>
                <strong>03</strong>
                <p>Ideas con un toque único para marcas, regalos y eventos.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="ubicacion" className="section">
          <div className="container location-layout">
            <div className="section-heading left">
              <p className="eyebrow">Encuéntranos</p>
              <h2>Visítanos en San Vicente</h2>
              <p>La ubicación que compartiste está en EDS Terpel - Afas, San Vicente, Antioquia. Abre el mapa para consultar cómo llegar.</p>
              <a className="btn btn-primary" href={businessMapUrl} target="_blank" rel="noreferrer">
                Abrir ubicación en Google Maps
              </a>
            </div>
            <div className="map-frame">
              <iframe
                src={businessMapEmbedUrl}
                title="Mapa de EDS Terpel - Afas, San Vicente, Antioquia"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </div>
        </section>

        <section id="pedidos" className="section">
          <div className="container form-layout">
            <div className="section-heading left">
              <p className="eyebrow">Solicitá tu pedido</p>
              <h2>Hacé tu consulta sin registrarte</h2>
              <p>
                Envianos tu pedido o una idea de bordado o parche personalizado. Puedes adjuntar
                una imagen de referencia y te contactamos por WhatsApp para confirmar detalles,
                precio, pago y entrega.
              </p>
            </div>
            <form className="order-form" onSubmit={submitOrder}>
              <label>
                Nombre
                <input type="text" name="name" placeholder="Tu nombre" maxLength="120" required />
              </label>
              <label>
                WhatsApp
                <input
                  type="tel"
                  name="phone"
                  placeholder="Ej: +54 9 11 1234 5678"
                  pattern="[+0-9() .-]{8,40}"
                  title="Escribe entre 8 y 40 caracteres usando números y signos telefónicos."
                  required
                />
              </label>
              <label>
                Tipo de trabajo
                <select name="service">
                  <option value="Bordado textil">Bordado textil</option>
                  <option value="Parche personalizado">Parche personalizado</option>
                  <option value="Parche bordado navideño para prenda">Parche bordado navideño para prenda</option>
                  <option value="Diseño personalizado">Diseño personalizado</option>
                  <option value="Uniformes / equipo">Uniformes / equipo</option>
                  <option value="Regalo / evento">Regalo / evento</option>
                </select>
              </label>
              <label>
                Detalles
                <textarea
                  name="details"
                  rows="5"
                  maxLength="2000"
                  placeholder="Contanos qué querés personalizar, colores, tamaño, cantidad y cualquier referencia que tengas."
                  required
                />
              </label>
              <label>
                Imagen de referencia (opcional, JPG, PNG o WebP; máximo 5 MB)
                <input type="file" name="referenceImage" accept="image/jpeg,image/png,image/webp" />
              </label>
              <button className="btn btn-primary" type="submit" disabled={isSubmittingOrder}>
                {isSubmittingOrder ? 'Enviando pedido…' : 'Enviar pedido por WhatsApp'}
              </button>
              {formMessage && <p className="form-message" role="status">{formMessage}</p>}
              {orderWhatsAppUrl && (
                <a className="btn btn-secondary" href={orderWhatsAppUrl} target="_blank" rel="noreferrer">
                  Abrir WhatsApp para enviar el pedido
                </a>
              )}
            </form>
          </div>
        </section>
      </main>

      <aside className={`admin-panel${adminOpen ? '' : ' hidden'}`} aria-live="polite">
        <div className="admin-header">
          <h3>Panel de administrador</h3>
          <button
            type="button"
            className="close-admin"
            onClick={() => setAdminOpen(false)}
            aria-label="Cerrar panel"
          >
            ×
          </button>
          {isAdmin && (
            <button type="button" className="delete-btn" onClick={logoutAdmin}>
              Cerrar sesión
            </button>
          )}
        </div>

        {!isAdmin ? (
          <form className="admin-login" onSubmit={loginAdmin}>
            <p>Ingresá tus credenciales para acceder.</p>
            {!isSupabaseConfigured && <p className="form-message" role="alert">{backendError}</p>}
            <label>
              Correo electrónico
              <input
                ref={adminUserRef}
                type="email"
                autoComplete="username"
                required
                value={adminUsername}
                onChange={(event) => setAdminUsername(event.target.value)}
                placeholder="Tu correo"
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                autoComplete="current-password"
                required
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                placeholder="contraseña"
              />
            </label>
            {adminMessage && <p className="form-message" role="alert">{adminMessage}</p>}
            <button className="btn btn-primary" type="submit">Entrar</button>
          </form>
        ) : (
          <div className="admin-dashboard">
            {adminMessage && <p className="form-message" role="alert">{adminMessage}</p>}
            <section className="admin-section">
              <h4>Información del negocio</h4>
              <form className="admin-form" onSubmit={updateSiteInfo}>
                <label>
                  Nombre del negocio
                  <input
                    type="text"
                    name="businessName"
                    defaultValue={siteInfo.business_name}
                    maxLength="120"
                    required
                  />
                </label>
                <label>
                  Correo de contacto
                  <input
                    type="email"
                    name="contactEmail"
                    defaultValue={siteInfo.contact_email}
                    maxLength="254"
                    required
                  />
                </label>
                <label>
                  WhatsApp (incluye código de país)
                  <input
                    type="tel"
                    name="whatsappNumber"
                    defaultValue={siteInfo.whatsapp_number}
                    minLength="8"
                    maxLength="20"
                    required
                  />
                </label>
                <button className="btn btn-primary" type="submit">Guardar información</button>
              </form>
            </section>

            <section className="admin-section">
              <h4>Agregar producto</h4>
              <form className="admin-form" onSubmit={addProduct}>
                <label>
                  Nombre
                  <input type="text" name="name" maxLength="120" required />
                </label>
                <label>
                  Categoría
                  <select name="category">
                    {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
                <label>
                  Nueva categoría
                  <input type="text" name="newCategory" placeholder="Opcional: crear categoría" />
                </label>
                <label>
                  Precio
                  <input type="number" name="price" min="0" step="0.01" required />
                </label>
                <label>
                  Subir imagen a Cloudinary (JPG, PNG o WebP; máximo 5 MB)
                  <input type="file" name="imageFile" accept="image/jpeg,image/png,image/webp" />
                </label>
                <label>
                  O usar una imagen existente
                  <input type="text" name="image" maxLength="2048" placeholder="https://... o /images/imagen.jpg" />
                </label>
                <label>
                  Descripción
                  <textarea name="description" rows="3" maxLength="2000" required />
                </label>
                <button className="btn btn-primary" type="submit" disabled={isSavingProduct}>
                  {isSavingProduct ? 'Guardando…' : 'Guardar producto'}
                </button>
              </form>
            </section>

            <section className="admin-section">
              <h4>Reportes</h4>
              <div className="report-grid" aria-live="polite">
                <article className="report-card">
                  <span>Productos registrados</span>
                  <strong>{products.length}</strong>
                </article>
                <article className="report-card">
                  <span>Pedidos recibidos</span>
                  <strong>{orders.length}</strong>
                </article>
                <article className="report-card">
                  <span>Solicitudes pendientes</span>
                  <strong>{pendingOrderCount}</strong>
                </article>
                <article className="report-card">
                  <span>Pedidos entregados</span>
                  <strong>{deliveredOrderCount}</strong>
                </article>
              </div>
            </section>

            <section className="admin-section">
              <h4>Categorías</h4>
              <div className="category-list">
                {categories.map((category) => (
                  <div className="category-item" key={category}>
                    <strong>{category}</strong>
                    <button className="delete-btn" onClick={() => deleteCategory(category)} type="button">
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="admin-section">
              <h4>Productos</h4>
              <div className="admin-product-list">
                {products.map((product) => (
                  <div className="admin-product-item" key={product.id}>
                    <div className="row">
                      <strong>{product.name}</strong>
                      <div className="row">
                        <button
                          className="delete-btn"
                          onClick={() => setEditingProductId(editingProductId === product.id ? null : product.id)}
                          type="button"
                        >
                          {editingProductId === product.id ? 'Cancelar' : 'Editar'}
                        </button>
                        <button className="delete-btn" onClick={() => deleteProduct(product.id)} type="button">
                          Eliminar
                        </button>
                      </div>
                    </div>
                    <div className="row">
                      <span>{product.category}</span>
                      <span>{formatProductPrice(product.price)}</span>
                    </div>
                    <small>{product.description}</small>
                    {editingProductId === product.id && (
                      <form className="admin-form product-edit-form" onSubmit={(event) => updateProduct(product.id, event)}>
                        <label>
                          Nombre
                          <input type="text" name="name" maxLength="120" defaultValue={product.name} required />
                        </label>
                        <label>
                          Categoría
                          <select name="category" defaultValue={product.category}>
                            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                          </select>
                        </label>
                        <label>
                          Nueva categoría
                          <input type="text" name="newCategory" placeholder="Opcional: crear categoría" />
                        </label>
                        <label>
                          Precio
                          <input type="number" name="price" min="0" step="0.01" defaultValue={product.price ?? ''} />
                        </label>
                        <label>
                          Imagen
                          <input type="text" name="image" maxLength="2048" defaultValue={product.image} />
                        </label>
                        <label>
                          Reemplazar imagen con Cloudinary (JPG, PNG o WebP; máximo 5 MB)
                          <input type="file" name="imageFile" accept="image/jpeg,image/png,image/webp" />
                        </label>
                        <label>
                          Descripción
                          <textarea name="description" rows="3" maxLength="2000" defaultValue={product.description} required />
                        </label>
                        <button className="btn btn-primary" type="submit" disabled={isSavingProduct}>
                          {isSavingProduct ? 'Guardando…' : 'Guardar cambios'}
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="admin-section">
              <h4>Pedidos recibidos</h4>
              <div className="order-list">
                {orders.length ? orders.map((order, index) => (
                  <div className="order-item" key={order.id ?? `${order.name}-${index}`}>
                    <div className="meta">
                      <strong>{order.name}</strong>
                      <span>{order.service}</span>
                    </div>
                    <div className="order-status-row">
                      <small>{new Date(order.created_at).toLocaleString('es')}</small>
                      <label>
                        Estado
                        <select
                          value={order.status ?? 'pending'}
                          onChange={(event) => updateOrderStatus(order.id, event.target.value)}
                          disabled={!order.id}
                          aria-label={`Estado del pedido de ${order.name}`}
                        >
                          <option value="pending">Pendiente</option>
                          <option value="delivered">Entregado</option>
                        </select>
                      </label>
                    </div>
                    <p>{order.details}</p>
                    <small>{order.phone}</small>
                    {order.reference_image_url && (
                      <a href={order.reference_image_url} target="_blank" rel="noreferrer">
                        Ver imagen de referencia
                      </a>
                    )}
                  </div>
                )) : <p>No hay pedidos recibidos todavía.</p>}
              </div>
            </section>
          </div>
        )}
      </aside>

      <a
        className="whatsapp-float"
        href={getWhatsAppUrl(siteInfo.whatsapp_number, `Hola ${siteInfo.business_name}, me gustaría hacer un pedido.`)}
        target="_blank"
        rel="noreferrer"
        aria-label="Chatear por WhatsApp"
      >
        WhatsApp
      </a>

      <footer className="site-footer">
        <div className="container footer-row">
          <p>© 2026 {siteInfo.business_name}</p>
          <a href={`mailto:${siteInfo.contact_email}`}>{siteInfo.contact_email}</a>
        </div>
      </footer>
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
