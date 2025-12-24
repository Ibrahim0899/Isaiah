/* ========================================
   Isaiah Application V2
   Multi-Writer Platform with Supabase Auth
   ======================================== */

// ========================================
// Supabase Configuration
// ========================================

const SUPABASE_URL = 'https://oaiugspjhzuxykqdmyvv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9haXVnc3BqaHp1eHlrcWRteXZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3MDI3MTgsImV4cCI6MjA4MDI3ODcxOH0.Yp0lbuLoiBO7EcjI_BoG7mqYK8UfQ0ihZejcypjKpX0';

// ========================================
// Constants
// ========================================

const STORAGE_KEYS = {
  theme: 'isaiah_theme'
};

const CATEGORIES = {
  poetry: 'Poésie',
  fiction: 'Fiction',
  essay: 'Essai',
  reflection: 'Réflexion',
  other: 'Autre'
};

// ========================================
// Security Utilities
// ========================================

const Security = {
  // Input validation patterns
  PATTERNS: {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    username: /^[a-zA-Z0-9_]{3,20}$/,
    displayName: /^[\p{L}\p{N}\s\-'.]{1,50}$/u,
    noScript: /<script|javascript:|on\w+\s*=/i
  },

  // Rate limiting
  rateLimits: new Map(),

  checkRateLimit(action, maxAttempts = 5, windowMs = 60000) {
    const now = Date.now();
    const key = action;

    if (!this.rateLimits.has(key)) {
      this.rateLimits.set(key, { attempts: 1, resetTime: now + windowMs });
      return true;
    }

    const limit = this.rateLimits.get(key);

    if (now > limit.resetTime) {
      this.rateLimits.set(key, { attempts: 1, resetTime: now + windowMs });
      return true;
    }

    if (limit.attempts >= maxAttempts) {
      return false;
    }

    limit.attempts++;
    return true;
  },

  // Validate email format
  isValidEmail(email) {
    return typeof email === 'string' &&
      email.length <= 254 &&
      this.PATTERNS.email.test(email);
  },

  // Validate username
  isValidUsername(username) {
    return typeof username === 'string' &&
      this.PATTERNS.username.test(username);
  },

  // Validate display name
  isValidDisplayName(name) {
    return typeof name === 'string' &&
      name.length >= 1 &&
      name.length <= 50 &&
      this.PATTERNS.displayName.test(name);
  },

  // Check for malicious content
  containsMaliciousContent(text) {
    if (typeof text !== 'string') return false;
    return this.PATTERNS.noScript.test(text);
  },

  // Sanitize string input
  sanitizeInput(input, maxLength = 10000) {
    if (typeof input !== 'string') return '';
    return input.slice(0, maxLength).trim();
  },

  // Validate password strength
  isStrongPassword(password) {
    if (typeof password !== 'string') return false;
    return password.length >= 8 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /[0-9]/.test(password);
  },

  // Log security events (for monitoring)
  logSecurityEvent(event, details = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      ...details
    };
    console.warn('[SECURITY]', logEntry);
  }
};

// ========================================
// State Management
// ========================================

let state = {
  writings: [],
  user: null,
  profile: null,
  currentWritingId: null,
  currentPage: 'home',
  filters: {
    category: 'all',
    visibility: 'all'
  },
  isLoading: false
};

// ========================================
// Supabase Client
// ========================================

