/* ========================================
   Isaiah Application
   Personal Writing Platform with Supabase
   ======================================== */

// ========================================
// Supabase Configuration
// ========================================

const SUPABASE_URL = 'https://oaiugspjhzuxykqdmyvv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9haXVnc3BqaHp1eHlrcWRteXZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3MDI3MTgsImV4cCI6MjA4MDI3ODcxOH0.Yp0lbuLoiBO7EcjI_BoG7mqYK8UfQ0ihZejcypjKpX0';

// ========================================
// Data Types & Constants
// ========================================

const STORAGE_KEYS = {
  profile: 'isaiah_profile',
  theme: 'isaiah_theme',
  adminSession: 'isaiah_admin_session'
};

const CATEGORIES = {
  poetry: 'Poésie',
  fiction: 'Fiction',
  essay: 'Essai',
  reflection: 'Réflexion',
  other: 'Autre'
};

// Admin password - change this to your secure password
const ADMIN_PASSWORD = 'NarLoSidy7112';

// ========================================
// State Management
// ========================================

let state = {
  writings: [],
  profile: {
    name: 'Isaiah',
    bio: ''
  },
  currentWritingId: null,
  currentPage: 'home',
  filters: {
    category: 'all',
    visibility: 'all'
  },
  isAdmin: false,
  isLoading: false
};

// ========================================
// Supabase Client
// ========================================

const Supabase = {
  async fetch(endpoint, options = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
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
    // RLS handles visibility - anonymous users only see public, admin sees all
    return await this.fetch('writings?order=created_at.desc');
  },

  async getWriting(id) {
    const data = await this.fetch(`writings?id=eq.${id}`);
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
  }
};

// ========================================
// Admin Authentication
// ========================================

