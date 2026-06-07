// ============================================
// SUPABASE CONFIGURATION
// ============================================
const SUPABASE_URL = 'https://zdinsgeczlseswpbplhb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkaW5zZ2VjemxzZXN3cGJwbGhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjcwNjIsImV4cCI6MjA5NTMwMzA2Mn0.tf7rnyUT_Ax0OKfh9Mbtil0Dawiu26fvJsBLNP6Dq-E';

let supabase;
let currentUser = null;
let currentUserRole = null;

// Wait for Supabase to load
async function initSupabase() {
    try {
        // Wait for the library to be available
        let attempts = 0;
        while (!window.supabase && attempts < 50) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        if (!window.supabase) {
            showToast('Failed to load Supabase. Please refresh the page.', 'error');
            return false;
        }

        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase initialized');
        return true;
    } catch (error) {
        console.error('❌ Supabase init error:', error);
        showToast('Failed to initialize Supabase', 'error');
        return false;
    }
}

// ============================================
// UI HELPERS
// ============================================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    if (type === 'error') {
        toast.style.background = 'rgba(239, 68, 68, 0.95)';
    } else if (type === 'success') {
        toast.style.background = 'rgba(34, 197, 94, 0.95)';
    }
    
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showPage(pageName) {
    document.querySelectorAll('[id$="Page"]').forEach(page => {
        page.classList.add('hidden');
    });
    document.getElementById(pageName + 'Page')?.classList.remove('hidden');
}

function updateSellerOnlyElements() {
    const sellerElements = document.querySelectorAll('.seller-only');
    sellerElements.forEach(el => {
        if (currentUserRole === 'seller') {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });
}

// ============================================
// AUTHENTICATION
// ============================================
async function handleRegister() {
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value.trim();
    const fullName = document.getElementById('registerName').value.trim();
    const phone = document.getElementById('registerPhone').value.trim();
    const role = document.getElementById('registerRole').value;
    const storeName = document.getElementById('registerStoreName').value.trim();

    if (!email || !password || !fullName || !phone || !role) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }

    if (role === 'seller' && !storeName) {
        showToast('Store name is required for sellers', 'error');
        return;
    }

    try {
        document.getElementById('registerSubmitBtn').disabled = true;
        document.getElementById('registerSubmitBtn').innerHTML = '<span class="loader"></span> Registering...';

        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    phone: phone,
                    role: role,
                    store_name: storeName || null
                }
            }
        });

        if (authError) throw authError;

        // Create user profile based on role
        if (role === 'seller') {
            const { error: profileError } = await supabase.from('sellers').insert({
                id: authData.user.id,
                email,
                full_name: fullName,
                phone,
                store_name: storeName
            });
            if (profileError) throw profileError;
        } else {
            const { error: profileError } = await supabase.from('buyers').insert({
                id: authData.user.id,
                email,
                full_name: fullName,
                phone
            });
            if (profileError) throw profileError;
        }

        showToast('Registration successful! Please check your email to confirm.', 'success');
        closeAuthModal();
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
    } catch (error) {
        console.error('Register error:', error);
        showToast(error.message || 'Registration failed', 'error');
    } finally {
        document.getElementById('registerSubmitBtn').disabled = false;
        document.getElementById('registerSubmitBtn').innerHTML = 'Register';
    }
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!email || !password) {
        showToast('Please enter email and password', 'error');
        return;
    }

    try {
        document.getElementById('loginSubmitBtn').disabled = true;
        document.getElementById('loginSubmitBtn').innerHTML = '<span class="loader"></span> Logging in...';

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (authError) throw authError;

        // Check if seller or buyer
        let { data: seller } = await supabase.from('sellers').select('*').eq('id', authData.user.id).single();
        
        if (seller) {
            currentUser = seller;
            currentUserRole = 'seller';
        } else {
            let { data: buyer } = await supabase.from('buyers').select('*').eq('id', authData.user.id).single();
            if (buyer) {
                currentUser = buyer;
                currentUserRole = 'buyer';
            }
        }

        updateUI();
        closeAuthModal();
        showToast(`Welcome back, ${currentUser.full_name}!`, 'success');
        showPage('home');
    } catch (error) {
        console.error('Login error:', error);
        showToast(error.message || 'Login failed', 'error');
    } finally {
        document.getElementById('loginSubmitBtn').disabled = false;
        document.getElementById('loginSubmitBtn').innerHTML = 'Login';
    }
}