const Supabase = {
  async fetch(endpoint, options = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const token = state.user?.access_token || SUPABASE_ANON_KEY;
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation'
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...headers, ...options.headers }
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Supabase error:', error);
        throw new Error(error);
      }

      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } catch (e) {
      console.error('Supabase fetch error:', e);
      throw e;
    }
  },

  async getWritings() {
    return await this.fetch('writings?order=created_at.desc&select=*,profiles(username,display_name,avatar_url)');
  },

  async getWriting(id) {
    const data = await this.fetch(`writings?id=eq.${id}&select=*,profiles(username,display_name,avatar_url)`);
    return data && data.length > 0 ? data[0] : null;
  },

  async createWriting(writing) {
    const data = await this.fetch('writings', {
      method: 'POST',
      body: JSON.stringify(writing)
    });
    return data && data.length > 0 ? data[0] : null;
  },

  async updateWriting(id, updates) {
    const data = await this.fetch(`writings?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
    return data && data.length > 0 ? data[0] : null;
  },

  async deleteWriting(id) {
    await this.fetch(`writings?id=eq.${id}`, {
      method: 'DELETE'
    });
    return true;
  },

  async getProfile(userId) {
    const data = await this.fetch(`profiles?id=eq.${userId}`);
    return data && data.length > 0 ? data[0] : null;
  },

  async updateProfile(userId, updates) {
    const data = await this.fetch(`profiles?id=eq.${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
    return data && data.length > 0 ? data[0] : null;
  },

  async getAuthorWritings(authorId) {
    return await this.fetch(`writings?author_id=eq.${authorId}&visibility=eq.public&order=created_at.desc`);
  },

  async subscribe(email) {
    const data = await this.fetch('subscriptions', {
      method: 'POST',
      body: JSON.stringify({ email }),
      prefer: 'return=minimal'
    });
    return data;
  },

  // V3: Follows system
  async getFollows(userId) {
    return await this.fetch(`follows?follower_id=eq.${userId}&select=following_id`);
  },

  async follow(followingId) {
    const data = await this.fetch('follows', {
      method: 'POST',
      body: JSON.stringify({
        follower_id: state.user.user.id,
        following_id: followingId
      })
    });
    return data;
  },

  async unfollow(followingId) {
    await this.fetch(`follows?follower_id=eq.${state.user.user.id}&following_id=eq.${followingId}`, {
      method: 'DELETE'
    });
    return true;
  },

  async getWriters() {
    return await this.fetch('profiles?role=eq.writer&select=id,username,display_name,avatar_url,bio');
  },

  async getAdminWritings() {
    // Get writings from admin users
    return await this.fetch(`writings?visibility=eq.public&order=created_at.desc&profiles.role=eq.admin&select=*,profiles!inner(id,username,display_name,avatar_url,role)`);
  },

  async getWritingsFromFollows(followingIds) {
    if (!followingIds || followingIds.length === 0) return [];
    const ids = followingIds.join(',');
    return await this.fetch(`writings?author_id=in.(${ids})&visibility=eq.public&order=created_at.desc&select=*,profiles(id,username,display_name,avatar_url,role)`);
  },

  async incrementViewCount(writingId) {
    // Use RPC function
    try {
      await this.fetch('rpc/increment_view_count', {
        method: 'POST',
        body: JSON.stringify({ writing_id: writingId })
      });
    } catch (e) {
      console.log('View count increment failed:', e);
    }
  },

  async searchWriters(query) {
    if (!query || query.length < 2) return [];
    const searchTerm = `%${query}%`;
    return await this.fetch(`profiles?or=(username.ilike.${encodeURIComponent(searchTerm)},display_name.ilike.${encodeURIComponent(searchTerm)})&select=id,username,display_name,avatar_url,bio,role&limit=10`);
  },

  async getAllProfiles() {
    return await this.fetch('profiles?select=id,username,display_name,avatar_url,bio,role&order=created_at.desc');
  },

  // Alias for consistency
  async getWritingsByAuthor(authorId) {
    return await this.getAuthorWritings(authorId);
  }
};

// ========================================
// Follows System
// ========================================

const Follows = {
  following: new Set(),

  async load() {
    if (!Auth.isLoggedIn()) return;
    try {
      const follows = await Supabase.getFollows(state.user.user.id);
      this.following = new Set(follows.map(f => f.following_id));
    } catch (e) {
      console.error('Error loading follows:', e);
    }
  },

  isFollowing(userId) {
    return this.following.has(userId);
  },

  async follow(userId) {
    if (!Auth.isLoggedIn()) {
      UI.showAuthModal();
      return false;
    }

    try {
      await Supabase.follow(userId);
      this.following.add(userId);
      UI.toast('Vous suivez maintenant cet écrivain !', 'success');
      return true;
    } catch (e) {
      console.error('Follow error:', e);
      UI.toast('Erreur lors de l\'abonnement', 'error');
      return false;
    }
  },

  async unfollow(userId) {
    try {
      await Supabase.unfollow(userId);
      this.following.delete(userId);
      UI.toast('Désabonné', 'success');
      return true;
    } catch (e) {
      console.error('Unfollow error:', e);
      UI.toast('Erreur lors du désabonnement', 'error');
      return false;
    }
  }
};

// ========================================
// Search System
// ========================================

const Search = {
  debounceTimer: null,

  init() {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');

    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
      clearTimeout(this.debounceTimer);
      const query = e.target.value.trim();

      if (query.length < 2) {
        this.hideResults();
        return;
      }

      this.debounceTimer = setTimeout(() => {
        this.performSearch(query);
      }, 300);
    });

    searchInput.addEventListener('focus', () => {
      if (searchInput.value.length >= 2) {
        this.performSearch(searchInput.value.trim());
      }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container')) {
        this.hideResults();
      }
    });
  },

  async performSearch(query) {
    try {
      const results = await Supabase.searchWriters(query);
      this.renderResults(results);
    } catch (e) {
      console.error('Search error:', e);
    }
  },

  renderResults(results) {
    const container = document.getElementById('searchResults');

    if (!results || results.length === 0) {
      container.innerHTML = '<div class="search-no-results">Aucun écrivain trouvé</div>';
      container.classList.remove('hidden');
      return;
    }

    container.innerHTML = results.map(writer => {
      const initial = (writer.display_name || writer.username || 'U').charAt(0).toUpperCase();
      const roleLabel = writer.role === 'admin' ? ' 👑' : '';

      return `
        <div class="search-result-item" data-writer-id="${writer.id}">
          <div class="search-result-avatar">${initial}</div>
          <div class="search-result-info">
            <div class="search-result-name">${UI.escapeHtml(writer.display_name || writer.username)}${roleLabel}</div>
            <div class="search-result-username">@${UI.escapeHtml(writer.username)}</div>
          </div>
        </div>
      `;
    }).join('');

    container.classList.remove('hidden');

    // Add click listeners
    container.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const writerId = item.dataset.writerId;
        this.hideResults();
        document.getElementById('searchInput').value = '';
        UI.showWriterProfile(writerId);
      });
    });
  },

  hideResults() {
    document.getElementById('searchResults')?.classList.add('hidden');
  }
};

// ========================================
// Newsletter Subscriptions
// ========================================

const Subscriptions = {
  async subscribe(email) {
    // Rate limiting
    if (!Security.checkRateLimit('subscribe', 3, 300000)) {
      Security.logSecurityEvent('RATE_LIMIT_EXCEEDED', { action: 'subscribe' });
      UI.toast('Trop de tentatives. Réessayez dans 5 minutes.', 'error');
      return false;
    }

    // Validate email
    if (!Security.isValidEmail(email)) {
      UI.toast('Format d\'email invalide', 'error');
      return false;
    }

    try {
      await Supabase.subscribe(Security.sanitizeInput(email, 254));
      Security.logSecurityEvent('SUBSCRIPTION_SUCCESS', { email });
      UI.toast('🎉 Inscription réussie ! Bienvenue dans la communauté.', 'success');
      return true;
    } catch (e) {
      console.error('Subscription error:', e);
      // Check if it's a duplicate error
      if (e.message && e.message.includes('duplicate')) {
        UI.toast('Vous êtes déjà inscrit à la newsletter.', 'error');
      } else {
        UI.toast('Erreur lors de l\'inscription. Réessayez.', 'error');
      }
      return false;
    }
  }
};

