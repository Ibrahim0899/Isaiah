/* ========================================
   Isaiah Application
   Personal Writing Platform
   ======================================== */

// ========================================
// Data Types & Constants
// ========================================

const STORAGE_KEYS = {
  writings: 'isaiah_writings',
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
  isAdmin: false
};

// ========================================
// Admin Authentication
// ========================================

const Admin = {
  // Check if user is authenticated as admin
  isAuthenticated() {
    const session = Storage.get(STORAGE_KEYS.adminSession);
    if (session && session.expires > Date.now()) {
      state.isAdmin = true;
      return true;
    }
    state.isAdmin = false;
    return false;
  },

  // Login with password
  login(password) {
    if (password === ADMIN_PASSWORD) {
      // Session expires in 24 hours
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

  // Logout
  logout() {
    localStorage.removeItem(STORAGE_KEYS.adminSession);
    state.isAdmin = false;
    UI.updateAdminUI();
    UI.navigateTo('home');
    UI.toast('Déconnecté', 'success');
  }
};

// ========================================
// Storage Operations
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

  loadAll() {
    state.writings = Storage.get(STORAGE_KEYS.writings) || [];
    state.profile = Storage.get(STORAGE_KEYS.profile) || { name: 'Isaiah', bio: '' };

    const savedTheme = Storage.get(STORAGE_KEYS.theme);
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }

    // Check admin session
    Admin.isAuthenticated();
  },

  saveWritings() {
    Storage.set(STORAGE_KEYS.writings, state.writings);
  },

  saveProfile() {
    Storage.set(STORAGE_KEYS.profile, state.profile);
  },

  saveTheme(theme) {
    Storage.set(STORAGE_KEYS.theme, theme);
  }
};

// ========================================
// Writing CRUD Operations
// ========================================