async function handleLogout() {
    try {
        await supabase.auth.signOut();
        currentUser = null;
        currentUserRole = null;
        updateUI();
        showPage('home');
        showToast('Logged out successfully', 'success');
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Logout failed', 'error');
    }
}

// ============================================
// UI UPDATES
// ============================================
function updateUI() {
    updateSellerOnlyElements();

    if (currentUser) {
        // Logged in
        document.getElementById('profileNotLoggedIn').classList.add('hidden');
        document.getElementById('profileLoggedIn').classList.remove('hidden');
        document.getElementById('profileName').textContent = currentUser.full_name;
        document.getElementById('profileEmail').textContent = currentUser.email;
        document.getElementById('profileRole').textContent = currentUserRole === 'seller' ? '🏪 Seller' : '🛍️ Buyer';

        if (currentUserRole === 'seller') {
            document.getElementById('sellerPanel').classList.remove('hidden');
            document.getElementById('buyerPanel').classList.add('hidden');
            loadSellerProducts();
        } else {
            document.getElementById('sellerPanel').classList.add('hidden');
            document.getElementById('buyerPanel').classList.remove('hidden');
        }

        // Live page
        document.getElementById('notLoggedInLive').classList.add('hidden');
        document.getElementById('liveStudio').classList.remove('hidden');
    } else {
        // Not logged in
        document.getElementById('profileNotLoggedIn').classList.remove('hidden');
        document.getElementById('profileLoggedIn').classList.add('hidden');
        document.getElementById('notLoggedInLive').classList.remove('hidden');
        document.getElementById('liveStudio').classList.add('hidden');
    }
}

// ============================================
// PRODUCTS
// ============================================
async function loadProducts() {
    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('*, sellers(store_name, email)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const grid = document.getElementById('productsGrid');
        
        if (!products || products.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center py-12 text-gray-500"><i class="fas fa-inbox text-4xl mb-3"></i><p>No products available yet</p></div>';
            return;
        }

        grid.innerHTML = products.map(product => `
            <div class="glass p-4 rounded-xl card-hover overflow-hidden">
                <div class="w-full h-40 bg-gray-200 rounded-lg overflow-hidden mb-3">
                    <img src="${product.image_url || 'https://via.placeholder.com/300x200?text=No+Image'}" 
                         alt="${product.name}" 
                         class="w-full h-full object-cover hover:scale-110 transition">
                </div>
                <h3 class="font-bold text-lg text-gray-800 truncate">${product.name}</h3>
                <p class="text-gray-600 text-sm line-clamp-2">${product.description || 'No description'}</p>
                <div class="flex justify-between items-center mt-3">
                    <span class="text-2xl font-bold text-purple-600">KES ${product.price}</span>
                    <button onclick="addToCart('${product.id}')" class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-full text-sm transition">
                        <i class="fas fa-cart-plus"></i>
                    </button>
                </div>
                <p class="text-xs text-gray-500 mt-2">🏪 ${product.sellers?.store_name || 'Unknown'}</p>
            </div>
        `).join('');
    } catch (error) {
        console.error('Load products error:', error);
        showToast('Failed to load products', 'error');
    }
}