// ========================================
// Authentication
// ========================================

const Auth = {
  // Session storage key for auth tokens (more secure than localStorage)
  SESSION_KEY: 'isaiah.auth.session',

  async init() {
    // Check for existing session in sessionStorage (cleared on browser close)
    const session = sessionStorage.getItem(this.SESSION_KEY);
    if (session) {
      try {
        const parsed = JSON.parse(session);
        if (parsed.currentSession && parsed.currentSession.expires_at * 1000 > Date.now()) {
          state.user = parsed.currentSession;
          state.profile = await Supabase.getProfile(state.user.user.id);
          UI.updateAuthUI();
        } else {
          // Session expired, clean up
          sessionStorage.removeItem(this.SESSION_KEY);
        }
      } catch (e) {
        console.error('Error restoring session:', e);
        sessionStorage.removeItem(this.SESSION_KEY);
      }
    }
  },

  async signUp(email, password, username, displayName) {
    // Rate limiting check
    if (!Security.checkRateLimit('signup', 3, 300000)) {
      Security.logSecurityEvent('RATE_LIMIT_EXCEEDED', { action: 'signup' });
      UI.toast('Trop de tentatives. Réessayez dans 5 minutes.', 'error');
      return null;
    }

    // Input validation
    if (!Security.isValidEmail(email)) {
      UI.toast('Format d\'email invalide', 'error');
      return null;
    }

    if (!Security.isValidUsername(username)) {
      UI.toast('Pseudo invalide (3-20 caractères, lettres/chiffres/_)', 'error');
      return null;
    }

    if (!Security.isValidDisplayName(displayName)) {
      UI.toast('Nom d\'affichage invalide', 'error');
      return null;
    }

    if (!Security.isStrongPassword(password)) {
      UI.toast('Mot de passe faible (min 8 car., majuscule, minuscule, chiffre)', 'error');
      return null;
    }

    // Check for malicious content
    if (Security.containsMaliciousContent(username) || Security.containsMaliciousContent(displayName)) {
      Security.logSecurityEvent('MALICIOUS_INPUT_DETECTED', { action: 'signup' });
      UI.toast('Contenu non autorisé détecté', 'error');
      return null;
    }

    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: Security.sanitizeInput(email, 254),
          password,
          data: {
            username: Security.sanitizeInput(username, 20),
            display_name: Security.sanitizeInput(displayName, 50)
          }
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || 'Erreur d\'inscription');
      }

      Security.logSecurityEvent('SIGNUP_SUCCESS', { email });
      UI.toast('Compte créé ! Vérifiez votre email pour confirmer.', 'success');
      UI.hideAuthModal();
      return data;
    } catch (e) {
      console.error('SignUp error:', e);
      UI.toast(e.message || 'Erreur d\'inscription', 'error');
      return null;
    }
  },

  async signIn(email, password) {
    // Rate limiting - stricter for login attempts
    if (!Security.checkRateLimit('signin', 5, 300000)) {
      Security.logSecurityEvent('RATE_LIMIT_EXCEEDED', { action: 'signin', email });
      UI.toast('Trop de tentatives de connexion. Réessayez dans 5 minutes.', 'error');
      return null;
    }

    // Input validation
    if (!Security.isValidEmail(email)) {
      UI.toast('Format d\'email invalide', 'error');
      return null;
    }

    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: Security.sanitizeInput(email, 254),
          password
        })
      });

      const data = await response.json();

      if (data.error) {
        Security.logSecurityEvent('LOGIN_FAILED', { email });
        throw new Error(data.error.message || 'Erreur de connexion');
      }

      state.user = data;
      state.profile = await Supabase.getProfile(data.user.id);

      // Save session securely in sessionStorage
      sessionStorage.setItem(Auth.SESSION_KEY, JSON.stringify({
        currentSession: data
      }));

      UI.updateAuthUI();
      UI.hideAuthModal();
      UI.toast(`Bienvenue, ${state.profile?.display_name || state.profile?.username || 'écrivain'} !`, 'success');

      return data;
    } catch (e) {
      console.error('SignIn error:', e);
      UI.toast(e.message || 'Email ou mot de passe incorrect', 'error');
      return null;
    }
  },

  signOut() {
    state.user = null;
    state.profile = null;
    sessionStorage.removeItem(this.SESSION_KEY);
    // Also clean up old localStorage key if present (migration)
    localStorage.removeItem('supabase.auth.token');
    UI.updateAuthUI();
    UI.navigateTo('home');
    UI.toast('Déconnecté', 'success');
  },

  isLoggedIn() {
    return state.user !== null;
  },

  isAdmin() {
    return state.profile?.role === 'admin';
  },

  canEdit(writing) {
    if (!state.user) return false;
    if (this.isAdmin()) return true;
    return writing.author_id === state.user.user.id;
  }
};

// ========================================
// Local Storage Operations
// ========================================

const Storage = {
  get(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Error reading from storage:', e);
      return null;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Error writing to storage:', e);
      return false;
    }
  },

  loadLocal() {
    const savedTheme = Storage.get(STORAGE_KEYS.theme);
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  },

  saveTheme(theme) {
    Storage.set(STORAGE_KEYS.theme, theme);
  }
};

// ========================================
// Writing Operations
// ========================================