const Admin = {
  isAuthenticated() {
    const session = Storage.get(STORAGE_KEYS.adminSession);
    if (session && session.expires > Date.now()) {
      state.isAdmin = true;
      return true;
    }
    state.isAdmin = false;
    return false;
  },

  login(password) {
    if (password === ADMIN_PASSWORD) {
      const session = {
        authenticated: true,
        expires: Date.now() + (24 * 60 * 60 * 1000)
      };
      Storage.set(STORAGE_KEYS.adminSession, session);
      state.isAdmin = true;
      UI.updateAdminUI();
      UI.toast('Connecté en tant qu\'admin ✓', 'success');
      UI.hideLoginModal();
      return true;
    }
    UI.toast('Mot de passe incorrect', 'error');
    return false;
  },

  logout() {
    localStorage.removeItem(STORAGE_KEYS.adminSession);
    state.isAdmin = false;
    UI.updateAdminUI();
    UI.navigateTo('home');
    UI.toast('Déconnecté', 'success');
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
    state.profile = Storage.get(STORAGE_KEYS.profile) || { name: 'Isaiah', bio: '' };

    const savedTheme = Storage.get(STORAGE_KEYS.theme);
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }

    Admin.isAuthenticated();
  },

  saveProfile() {
    Storage.set(STORAGE_KEYS.profile, state.profile);
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
      // RLS handles visibility filtering at database level
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
    if (!state.isAdmin) return null;

    try {
      const writing = {
        title: data.title || 'Sans titre',
        content: data.content || '',
        excerpt: this.createExcerpt(data.content || ''),
        tags: data.tags || [],
        category: data.category || 'other',
        visibility: data.visibility || 'private'
      };

      const created = await Supabase.createWriting(writing);
      if (created) {
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
    if (!state.isAdmin) return null;

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
    if (!state.isAdmin) return false;

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

    // Non-admin users only see public writings
    if (!state.isAdmin) {
      writings = writings.filter(w => w.visibility === 'public');
    }

    return writings.filter(w => {
      const categoryMatch = state.filters.category === 'all' || w.category === state.filters.category;
      const visibilityMatch = state.isAdmin ?
        (state.filters.visibility === 'all' || w.visibility === state.filters.visibility) :
        true;
      return categoryMatch && visibilityMatch;
    });
  },

  getPublic() {
    return state.writings.filter(w => w.visibility === 'public');
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
      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
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

    return html;
  }
};

// ========================================
// UI Components
// ========================================

const UI = {
  updateAdminUI() {
    const adminElements = document.querySelectorAll('.admin-only');
    const visitorElements = document.querySelectorAll('.visitor-only');
    const adminBtn = document.getElementById('adminBtn');

    if (state.isAdmin) {
      adminElements.forEach(el => el.classList.remove('hidden'));
      visitorElements.forEach(el => el.classList.add('hidden'));
      adminBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      `;
      adminBtn.title = 'Déconnexion';
      adminBtn.classList.add('logged-in');
    } else {
      adminElements.forEach(el => el.classList.add('hidden'));
      visitorElements.forEach(el => el.classList.remove('hidden'));
      adminBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      `;
      adminBtn.title = 'Connexion Admin';
      adminBtn.classList.remove('logged-in');
    }

    const visibilityFilters = document.querySelector('.filter-group[data-admin-only]');
    if (visibilityFilters) {
      visibilityFilters.style.display = state.isAdmin ? 'flex' : 'none';
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
    if ((page === 'write' || page === 'profile') && !state.isAdmin) {
      this.showLoginModal();
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

      if (page === 'home') {
        await this.renderWritingsGrid();
      } else if (page === 'profile') {
        this.renderProfile();
      }
    }
  },

  async renderWritingsGrid() {
    const grid = document.getElementById('writingsGrid');
    const emptyState = document.getElementById('emptyState');

    // Reload writings from database
    await Writings.loadAll();
    const writings = Writings.getFiltered();

    const emptyTitle = emptyState.querySelector('h2');
    const emptyText = emptyState.querySelector('p');
    const emptyBtn = emptyState.querySelector('button');

    if (state.isAdmin) {
      emptyTitle.textContent = 'Commencez à écrire';
      emptyText.textContent = 'Votre bibliothèque est vide. Créez votre premier écrit pour commencer votre voyage.';
      emptyBtn.style.display = '';
    } else {
      emptyTitle.textContent = 'Aucun écrit pour le moment';
      emptyText.textContent = 'L\'auteur n\'a pas encore publié d\'écrits. Revenez bientôt !';
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
          ${state.isAdmin ? `<span class="card-visibility">${writing.visibility === 'public' ? '🌍' : '🔒'}</span>` : ''}
        </div>
        <h3 class="card-title">${this.escapeHtml(writing.title)}</h3>
        <p class="card-excerpt">${this.escapeHtml(writing.excerpt || '')}</p>
        <div class="card-footer">
          <span class="card-date">${this.formatDate(writing.created_at)}</span>
          <div class="card-tags">
            ${(writing.tags || []).slice(0, 3).map(tag => `<span class="card-tag">${this.escapeHtml(tag)}</span>`).join('')}
          </div>
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

    if (!state.isAdmin && writing.visibility !== 'public') {
      this.toast('Cet écrit est privé', 'error');
      return;
    }

    state.currentWritingId = id;

    document.getElementById('readCategory').textContent = CATEGORIES[writing.category];
    document.getElementById('readDate').textContent = this.formatDate(writing.created_at);
    document.getElementById('readVisibility').textContent = writing.visibility === 'public' ? '🌍 Public' : '🔒 Privé';
    document.getElementById('readVisibility').style.display = state.isAdmin ? '' : 'none';
    document.getElementById('readTitle').textContent = writing.title;
    document.getElementById('readTags').innerHTML = (writing.tags || []).map(tag =>
      `<span class="reading-tag">#${this.escapeHtml(tag)}</span>`
    ).join('');
    document.getElementById('readContent').innerHTML = Markdown.parse(writing.content);

    const readingFooter = document.querySelector('.reading-footer');
    readingFooter.style.display = state.isAdmin ? 'flex' : 'none';

    this.navigateTo('read');
  },

  openEditor(id = null) {
    if (!state.isAdmin) {
      this.showLoginModal();
      return;
    }

    state.currentWritingId = id;
    const writing = id ? Writings.get(id) : null;

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
    if (!state.isAdmin) {
      this.toast('Accès non autorisé', 'error');
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
        this.toast('Écrit sauvegardé ✓', 'success');
      }
    }

    this.navigateTo('home');
  },

  async deleteWriting(id) {
    if (!state.isAdmin) {
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
    if (!state.isAdmin) {
      this.navigateTo('home');
      return;
    }

    document.getElementById('profileName').value = state.profile.name;
    document.getElementById('profileBio').value = state.profile.bio;

    const initial = (state.profile.name || 'I').charAt(0).toUpperCase();
    document.getElementById('profileAvatar').textContent = initial;

    const total = state.writings.length;
    const publicCount = state.writings.filter(w => w.visibility === 'public').length;
    const privateCount = total - publicCount;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statPublic').textContent = publicCount;
    document.getElementById('statPrivate').textContent = privateCount;

    const publicWritings = Writings.getPublic();
    const publicGrid = document.getElementById('publicWritingsGrid');
    const noPublic = document.getElementById('noPublicWritings');

    if (publicWritings.length === 0) {
      publicGrid.innerHTML = '';
      publicGrid.style.display = 'none';
      noPublic.style.display = 'block';
    } else {
      publicGrid.style.display = 'grid';
      noPublic.style.display = 'none';

      publicGrid.innerHTML = publicWritings.map(writing => `
        <article class="writing-card" data-id="${writing.id}" data-category="${writing.category}">
          <div class="card-header">
            <span class="card-category">${CATEGORIES[writing.category]}</span>
            <span class="card-visibility">🌍</span>
          </div>
          <h3 class="card-title">${this.escapeHtml(writing.title)}</h3>
          <p class="card-excerpt">${this.escapeHtml(writing.excerpt || '')}</p>
          <div class="card-footer">
            <span class="card-date">${this.formatDate(writing.created_at)}</span>
          </div>
        </article>
      `).join('');

      publicGrid.querySelectorAll('.writing-card').forEach(card => {
        card.addEventListener('click', () => {
          this.openReading(card.dataset.id);
        });
      });
    }
  },

  saveProfile() {
    if (!state.isAdmin) return;

    state.profile.name = document.getElementById('profileName').value.trim();
    state.profile.bio = document.getElementById('profileBio').value.trim();
    Storage.saveProfile();

    const initial = (state.profile.name || 'I').charAt(0).toUpperCase();
    document.getElementById('profileAvatar').textContent = initial;

    this.toast('Profil sauvegardé ✓', 'success');
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

  showLoginModal() {
    document.getElementById('loginModal').classList.add('show');
    document.getElementById('adminPassword').value = '';
    document.getElementById('adminPassword').focus();
  },

  hideLoginModal() {
    document.getElementById('loginModal').classList.remove('show');
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

  document.getElementById('themeToggle').addEventListener('click', () => {
    UI.toggleTheme();
  });

  document.getElementById('adminBtn').addEventListener('click', () => {
    if (state.isAdmin) {
      Admin.logout();
    } else {
      UI.showLoginModal();
    }
  });

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('adminPassword').value;
    if (Admin.login(password)) {
      await UI.renderWritingsGrid();
    }
  });

  document.getElementById('cancelLogin').addEventListener('click', () => {
    UI.hideLoginModal();
  });

  document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filters.category = btn.dataset.filter;
      UI.renderWritingsGrid();
    });
  });

  document.querySelectorAll('.filter-btn[data-visibility]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn[data-visibility]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filters.visibility = btn.dataset.visibility;
      UI.renderWritingsGrid();
    });
  });

  document.querySelectorAll('.toggle-btn[data-visibility]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-btn[data-visibility]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  const tagsInput = document.getElementById('tagsInput');
  if (tagsInput) {
    tagsInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const tag = tagsInput.value.trim().toLowerCase();
        if (tag && tag.length <= 20) {
          const currentTags = UI.getCurrentTags();
          if (!currentTags.includes(tag) && currentTags.length < 5) {
            currentTags.push(tag);
            UI.renderTags(currentTags);
          }
        }
        tagsInput.value = '';
      }
    });
  }

  document.querySelectorAll('.toolbar-btn[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (Editor.actions[action]) {
        Editor.actions[action]();
      }
    });
  });

  const writingContent = document.getElementById('writingContent');
  if (writingContent) {
    writingContent.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'b') {
          e.preventDefault();
          Editor.actions.bold();
        } else if (e.key === 'i') {
          e.preventDefault();
          Editor.actions.italic();
        } else if (e.key === 's') {
          e.preventDefault();
          UI.saveWriting();
        }
      }
    });
  }

  const previewToggle = document.getElementById('previewToggle');
  if (previewToggle) {
    previewToggle.addEventListener('click', () => {
      Editor.togglePreview();
    });
  }

  const saveWriting = document.getElementById('saveWriting');
  if (saveWriting) {
    saveWriting.addEventListener('click', () => {
      UI.saveWriting();
    });
  }

  const editFromRead = document.getElementById('editFromRead');
  if (editFromRead) {
    editFromRead.addEventListener('click', () => {
      UI.openEditor(state.currentWritingId);
    });
  }

  const deleteFromRead = document.getElementById('deleteFromRead');
  if (deleteFromRead) {
    deleteFromRead.addEventListener('click', () => {
      UI.showDeleteModal();
    });
  }

  document.getElementById('cancelDelete').addEventListener('click', () => {
    UI.hideDeleteModal();
  });

  document.getElementById('confirmDelete').addEventListener('click', () => {
    UI.hideDeleteModal();
    UI.deleteWriting(state.currentWritingId);
  });

  document.getElementById('deleteModal').addEventListener('click', (e) => {
    if (e.target.id === 'deleteModal') {
      UI.hideDeleteModal();
    }
  });

  document.getElementById('loginModal').addEventListener('click', (e) => {
    if (e.target.id === 'loginModal') {
      UI.hideLoginModal();
    }
  });

  const saveProfile = document.getElementById('saveProfile');
  if (saveProfile) {
    saveProfile.addEventListener('click', () => {
      UI.saveProfile();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      UI.hideDeleteModal();
      UI.hideLoginModal();
    }
  });
}

// ========================================
// Initialize Application
// ========================================

async function init() {
  Storage.loadLocal();
  initializeEventListeners();
  UI.updateAdminUI();
  await UI.renderWritingsGrid();

  const defaultFilter = document.querySelector('.filter-btn[data-visibility="all"]');
  if (defaultFilter) {
    defaultFilter.classList.add('active');
  }
}

document.addEventListener('DOMContentLoaded', init);