async function loadSellerProducts() {
    if (!currentUser) return;

    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .eq('seller_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const container = document.getElementById('sellerProducts');
        
        if (!products || products.length === 0) {
            container.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500"><p>No products yet. Add your first product!</p></div>';
            return;
        }

        container.innerHTML = products.map(product => `
            <div class="glass p-4 rounded-xl">
                <div class="flex gap-4">
                    <img src="${product.image_url || 'https://via.placeholder.com/80'}" 
                         alt="${product.name}" 
                         class="w-20 h-20 rounded-lg object-cover">
                    <div class="flex-1">
                        <h4 class="font-bold text-gray-800">${product.name}</h4>
                        <p class="text-gray-600 text-sm">${product.description || 'No description'}</p>
                        <p class="text-purple-600 font-bold mt-1">KES ${product.price}</p>
                    </div>
                    <div class="flex flex-col gap-2">
                        <button onclick="deleteProduct('${product.id}')" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Load seller products error:', error);
        showToast('Failed to load your products', 'error');
    }
}

async function uploadProductImage(file) {
    if (!file) return null;

    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from('product-images')
            .getPublicUrl(fileName);

        return data.publicUrl;
    } catch (error) {
        console.error('Image upload error:', error);
        showToast('Failed to upload image', 'error');
        return null;
    }
}

async function handleAddProduct() {
    const name = document.getElementById('productName').value.trim();
    const description = document.getElementById('productDescription').value.trim();
    const price = parseInt(document.getElementById('productPrice').value);
    const imageFile = document.getElementById('productImage').files[0];

    if (!name || !description || !price || price < 1) {
        showToast('Please fill in all fields correctly', 'error');
        return;
    }

    try {
        document.getElementById('submitProductBtn').disabled = true;
        document.getElementById('submitProductBtn').innerHTML = '<span class="loader"></span> Adding...';

        let imageUrl = null;
        if (imageFile) {
            imageUrl = await uploadProductImage(imageFile);
        }

        const { error } = await supabase.from('products').insert({
            seller_id: currentUser.id,
            name,
            description,
            price,
            image_url: imageUrl
        });

        if (error) throw error;

        showToast('Product added successfully!', 'success');
        closeProductModal();
        loadSellerProducts();
        loadProducts();
    } catch (error) {
        console.error('Add product error:', error);
        showToast('Failed to add product', 'error');
    } finally {
        document.getElementById('submitProductBtn').disabled = false;
        document.getElementById('submitProductBtn').innerHTML = 'Create';
    }
}

async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', productId);

        if (error) throw error;

        showToast('Product deleted successfully', 'success');
        loadSellerProducts();
        loadProducts();
    } catch (error) {
        console.error('Delete product error:', error);
        showToast('Failed to delete product', 'error');
    }
}

// ============================================
// MODAL MANAGEMENT
// ============================================
function openAuthModal() {
    document.getElementById('authModal').classList.remove('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('registerForm').classList.add('hidden');
}

function closeAuthModal() {
    document.getElementById('authModal').classList.add('hidden');
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('registerEmail').value = '';
    document.getElementById('registerPassword').value = '';
    document.getElementById('registerName').value = '';
    document.getElementById('registerPhone').value = '';
    document.getElementById('registerRole').value = '';
    document.getElementById('registerStoreName').value = '';
}

function openProductModal() {
    if (!currentUser || currentUserRole !== 'seller') {
        showToast('Only sellers can add products', 'error');
        return;
    }
    document.getElementById('addProductModal').classList.remove('hidden');
}

function closeProductModal() {
    document.getElementById('addProductModal').classList.add('hidden');
    document.getElementById('productName').value = '';
    document.getElementById('productDescription').value = '';
    document.getElementById('productPrice').value = '';
    document.getElementById('productImage').value = '';
}

// ============================================
// LIVE VIDEO
// ============================================
let liveStream = null;
let currentCamera = 'user';

async function startLive() {
    if (!currentUser || currentUserRole !== 'seller') {
        showToast('Only sellers can broadcast', 'error');
        return;
    }

    try {
        document.getElementById('startLiveBroadcastBtn').disabled = true;
        
        liveStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentCamera },
            audio: true
        });

        const video = document.getElementById('liveVideo');
        video.srcObject = liveStream;

        document.getElementById('startLiveBroadcastBtn').classList.add('hidden');
        document.getElementById('stopLiveBroadcastBtn').classList.remove('hidden');
        document.getElementById('broadcastStatusText').innerHTML = '🔴 LIVE NOW';
        document.getElementById('broadcastStatusText').parentElement.style.background = 'rgb(220, 38, 38)';

        showToast('You are now broadcasting!', 'success');
    } catch (error) {
        console.error('Live start error:', error);
        showToast(error.message || 'Failed to start broadcast', 'error');
        document.getElementById('startLiveBroadcastBtn').disabled = false;
    }
}

async function stopLive() {
    if (liveStream) {
        liveStream.getTracks().forEach(track => track.stop());
        liveStream = null;
    }

    document.getElementById('liveVideo').srcObject = null;
    document.getElementById('startLiveBroadcastBtn').classList.remove('hidden');
    document.getElementById('stopLiveBroadcastBtn').classList.add('hidden');
    document.getElementById('broadcastStatusText').innerHTML = '⚫ Offline';
    document.getElementById('broadcastStatusText').parentElement.style.background = 'rgb(31, 41, 55)';

    showToast('Broadcast ended', 'success');
}

async function switchCamera() {
    currentCamera = currentCamera === 'user' ? 'environment' : 'user';
    
    if (liveStream) {
        await stopLive();
        await startLive();
    }
    
    showToast(`Switched to ${currentCamera === 'environment' ? 'back' : 'front'} camera`, 'success');
}

// ============================================
// EVENT LISTENERS
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Supabase
    const supabaseReady = await initSupabase();
    if (!supabaseReady) {
        showToast('Failed to load. Please refresh the page.', 'error');
        return;
    }

    // Navigation
    document.getElementById('navMarket').addEventListener('click', () => {
        showPage('market');
        loadProducts();
    });
    document.getElementById('navSell').addEventListener('click', () => showPage('live'));
    document.getElementById('navProfile').addEventListener('click', () => showPage('profile'));

    // Home page
    document.getElementById('exploreBtn').addEventListener('click', () => {
        showPage('market');
        loadProducts();
    });
    document.getElementById('startLiveBtn').addEventListener('click', () => showPage('live'));

    // Auth
    document.getElementById('loginBtn').addEventListener('click', openAuthModal);
    document.getElementById('registerBtn').addEventListener('click', () => {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('registerForm').classList.remove('hidden');
        document.getElementById('authTitle').textContent = 'Register';
    });
    document.getElementById('switchToRegister').addEventListener('click', () => {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('registerForm').classList.remove('hidden');
        document.getElementById('authTitle').textContent = 'Register';
    });
    document.getElementById('switchToLogin').addEventListener('click', () => {
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('registerForm').classList.add('hidden');
        document.getElementById('authTitle').textContent = 'Login';
    });
    document.getElementById('loginSubmitBtn').addEventListener('click', handleLogin);
    document.getElementById('registerSubmitBtn').addEventListener('click', handleRegister);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('closeAuthModal').addEventListener('click', closeAuthModal);
    document.getElementById('loginFromLive').addEventListener('click', openAuthModal);

    // Store name toggle for role selection
    document.getElementById('registerRole').addEventListener('change', (e) => {
        const storeNameField = document.getElementById('registerStoreName');
        if (e.target.value === 'seller') {
            storeNameField.classList.remove('hidden');
        } else {
            storeNameField.classList.add('hidden');
        }
    });

    // Products
    document.getElementById('searchInput').addEventListener('input', () => {
        loadProducts();
    });
    document.getElementById('addProductBtn').addEventListener('click', openProductModal);
    document.getElementById('submitProductBtn').addEventListener('click', handleAddProduct);
    document.getElementById('closeProductModal').addEventListener('click', closeProductModal);

    // Live
    document.getElementById('startLiveBroadcastBtn').addEventListener('click', startLive);
    document.getElementById('stopLiveBroadcastBtn').addEventListener('click', stopLive);
    document.getElementById('switchCameraBtn').addEventListener('click', switchCamera);

    // Close modals when clicking outside
    document.getElementById('authModal').addEventListener('click', (e) => {
        if (e.target.id === 'authModal') closeAuthModal();
    });
    document.getElementById('addProductModal').addEventListener('click', (e) => {
        if (e.target.id === 'addProductModal') closeProductModal();
    });

    // Initial setup
    updateUI();
    loadProducts();
});

// Add to cart (placeholder)
function addToCart(productId) {
    showToast('Added to cart! (Feature coming soon)', 'success');
}