const Writings = {
  async loadAll() {
    try {
      state.isLoading = true;
      state.writings = await Supabase.getWritings();
      state.isLoading = false;
      return state.writings;
    } catch (e) {
      console.error('Error loading writings:', e);
      state.writings = [];
      state.isLoading = false;
      UI.toast('Erreur de chargement', 'error');
      return [];
    }
  },

  async create(data) {
    if (!Auth.isLoggedIn()) return null;

    try {
      const writing = {
        title: data.title || 'Sans titre',
        content: data.content || '',
        excerpt: this.createExcerpt(data.content || ''),
        tags: data.tags || [],
        category: data.category || 'other',
        visibility: data.visibility || 'private',
        author_id: state.user.user.id
      };

      const created = await Supabase.createWriting(writing);
      if (created) {
        // Add profile info for display
        created.profiles = {
          username: state.profile?.username,
          display_name: state.profile?.display_name,
          avatar_url: state.profile?.avatar_url
        };
        state.writings.unshift(created);
      }
      return created;
    } catch (e) {
      console.error('Error creating writing:', e);
      UI.toast('Erreur lors de la création', 'error');
      return null;
    }
  },

  async update(id, data) {
    const writing = this.get(id);
    if (!writing || !Auth.canEdit(writing)) return null;

    try {
      const updates = {
        ...data,
        excerpt: this.createExcerpt(data.content || ''),
        updated_at: new Date().toISOString()
      };

      const updated = await Supabase.updateWriting(id, updates);
      if (updated) {
        const index = state.writings.findIndex(w => w.id === id);
        if (index !== -1) {
          updated.profiles = writing.profiles;
          state.writings[index] = updated;
        }
      }
      return updated;
    } catch (e) {
      console.error('Error updating writing:', e);
      UI.toast('Erreur lors de la mise à jour', 'error');
      return null;
    }
  },

  async delete(id) {
    const writing = this.get(id);
    if (!writing || !Auth.canEdit(writing)) return false;

    try {
      await Supabase.deleteWriting(id);
      state.writings = state.writings.filter(w => w.id !== id);
      return true;
    } catch (e) {
      console.error('Error deleting writing:', e);
      UI.toast('Erreur lors de la suppression', 'error');
      return false;
    }
  },

  get(id) {
    return state.writings.find(w => w.id === id) || null;
  },

  getFiltered() {
    let writings = state.writings;

    // Non-logged users only see public writings
    if (!Auth.isLoggedIn()) {
      writings = writings.filter(w => w.visibility === 'public');
    } else if (!Auth.isAdmin()) {
      // Logged users see public + their own
      writings = writings.filter(w =>
        w.visibility === 'public' || w.author_id === state.user.user.id
      );
    }

    return writings.filter(w => {
      const categoryMatch = state.filters.category === 'all' || w.category === state.filters.category;
      const visibilityMatch = Auth.isAdmin() ?
        (state.filters.visibility === 'all' || w.visibility === state.filters.visibility) :
        true;
      return categoryMatch && visibilityMatch;
    });
  },

  getMyWritings() {
    if (!Auth.isLoggedIn()) return [];
    return state.writings.filter(w => w.author_id === state.user.user.id);
  },

  createExcerpt(content, length = 150) {
    const plain = content
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/>\s/g, '')
      .replace(/[-*]\s/g, '')
      .trim();

    return plain.length > length ? plain.substring(0, length) + '...' : plain;
  }
};

// ========================================
// Markdown Parser
// ========================================

const Markdown = {
  // Allowed HTML tags for DOMPurify
  ALLOWED_TAGS: ['h1', 'h2', 'h3', 'p', 'br', 'strong', 'em', 'blockquote', 'ul', 'li', 'hr'],
  ALLOWED_ATTR: [],

  parse(text) {
    if (!text) return '';

    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/^\* (.+)$/gm, '<li>$1</li>')
      .replace(/^---$/gm, '<hr>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    html = '<p>' + html + '</p>';
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/(<li>.*?<\/li>)+/gs, match => `<ul>${match}</ul>`);
    html = html.replace(/(<blockquote>.*?<\/blockquote>)+/gs, match => {
      const content = match.replace(/<\/?blockquote>/g, '<br>').replace(/^<br>/, '').replace(/<br>$/, '');
      return `<blockquote>${content}</blockquote>`;
    });

    // Sanitize HTML with DOMPurify to prevent XSS attacks
    if (typeof DOMPurify !== 'undefined') {
      html = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: this.ALLOWED_TAGS,
        ALLOWED_ATTR: this.ALLOWED_ATTR
      });
    }

    return html;
  }
};

// ========================================
// UI Components
// ========================================