const Writings = {
  create(data) {
    if (!state.isAdmin) return null;

    const writing = {
      id: crypto.randomUUID(),
      title: data.title || 'Sans titre',
      content: data.content || '',
      excerpt: this.createExcerpt(data.content || ''),
      tags: data.tags || [],
      category: data.category || 'other',
      visibility: data.visibility || 'private',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    state.writings.unshift(writing);
    Storage.saveWritings();
    return writing;
  },

  update(id, data) {
    if (!state.isAdmin) return null;

    const index = state.writings.findIndex(w => w.id === id);
    if (index === -1) return null;

    const writing = state.writings[index];
    const updated = {
      ...writing,
      ...data,
      excerpt: this.createExcerpt(data.content || writing.content),
      updatedAt: new Date().toISOString()
    };

    state.writings[index] = updated;
    Storage.saveWritings();
    return updated;
  },

  delete(id) {
    if (!state.isAdmin) return false;

    const index = state.writings.findIndex(w => w.id === id);
    if (index === -1) return false;

    state.writings.splice(index, 1);
    Storage.saveWritings();
    return true;
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
        true; // Non-admin always sees only public
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
// Markdown Parser (Simple)
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
  // Update UI based on admin status
  updateAdminUI() {
    const adminElements = document.querySelectorAll('.admin-only');
    const visitorElements = document.querySelectorAll('.visitor-only');
    const adminBtn = document.getElementById('adminBtn');

    if (state.isAdmin) {
      adminElements.forEach(el => el.style.display = '');
      visitorElements.forEach(el => el.style.display = 'none');
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
      adminElements.forEach(el => el.style.display = 'none');
      visitorElements.forEach(el => el.style.display = '');
      adminBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      `;
      adminBtn.title = 'Connexion Admin';
      adminBtn.classList.remove('logged-in');
    }

    // Update filters visibility
    const visibilityFilters = document.querySelector('.filter-group[data-admin-only]');
    if (visibilityFilters) {
      visibilityFilters.style.display = state.isAdmin ? 'flex' : 'none';
    }

    this.renderWritingsGrid();
  },

  // Toast Notifications
  toast(message, type = 'default') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  },

  // Navigation
  navigateTo(page) {
    // Protect admin-only pages
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
        this.renderWritingsGrid();
      } else if (page === 'profile') {
        this.renderProfile();
      }
    }
  },

  // Render writings grid on home page
  renderWritingsGrid() {
    const grid = document.getElementById('writingsGrid');
    const emptyState = document.getElementById('emptyState');
    const writings = Writings.getFiltered();

    // Update empty state message based on admin status
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
        <p class="card-excerpt">${this.escapeHtml(writing.excerpt)}</p>
        <div class="card-footer">
          <span class="card-date">${this.formatDate(writing.createdAt)}</span>
          <div class="card-tags">
            ${writing.tags.slice(0, 3).map(tag => `<span class="card-tag">${this.escapeHtml(tag)}</span>`).join('')}
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

  // Open reading view
  openReading(id) {
    const writing = Writings.get(id);
    if (!writing) return;

    // Non-admin can only view public writings
    if (!state.isAdmin && writing.visibility !== 'public') {
      this.toast('Cet écrit est privé', 'error');
      return;
    }

    state.currentWritingId = id;

    document.getElementById('readCategory').textContent = CATEGORIES[writing.category];
    document.getElementById('readDate').textContent = this.formatDate(writing.createdAt);
    document.getElementById('readVisibility').textContent = writing.visibility === 'public' ? '🌍 Public' : '🔒 Privé';
    document.getElementById('readVisibility').style.display = state.isAdmin ? '' : 'none';
    document.getElementById('readTitle').textContent = writing.title;
    document.getElementById('readTags').innerHTML = writing.tags.map(tag =>
      `<span class="reading-tag">#${this.escapeHtml(tag)}</span>`
    ).join('');
    document.getElementById('readContent').innerHTML = Markdown.parse(writing.content);

    // Show/hide admin controls
    const readingFooter = document.querySelector('.reading-footer');
    readingFooter.style.display = state.isAdmin ? 'flex' : 'none';

    this.navigateTo('read');
  },

  // Open editor for new or existing writing
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

  // Render tags in editor
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

  // Save current writing
  saveWriting() {
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
      Writings.update(state.currentWritingId, data);
      this.toast('Écrit mis à jour ✓', 'success');
    } else {
      const writing = Writings.create(data);
      state.currentWritingId = writing.id;
      this.toast('Écrit sauvegardé ✓', 'success');
    }

    this.navigateTo('home');
  },

  // Delete writing
  deleteWriting(id) {
    if (!state.isAdmin) {
      this.toast('Accès non autorisé', 'error');
      return;
    }

    if (Writings.delete(id)) {
      this.toast('Écrit supprimé', 'success');
      this.navigateTo('home');
    }
  },

  // Render profile page
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
          <p class="card-excerpt">${this.escapeHtml(writing.excerpt)}</p>
          <div class="card-footer">
            <span class="card-date">${this.formatDate(writing.createdAt)}</span>
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

  // Toggle theme
  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    Storage.saveTheme(next);
  },

  // Helper: Format date
  formatDate(isoString) {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  },

  // Helper: Escape HTML
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // Modal helpers
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
// Editor Toolbar Actions
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
  // Navigation links
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

  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', () => {
    UI.toggleTheme();
  });

  // Admin button
  document.getElementById('adminBtn').addEventListener('click', () => {
    if (state.isAdmin) {
      Admin.logout();
    } else {
      UI.showLoginModal();
    }
  });

  // Login form
  document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const password = document.getElementById('adminPassword').value;
    Admin.login(password);
  });

  document.getElementById('cancelLogin').addEventListener('click', () => {
    UI.hideLoginModal();
  });

  // Filter buttons - Category
  document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filters.category = btn.dataset.filter;
      UI.renderWritingsGrid();
    });
  });

  // Filter buttons - Visibility  
  document.querySelectorAll('.filter-btn[data-visibility]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn[data-visibility]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filters.visibility = btn.dataset.visibility;
      UI.renderWritingsGrid();
    });
  });

  // Visibility toggle in editor
  document.querySelectorAll('.toggle-btn[data-visibility]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-btn[data-visibility]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Tags input
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

  // Toolbar buttons
  document.querySelectorAll('.toolbar-btn[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (Editor.actions[action]) {
        Editor.actions[action]();
      }
    });
  });

  // Keyboard shortcuts in editor
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

  // Preview toggle
  const previewToggle = document.getElementById('previewToggle');
  if (previewToggle) {
    previewToggle.addEventListener('click', () => {
      Editor.togglePreview();
    });
  }

  // Save writing
  const saveWriting = document.getElementById('saveWriting');
  if (saveWriting) {
    saveWriting.addEventListener('click', () => {
      UI.saveWriting();
    });
  }

  // Edit from reading view
  const editFromRead = document.getElementById('editFromRead');
  if (editFromRead) {
    editFromRead.addEventListener('click', () => {
      UI.openEditor(state.currentWritingId);
    });
  }

  // Delete from reading view
  const deleteFromRead = document.getElementById('deleteFromRead');
  if (deleteFromRead) {
    deleteFromRead.addEventListener('click', () => {
      UI.showDeleteModal();
    });
  }

  // Delete modal
  document.getElementById('cancelDelete').addEventListener('click', () => {
    UI.hideDeleteModal();
  });

  document.getElementById('confirmDelete').addEventListener('click', () => {
    UI.hideDeleteModal();
    UI.deleteWriting(state.currentWritingId);
  });

  // Close modal on overlay click
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

  // Save profile
  const saveProfile = document.getElementById('saveProfile');
  if (saveProfile) {
    saveProfile.addEventListener('click', () => {
      UI.saveProfile();
    });
  }

  // Close modal with Escape key
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

function init() {
  Storage.loadAll();
  initializeEventListeners();
  UI.updateAdminUI();
  UI.renderWritingsGrid();

  // Set default filter
  const defaultFilter = document.querySelector('.filter-btn[data-visibility="all"]');
  if (defaultFilter) {
    defaultFilter.classList.add('active');
  }
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