const UI = {
  updateAuthUI() {
    const authBtn = document.getElementById('authBtn');
    const writeNavItem = document.querySelector('.nav-link[data-page="write"]');
    const profileNavItem = document.querySelector('.nav-link[data-page="profile"]');

    if (Auth.isLoggedIn()) {
      authBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      `;
      authBtn.title = 'Déconnexion';
      authBtn.classList.add('logged-in');

      // Show write and profile for logged users
      if (writeNavItem) writeNavItem.style.display = '';
      if (profileNavItem) profileNavItem.style.display = '';
    } else {
      authBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      `;
      authBtn.title = 'Connexion / Inscription';
      authBtn.classList.remove('logged-in');

      // Hide write and profile for visitors
      if (writeNavItem) writeNavItem.style.display = 'none';
      if (profileNavItem) profileNavItem.style.display = 'none';
    }

    // Update visibility filters (admin only)
    const visibilityFilters = document.querySelector('.filter-group[data-admin-only]');
    if (visibilityFilters) {
      visibilityFilters.style.display = Auth.isAdmin() ? 'flex' : 'none';
    }
  },

  toast(message, type = 'default') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  },

  async navigateTo(page) {
    // Redirect to landing for non-logged users trying to access library
    if (page === 'home' && !Auth.isLoggedIn()) {
      page = 'landing';
    }

    if ((page === 'write' || page === 'profile') && !Auth.isLoggedIn()) {
      this.showAuthModal();
      return;
    }

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    const targetPage = document.getElementById(`page-${page}`);
    if (targetPage) {
      targetPage.classList.add('active');
      state.currentPage = page;

      document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === page);
      });

      if (page === 'landing') {
        await this.renderLandingPage();
      } else if (page === 'home') {
        await Follows.load();
        await this.renderWritingsGrid();
      } else if (page === 'profile') {
        this.renderProfile();
      }
    }
  },

  async renderLandingPage() {
    // Render featured writings (admin's)
    const featuredGrid = document.getElementById('featuredWritings');
    const writersGrid = document.getElementById('writersGrid');

    try {
      // Get admin writings
      const writings = await Supabase.getAdminWritings();

      if (writings && writings.length > 0) {
        featuredGrid.innerHTML = writings.slice(0, 4).map(w => this.createWritingCard(w)).join('');
      } else {
        featuredGrid.innerHTML = '<p class="empty-text">Aucun écrit pour le moment.</p>';
      }

      // Get writers suggestions
      const writers = await Supabase.getWriters();
      if (writers && writers.length > 0) {
        writersGrid.innerHTML = writers.slice(0, 6).map(w => this.createWriterCard(w)).join('');
      } else {
        document.getElementById('discoverSection').style.display = 'none';
      }
    } catch (e) {
      console.error('Error loading landing page:', e);
    }
  },

  createWriterCard(writer) {
    const initial = (writer.display_name || writer.username || 'U').charAt(0).toUpperCase();
    const isFollowing = Follows.isFollowing(writer.id);

    return `
      <div class="writer-card" data-writer-id="${writer.id}">
        <div class="writer-avatar">${initial}</div>
        <div class="writer-info">
          <div class="writer-name">${this.escapeHtml(writer.display_name || writer.username)}</div>
          <div class="writer-stats">@${this.escapeHtml(writer.username)}</div>
        </div>
        <button class="btn ${isFollowing ? 'btn-following' : 'btn-primary'} btn-follow" 
                onclick="UI.toggleFollow('${writer.id}')" data-writer-id="${writer.id}">
          ${isFollowing ? 'Suivi' : 'Suivre'}
        </button>
      </div>
    `;
  },

  async toggleFollow(writerId) {
    if (!Auth.isLoggedIn()) {
      this.showAuthModal();
      return;
    }

    const isFollowing = Follows.isFollowing(writerId);
    if (isFollowing) {
      await Follows.unfollow(writerId);
    } else {
      await Follows.follow(writerId);
    }

    // Update button UI
    const btns = document.querySelectorAll(`.btn-follow[data-writer-id="${writerId}"]`);
    btns.forEach(btn => {
      btn.textContent = Follows.isFollowing(writerId) ? 'Suivi' : 'Suivre';
      btn.classList.toggle('btn-following', Follows.isFollowing(writerId));
      btn.classList.toggle('btn-primary', !Follows.isFollowing(writerId));
    });
  },

  async showWriterProfile(writerId) {
    try {
      // Get writer info
      const writers = await Supabase.fetch(`profiles?id=eq.${writerId}&select=*`);
      if (!writers || writers.length === 0) {
        this.toast('Écrivain non trouvé', 'error');
        return;
      }

      const writer = writers[0];
      const writings = await Supabase.getWritingsByAuthor(writerId);
      const isFollowing = Follows.isFollowing(writerId);
      const initial = (writer.display_name || writer.username || 'U').charAt(0).toUpperCase();

      // Create modal
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.id = 'writerModal';
      modal.innerHTML = `
        <div class="auth-modal" style="max-width: 600px;">
          <button class="modal-close" onclick="document.getElementById('writerModal').remove()">&times;</button>
          <div style="text-align: center; padding: 2rem;">
            <div class="writer-avatar" style="width: 80px; height: 80px; font-size: 2rem; margin: 0 auto 1rem;">
              ${initial}
            </div>
            <h2 style="margin-bottom: 0.25rem;">${this.escapeHtml(writer.display_name || writer.username)}</h2>
            <p style="color: var(--text-tertiary);">@${this.escapeHtml(writer.username)}</p>
            ${writer.bio ? `<p style="margin-top: 1rem; color: var(--text-secondary);">${this.escapeHtml(writer.bio)}</p>` : ''}
            <button class="btn ${isFollowing ? 'btn-following' : 'btn-primary'} btn-follow" 
                    style="margin-top: 1rem;"
                    onclick="UI.toggleFollow('${writer.id}')" data-writer-id="${writer.id}">
              ${isFollowing ? 'Suivi' : 'Suivre'}
            </button>
          </div>
          <div style="border-top: 1px solid var(--border-color); padding: 1rem;">
            <h3 style="margin-bottom: 1rem;">📖 Écrits (${writings.length})</h3>
            ${writings.length > 0
          ? `<div class="writings-grid">${writings.slice(0, 4).map(w => this.createWritingCard(w)).join('')}</div>`
          : '<p style="color: var(--text-tertiary); text-align: center;">Aucun écrit public</p>'
        }
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Close on overlay click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
      });

      // Add click handlers to writing cards
      modal.querySelectorAll('.writing-card').forEach(card => {
        card.addEventListener('click', () => {
          modal.remove();
          this.openReading(card.dataset.id);
        });
      });

    } catch (e) {
      console.error('Error loading writer profile:', e);
      this.toast('Erreur lors du chargement', 'error');
    }
  },

  async renderWritingsGrid() {
    const grid = document.getElementById('writingsGrid');
    const emptyState = document.getElementById('emptyState');

    await Writings.loadAll();
    const writings = Writings.getFiltered();

    const emptyTitle = emptyState.querySelector('h2');
    const emptyText = emptyState.querySelector('p');
    const emptyBtn = emptyState.querySelector('button');

    if (Auth.isLoggedIn()) {
      emptyTitle.textContent = 'Commencez à écrire';
      emptyText.textContent = 'Aucun écrit visible. Créez votre premier texte !';
      emptyBtn.style.display = '';
    } else {
      emptyTitle.textContent = 'Aucun écrit pour le moment';
      emptyText.textContent = 'Les auteurs n\'ont pas encore publié d\'écrits. Revenez bientôt !';
      emptyBtn.style.display = 'none';
    }

    if (writings.length === 0) {
      grid.innerHTML = '';
      grid.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    grid.style.display = 'grid';
    emptyState.style.display = 'none';

    grid.innerHTML = writings.map(writing => `
      <article class="writing-card" data-id="${writing.id}" data-category="${writing.category}">
        <div class="card-header">
          <span class="card-category">${CATEGORIES[writing.category]}</span>
          ${Auth.canEdit(writing) ? `<span class="card-visibility">${writing.visibility === 'public' ? '🌍' : '🔒'}</span>` : ''}
        </div>
        <h3 class="card-title">${this.escapeHtml(writing.title)}</h3>
        <p class="card-excerpt">${this.escapeHtml(writing.excerpt || '')}</p>
        <div class="card-footer">
          <div class="card-author">
            <span class="author-avatar">${(writing.profiles?.display_name || writing.profiles?.username || 'A').charAt(0).toUpperCase()}</span>
            <span class="author-name">${this.escapeHtml(writing.profiles?.display_name || writing.profiles?.username || 'Anonyme')}</span>
          </div>
          <span class="card-date">${this.formatDate(writing.created_at)}</span>
        </div>
      </article>
    `).join('');

    grid.querySelectorAll('.writing-card').forEach(card => {
      card.addEventListener('click', () => {
        this.openReading(card.dataset.id);
      });
    });
  },

  openReading(id) {
    const writing = Writings.get(id);
    if (!writing) return;

    if (!Auth.isLoggedIn() && writing.visibility !== 'public') {
      this.toast('Cet écrit est privé', 'error');
      return;
    }

    state.currentWritingId = id;

    document.getElementById('readCategory').textContent = CATEGORIES[writing.category];
    document.getElementById('readDate').textContent = this.formatDate(writing.created_at);

    const visibilityEl = document.getElementById('readVisibility');
    visibilityEl.textContent = writing.visibility === 'public' ? '🌍 Public' : '🔒 Privé';
    visibilityEl.style.display = Auth.canEdit(writing) ? '' : 'none';

    document.getElementById('readTitle').textContent = writing.title;

    // Author info
    const authorName = writing.profiles?.display_name || writing.profiles?.username || 'Anonyme';
    const readAuthor = document.getElementById('readAuthor');
    if (readAuthor) {
      readAuthor.innerHTML = `
        <span class="author-avatar">${authorName.charAt(0).toUpperCase()}</span>
        <span>Par <strong>${this.escapeHtml(authorName)}</strong></span>
      `;
    }

    document.getElementById('readTags').innerHTML = (writing.tags || []).map(tag =>
      `<span class="reading-tag">#${this.escapeHtml(tag)}</span>`
    ).join('');
    document.getElementById('readContent').innerHTML = Markdown.parse(writing.content);

    const readingFooter = document.querySelector('.reading-footer');
    readingFooter.style.display = Auth.canEdit(writing) ? 'flex' : 'none';

    // Increment view count
    Supabase.incrementViewCount(id);

    this.navigateTo('read');
  },

  openEditor(id = null) {
    if (!Auth.isLoggedIn()) {
      this.showAuthModal();
      return;
    }

    state.currentWritingId = id;
    const writing = id ? Writings.get(id) : null;

    // Check permission
    if (writing && !Auth.canEdit(writing)) {
      this.toast('Vous ne pouvez pas modifier cet écrit', 'error');
      return;
    }

    document.getElementById('writingTitle').value = writing?.title || '';
    document.getElementById('writingContent').value = writing?.content || '';
    document.getElementById('writingCategory').value = writing?.category || 'poetry';

    document.querySelectorAll('.toggle-btn[data-visibility]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.visibility === (writing?.visibility || 'private'));
    });

    this.renderTags(writing?.tags || []);

    document.getElementById('editorPane').classList.remove('hidden');
    document.getElementById('previewPane').classList.add('hidden');

    this.navigateTo('write');
  },

  renderTags(tags) {
    const tagsList = document.getElementById('tagsList');
    tagsList.innerHTML = tags.map(tag => `
      <span class="tag">
        ${this.escapeHtml(tag)}
        <button class="tag-remove" data-tag="${this.escapeHtml(tag)}">&times;</button>
      </span>
    `).join('');

    tagsList.querySelectorAll('.tag-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const currentTags = this.getCurrentTags();
        const newTags = currentTags.filter(t => t !== btn.dataset.tag);
        this.renderTags(newTags);
      });
    });
  },

  getCurrentTags() {
    return Array.from(document.querySelectorAll('#tagsList .tag')).map(tag =>
      tag.textContent.trim().replace('×', '').trim()
    );
  },

  async saveWriting() {
    if (!Auth.isLoggedIn()) {
      this.toast('Veuillez vous connecter', 'error');
      return;
    }

    const title = document.getElementById('writingTitle').value.trim();
    const content = document.getElementById('writingContent').value;
    const category = document.getElementById('writingCategory').value;
    const visibility = document.querySelector('.toggle-btn[data-visibility].active')?.dataset.visibility || 'private';
    const tags = this.getCurrentTags();

    if (!title && !content) {
      this.toast('Veuillez ajouter un titre ou du contenu', 'error');
      return;
    }

    const data = {
      title: title || 'Sans titre',
      content,
      category,
      visibility,
      tags
    };

    if (state.currentWritingId) {
      const updated = await Writings.update(state.currentWritingId, data);
      if (updated) {
        this.toast('Écrit mis à jour ✓', 'success');
      }
    } else {
      const created = await Writings.create(data);
      if (created) {
        state.currentWritingId = created.id;
        this.toast('Écrit publié ✓', 'success');
      }
    }

    this.navigateTo('home');
  },

  async deleteWriting(id) {
    const writing = Writings.get(id);
    if (!writing || !Auth.canEdit(writing)) {
      this.toast('Accès non autorisé', 'error');
      return;
    }

    const deleted = await Writings.delete(id);
    if (deleted) {
      this.toast('Écrit supprimé', 'success');
      this.navigateTo('home');
    }
  },

  renderProfile() {
    if (!Auth.isLoggedIn()) {
      this.navigateTo('home');
      return;
    }

    document.getElementById('profileName').value = state.profile?.display_name || '';
    document.getElementById('profileUsername').value = state.profile?.username || '';
    document.getElementById('profileBio').value = state.profile?.bio || '';

    const initial = (state.profile?.display_name || state.profile?.username || 'U').charAt(0).toUpperCase();
    document.getElementById('profileAvatar').textContent = initial;

    const myWritings = Writings.getMyWritings();
    const total = myWritings.length;
    const publicCount = myWritings.filter(w => w.visibility === 'public').length;
    const privateCount = total - publicCount;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statPublic').textContent = publicCount;
    document.getElementById('statPrivate').textContent = privateCount;

    // Show role badge
    const roleBadge = document.getElementById('roleBadge');
    if (roleBadge) {
      roleBadge.textContent = Auth.isAdmin() ? '👑 Admin' : '✍️ Écrivain';
      roleBadge.className = `role-badge ${Auth.isAdmin() ? 'admin' : 'writer'}`;
    }

    const myWritingsGrid = document.getElementById('myWritingsGrid');
    const noWritings = document.getElementById('noMyWritings');

    if (myWritings.length === 0) {
      myWritingsGrid.innerHTML = '';
      myWritingsGrid.style.display = 'none';
      noWritings.style.display = 'block';
    } else {
      myWritingsGrid.style.display = 'grid';
      noWritings.style.display = 'none';

      myWritingsGrid.innerHTML = myWritings.map(writing => `
        <article class="writing-card" data-id="${writing.id}" data-category="${writing.category}">
          <div class="card-header">
            <span class="card-category">${CATEGORIES[writing.category]}</span>
            <span class="card-visibility">${writing.visibility === 'public' ? '🌍' : '🔒'}</span>
          </div>
          <h3 class="card-title">${this.escapeHtml(writing.title)}</h3>
          <p class="card-excerpt">${this.escapeHtml(writing.excerpt || '')}</p>
          <div class="card-footer">
            <span class="card-date">${this.formatDate(writing.created_at)}</span>
          </div>
        </article>
      `).join('');

      myWritingsGrid.querySelectorAll('.writing-card').forEach(card => {
        card.addEventListener('click', () => {
          this.openReading(card.dataset.id);
        });
      });
    }
  },

  async saveProfile() {
    if (!Auth.isLoggedIn()) return;

    const displayName = document.getElementById('profileName').value.trim();
    const bio = document.getElementById('profileBio').value.trim();

    try {
      const updated = await Supabase.updateProfile(state.user.user.id, {
        display_name: displayName,
        bio: bio,
        updated_at: new Date().toISOString()
      });

      if (updated) {
        state.profile = updated;
        const initial = (displayName || state.profile?.username || 'U').charAt(0).toUpperCase();
        document.getElementById('profileAvatar').textContent = initial;
        this.toast('Profil sauvegardé ✓', 'success');
      }
    } catch (e) {
      console.error('Error saving profile:', e);
      this.toast('Erreur lors de la sauvegarde', 'error');
    }
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    Storage.saveTheme(next);
  },

  formatDate(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  },

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  showDeleteModal() {
    document.getElementById('deleteModal').classList.add('show');
  },

  hideDeleteModal() {
    document.getElementById('deleteModal').classList.remove('show');
  },

  showAuthModal(mode = 'login') {
    document.getElementById('authModal').classList.add('show');
    this.switchAuthMode(mode);

    if (mode === 'login') {
      document.getElementById('loginEmail').focus();
    } else {
      document.getElementById('signupEmail').focus();
    }
  },

  hideAuthModal() {
    document.getElementById('authModal').classList.remove('show');
  },

  switchAuthMode(mode) {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const loginTab = document.getElementById('loginTab');
    const signupTab = document.getElementById('signupTab');

    if (mode === 'login') {
      loginForm.classList.remove('hidden');
      signupForm.classList.add('hidden');
      loginTab.classList.add('active');
      signupTab.classList.remove('active');
    } else {
      loginForm.classList.add('hidden');
      signupForm.classList.remove('hidden');
      loginTab.classList.remove('active');
      signupTab.classList.add('active');
    }
  }
};

// ========================================
// Editor Toolbar
// ========================================

const Editor = {
  insertText(before, after = '') {
    const textarea = document.getElementById('writingContent');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const newText = before + selectedText + after;

    textarea.value = textarea.value.substring(0, start) + newText + textarea.value.substring(end);

    const newPosition = start + before.length + selectedText.length + after.length;
    textarea.setSelectionRange(newPosition, newPosition);
    textarea.focus();
  },

  actions: {
    bold: () => Editor.insertText('**', '**'),
    italic: () => Editor.insertText('*', '*'),
    h1: () => Editor.insertText('\n# ', '\n'),
    h2: () => Editor.insertText('\n## ', '\n'),
    h3: () => Editor.insertText('\n### ', '\n'),
    quote: () => Editor.insertText('\n> ', '\n'),
    list: () => Editor.insertText('\n- ', '\n')
  },

  togglePreview() {
    const previewPane = document.getElementById('previewPane');
    const previewContent = document.getElementById('previewContent');
    const content = document.getElementById('writingContent').value;

    if (previewPane.classList.contains('hidden')) {
      previewContent.innerHTML = Markdown.parse(content);
      previewPane.classList.remove('hidden');
    } else {
      previewPane.classList.add('hidden');
    }
  }
};

// ========================================
// Event Listeners
// ========================================

function initializeEventListeners() {
  // Navigation
  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const page = el.dataset.page;

      if (page === 'write') {
        UI.openEditor();
      } else {
        UI.navigateTo(page);
      }
    });
  });

  // Auth button
  const authBtn = document.getElementById('authBtn');
  authBtn.addEventListener('click', () => {
    if (Auth.isLoggedIn()) {
      Auth.signOut();
    } else {
      UI.showAuthModal('login');
    }
  });

  // Auth modal tabs
  document.getElementById('loginTab')?.addEventListener('click', () => UI.switchAuthMode('login'));
  document.getElementById('signupTab')?.addEventListener('click', () => UI.switchAuthMode('signup'));

  // Login form
  document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    await Auth.signIn(email, password);
  });

  // Signup form
  document.getElementById('signupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const username = document.getElementById('signupUsername').value;
    const displayName = document.getElementById('signupDisplayName').value;
    await Auth.signUp(email, password, username, displayName);
  });

  // Close auth modal
  document.getElementById('closeAuthModal')?.addEventListener('click', () => UI.hideAuthModal());
  document.getElementById('authModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'authModal') UI.hideAuthModal();
  });

  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', UI.toggleTheme);

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const filterType = btn.dataset.filter;
      const value = btn.dataset.value;

      if (filterType === 'category') {
        state.filters.category = value;
      } else if (filterType === 'visibility') {
        state.filters.visibility = value;
      }

      document.querySelectorAll(`.filter-btn[data-filter="${filterType}"]`).forEach(b => {
        b.classList.toggle('active', b.dataset.value === value);
      });

      UI.renderWritingsGrid();
    });
  });

  // New writing button
  document.getElementById('newWritingBtn')?.addEventListener('click', () => UI.openEditor());
  document.querySelector('.empty-state button')?.addEventListener('click', () => UI.openEditor());

  // Editor toolbar
  document.querySelectorAll('.toolbar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (Editor.actions[action]) {
        Editor.actions[action]();
      }
    });
  });

  // Preview toggle
  document.getElementById('previewToggle')?.addEventListener('click', Editor.togglePreview);

  // Visibility toggle
  document.querySelectorAll('.toggle-btn[data-visibility]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-btn[data-visibility]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Add tag via Enter key
  document.getElementById('tagsInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const input = e.target;
      const tag = input.value.trim();
      if (tag && !UI.getCurrentTags().includes(tag)) {
        const currentTags = UI.getCurrentTags();
        currentTags.push(tag);
        UI.renderTags(currentTags);
        input.value = '';
      }
    }
  });

  // Save writing
  document.getElementById('saveWriting')?.addEventListener('click', () => UI.saveWriting());

  // Back button
  document.getElementById('backBtn')?.addEventListener('click', () => UI.navigateTo('home'));

  // Reading page buttons
  document.getElementById('editWritingBtn')?.addEventListener('click', () => {
    if (state.currentWritingId) {
      UI.openEditor(state.currentWritingId);
    }
  });

  document.getElementById('deleteWritingBtn')?.addEventListener('click', UI.showDeleteModal);

  // Delete modal
  document.getElementById('confirmDelete')?.addEventListener('click', () => {
    if (state.currentWritingId) {
      UI.deleteWriting(state.currentWritingId);
      UI.hideDeleteModal();
    }
  });

  document.getElementById('cancelDelete')?.addEventListener('click', UI.hideDeleteModal);
  document.getElementById('deleteModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'deleteModal') UI.hideDeleteModal();
  });

  // Profile save
  document.getElementById('saveProfileBtn')?.addEventListener('click', () => UI.saveProfile());

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      UI.hideDeleteModal();
      UI.hideAuthModal();
    }
  });

  // Newsletter subscription form
  document.getElementById('newsletterForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('newsletterEmail');
    const submitBtn = document.getElementById('subscribeBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');

    // Show loading state
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';
    submitBtn.disabled = true;

    const success = await Subscriptions.subscribe(emailInput.value);

    // Reset button state
    btnText.style.display = 'inline';
    btnLoading.style.display = 'none';
    submitBtn.disabled = false;

    if (success) {
      emailInput.value = '';
    }
  });

  // Landing page buttons
  document.getElementById('landingAuthBtn')?.addEventListener('click', () => {
    UI.showAuthModal('signup');
  });

  document.getElementById('exploreBtn')?.addEventListener('click', () => {
    const featuredSection = document.getElementById('featuredSection');
    if (featuredSection) {
      featuredSection.scrollIntoView({ behavior: 'smooth' });
    }
  });

  document.getElementById('discoverWritersBtn')?.addEventListener('click', () => {
    UI.navigateTo('landing');
    setTimeout(() => {
      const discoverSection = document.getElementById('discoverSection');
      if (discoverSection) {
        discoverSection.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  });

}

// ========================================
// Initialize Application
// ========================================

async function initializeApp() {
  Storage.loadLocal();
  await Auth.init();
  UI.updateAuthUI();
  initializeEventListeners();
  Search.init();

  // Navigate to appropriate page based on auth status
  if (Auth.isLoggedIn()) {
    await Follows.load();
    await UI.navigateTo('home');
  } else {
    await UI.navigateTo('landing');
  }
}

document.addEventListener('DOMContentLoaded', initializeApp);
