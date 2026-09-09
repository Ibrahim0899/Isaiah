/**
 * Le Livre d'Isaiah — Moteur de Lecture Littéraire
 * Gestion des livres, accordéons, résumés énigmatiques, thèmes et typographie
 */

(function () {
  'use strict';

  // ==========================================================================
  // État de l'Application
  // ==========================================================================
  const State = {
    activeBook: 'all',
    searchQuery: '',
    fontSize: localStorage.getItem('isaiah_font_size') || 'medium',
    theme: localStorage.getItem('isaiah_theme') || 'light',
    openWritings: new Set(),
    allExpanded: false
  };

  // ==========================================================================
  // Sélecteurs DOM
  // ==========================================================================
  const DOM = {
    html: document.documentElement,
    bookNav: document.getElementById('bookNav'),
    booksContainer: document.getElementById('booksContainer'),
    themeToggle: document.getElementById('themeToggle'),
    fontDecrease: document.getElementById('fontDecrease'),
    fontIncrease: document.getElementById('fontIncrease'),
    toggleAllBtn: document.getElementById('toggleAllBtn'),
    searchToggle: document.getElementById('searchToggle'),
    searchPopover: document.getElementById('searchPopover'),
    searchInput: document.getElementById('bookSearchInput'),
    searchCount: document.getElementById('searchCount'),
    currentYear: document.getElementById('currentYear')
  };

  function getBookConfig() {
    return window.BOOK_CONFIG || (typeof BOOK_CONFIG !== 'undefined' ? BOOK_CONFIG : null);
  }

  // ==========================================================================
  // Initialisation & Rendu
  // ==========================================================================
  function init() {
    applyTheme(State.theme);
    applyFontSize(State.fontSize);
    renderBookNav();
    renderBooks();
    attachEventListeners();

    if (DOM.currentYear) {
      DOM.currentYear.textContent = new Date().getFullYear();
    }
  }

  // ==========================================================================
  // Navigation & Rendu des Onglets de Livres
  // ==========================================================================
  function renderBookNav() {
    const config = getBookConfig();
    if (!DOM.bookNav || !config) return;

    // Conserver le bouton "Tous les Livres"
    let navHtml = `<button class="book-tab active" data-book="all">Tous les Livres</button>`;

    config.books.forEach(book => {
      navHtml += `
        <button class="book-tab" data-book="${escapeHtml(book.id)}">
          ${escapeHtml(book.number)}
        </button>
      `;
    });

    DOM.bookNav.innerHTML = navHtml;
  }

  function matchesQuery(w, query) {
    if (!query) return true;
    return (
      (w.title && w.title.toLowerCase().includes(query)) ||
      (w.subtitle && w.subtitle.toLowerCase().includes(query)) ||
      (w.teaser && w.teaser.toLowerCase().includes(query)) ||
      (w.content && w.content.toLowerCase().includes(query)) ||
      (w.category && w.category.toLowerCase().includes(query))
    );
  }

  // ==========================================================================
  // Rendu Principal des Livres et Déroulés
  // ==========================================================================
  function renderBooks() {
    const config = getBookConfig();
    if (!DOM.booksContainer || !config) return;

    const query = State.searchQuery.toLowerCase().trim();
    let totalMatches = 0;
    let containerHtml = '';

    const booksToRender = State.activeBook === 'all'
      ? config.books
      : config.books.filter(b => b.id === State.activeBook);

    booksToRender.forEach(book => {
      // Récupérer l'ensemble des écrits du livre (via parts ou writings)
      let allWritings = [];
      if (book.parts && Array.isArray(book.parts)) {
        book.parts.forEach(part => {
          allWritings = allWritings.concat(part.writings || []);
        });
      } else if (book.writings && Array.isArray(book.writings)) {
        allWritings = book.writings;
      }

      // Filtrage par recherche
      const bookMatchingWritings = allWritings.filter(w => matchesQuery(w, query));

      if (bookMatchingWritings.length === 0 && query) {
        return; // Masquer ce livre si aucun écrit ne correspond à la recherche
      }

      totalMatches += bookMatchingWritings.length;

      let bookContentHtml = '';

      if (book.parts && Array.isArray(book.parts)) {
        book.parts.forEach(part => {
          const matchingPartWritings = (part.writings || []).filter(w => matchesQuery(w, query));
          if (matchingPartWritings.length === 0 && query) return;

          bookContentHtml += `
            <div class="part-section-divider" id="${escapeHtml(part.id)}">
              <div class="part-badge-row">
                <span class="part-badge">${escapeHtml(part.badge)}</span>
                <span class="part-count">${matchingPartWritings.length} texte${matchingPartWritings.length > 1 ? 's' : ''}</span>
              </div>
              <h3 class="part-title">${escapeHtml(part.title)}</h3>
              ${part.subtitle ? `<p class="part-subtitle">${escapeHtml(part.subtitle)}</p>` : ''}
              ${part.functionNote ? `<div class="part-function-badge"><span>✦</span> ${escapeHtml(part.functionNote)}</div>` : ''}
            </div>

            <div class="writings-list" style="margin-bottom: 2.2rem;">
              ${matchingPartWritings.length > 0
                ? matchingPartWritings.map(writing => renderWritingAccordion(writing, book.id)).join('')
                : ''
              }
            </div>
          `;
        });
      } else {
        bookContentHtml = `
          <div class="writings-list">
            ${bookMatchingWritings.length > 0 
              ? bookMatchingWritings.map(writing => renderWritingAccordion(writing, book.id)).join('')
              : `
                <div class="cover-card" style="padding: 2.5rem 1.5rem; text-align: center; border-style: dashed;">
                  <div class="cover-ornament top">✦ ✦ ✦</div>
                  <p style="font-family: var(--font-serif); font-size: 1.25rem; font-style: italic; color: var(--text-secondary); margin-bottom: 0.5rem;">
                    Les pages de ce livre sont ouvertes et prêtes à être reliées...
                  </p>
                  <span style="font-family: var(--font-sans); font-size: 0.85rem; color: var(--text-muted); letter-spacing: 0.05em;">
                    Les écrits d'Isaiah arrivent dans un instant.
                  </span>
                  <div class="cover-ornament bottom" style="margin-top: 1.2rem;">❦</div>
                </div>
              `
            }
          </div>
        `;
      }

      containerHtml += `
        <section class="book-section" id="${escapeHtml(book.id)}">
          <header class="book-section-header">
            <div class="book-badge-row">
              <span class="book-roman-badge">${escapeHtml(book.number)} • ${escapeHtml(book.roman)}</span>
              <span class="book-count-badge">${bookMatchingWritings.length} texte${bookMatchingWritings.length > 1 ? 's' : ''}</span>
            </div>
            <h2 class="book-main-title">${escapeHtml(book.title)}</h2>
            <p class="book-subtitle">${escapeHtml(book.subtitle)}</p>
            ${book.epigraph ? `<blockquote class="book-epigraph">${escapeHtml(book.epigraph)}</blockquote>` : ''}
          </header>

          ${bookContentHtml}
        </section>
      `;
    });

    if (totalMatches === 0 && query) {
      containerHtml = `
        <div class="cover-card" style="margin-top: 2rem; text-align: center;">
          <div class="cover-ornament top">✦ ✦ ✦</div>
          <p style="font-size: 1.25rem; font-style: italic; color: var(--text-secondary); margin-bottom: 1rem;">
            Aucun écrit ne correspond à « <strong>${escapeHtml(query)}</strong> ».
          </p>
          <button class="book-tab active" id="resetSearchBtn" style="margin: 0 auto;">
            Effacer la recherche
          </button>
        </div>
      `;
    }

    DOM.booksContainer.innerHTML = containerHtml;

    if (DOM.searchCount && query) {
      DOM.searchCount.textContent = `${totalMatches} résultat${totalMatches > 1 ? 's' : ''}`;
    } else if (DOM.searchCount) {
      DOM.searchCount.textContent = '';
    }

    // Réattacher l'action sur le bouton de réinitialisation si présent
    const resetBtn = document.getElementById('resetSearchBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        State.searchQuery = '';
        if (DOM.searchInput) DOM.searchInput.value = '';
        renderBooks();
      });
    }

    // Restaurer l'état ouvert des accordéons
    State.openWritings.forEach(id => {
      const el = document.getElementById(`accordion-${id}`);
      if (el) {
        el.classList.add('is-open');
        updateAccordionAria(el, true);
      }
    });
  }

  // ==========================================================================
  // Rendu d'un Accordéon Déroulé (Titre + Résumé Énigmatique + Texte)
  // ==========================================================================
  function renderWritingAccordion(writing, bookId) {
    const isOpen = State.openWritings.has(writing.id);
    const paragraphs = writing.content.split('\n\n').filter(p => p.trim().length > 0);

    return `
      <article class="text-accordion ${isOpen ? 'is-open' : ''}" id="accordion-${escapeHtml(writing.id)}" data-writing-id="${escapeHtml(writing.id)}" data-book-id="${escapeHtml(bookId)}">
        <!-- En-tête Cliquable / Déroulé -->
        <button class="accordion-header" 
                aria-expanded="${isOpen ? 'true' : 'false'}" 
                aria-controls="collapse-${escapeHtml(writing.id)}"
                id="header-${escapeHtml(writing.id)}">
          
          <span class="chapter-numeral">${escapeHtml(writing.number || '•')}</span>
          
          <div class="header-main-info">
            <h3 class="text-title">${escapeHtml(writing.title)}</h3>
            ${writing.subtitle ? `<div class="text-subtitle" style="font-family: var(--font-serif); font-size: 1.08rem; color: var(--accent-gold); font-style: italic; margin-top: -0.1rem; margin-bottom: 0.15rem;">${escapeHtml(writing.subtitle)}</div>` : ''}
            
            <!-- Le Résumé -->
            <div class="enigmatic-teaser-box">
              <span class="teaser-label">
                <span class="teaser-label-glyph">✦</span> Résumé
              </span>
              <p class="teaser-text">${escapeHtml(writing.teaser)}</p>
            </div>
          </div>

          <div class="header-meta-actions">
            <div class="meta-tags">
              <span class="meta-tag">${escapeHtml(writing.category || 'Poésie')}</span>
              <span class="meta-time">${escapeHtml(writing.readTime || '3 min')}</span>
            </div>
            <span class="unfold-badge">
              <span class="unfold-text">${isOpen ? 'Fermer' : 'Lire'}</span>
              <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </span>
          </div>
        </button>

        <!-- Contenu Déroulé Intégral -->
        <div class="accordion-collapse" id="collapse-${escapeHtml(writing.id)}" role="region" aria-labelledby="header-${escapeHtml(writing.id)}">
          <div class="accordion-inner">
            <div class="reading-body">
              <div class="reading-ornament-divider">✦ &nbsp; ❦ &nbsp; ✦</div>
              
              <div class="reading-prose">
                ${paragraphs.map(para => {
                  const trimmed = para.trim();
                  const isSignature = /^(Ton fils|Isaiah|Ibrahima NIASSE)/i.test(trimmed);
                  const isShortLine = trimmed.length < 50 && !trimmed.includes('\n');
                  const pClass = isSignature ? 'reading-signature' : (isShortLine ? 'prose-p prose-short' : 'prose-p');
                  return `<p class="${pClass}">${escapeHtml(para).replace(/\n/g, '<br>')}</p>`;
                }).join('')}
              </div>

              <footer class="reading-footer">
                <span class="reading-date-badge">${writing.date ? `Composé en ${escapeHtml(writing.date)}` : 'Écrit d\'Isaiah'}</span>
                
                <button class="fold-back-btn" data-fold="${escapeHtml(writing.id)}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="18 15 12 9 6 15"></polyline>
                  </svg>
                  Replier cet écrit
                </button>
              </footer>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  // ==========================================================================
  // Gestion du Déroulé (Ouverture / Fermeture)
  // ==========================================================================
  function toggleAccordion(writingId, forceState = null) {
    const accordion = document.getElementById(`accordion-${writingId}`);
    if (!accordion) return;

    const willOpen = forceState !== null ? forceState : !accordion.classList.contains('is-open');

    if (willOpen) {
      accordion.classList.add('is-open');
      State.openWritings.add(writingId);
    } else {
      accordion.classList.remove('is-open');
      State.openWritings.delete(writingId);
    }

    updateAccordionAria(accordion, willOpen);
  }

  function updateAccordionAria(accordion, isOpen) {
    const headerBtn = accordion.querySelector('.accordion-header');
    const unfoldText = accordion.querySelector('.unfold-text');

    if (headerBtn) {
      headerBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
    if (unfoldText) {
      unfoldText.textContent = isOpen ? 'Fermer' : 'Lire';
    }
  }

  // ==========================================================================
  // Gestionnaires d'Événements
  // ==========================================================================
  function attachEventListeners() {
    // 1. Clic sur la liste des livres / accordéons (délégation d'événements)
    if (DOM.booksContainer) {
      DOM.booksContainer.addEventListener('click', (e) => {
        // Clic sur le bouton de repli bas de page
        const foldBtn = e.target.closest('.fold-back-btn');
        if (foldBtn) {
          const id = foldBtn.dataset.fold;
          toggleAccordion(id, false);
          const header = document.getElementById(`header-${id}`);
          if (header) {
            header.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }

        // Clic sur l'en-tête du déroulé
        const headerBtn = e.target.closest('.accordion-header');
        if (headerBtn) {
          const accordion = headerBtn.closest('.text-accordion');
          if (accordion) {
            const id = accordion.dataset.writingId;
            toggleAccordion(id);
          }
          return;
        }
      });
    }

    // 2. Onglets de Navigation des Livres
    if (DOM.bookNav) {
      DOM.bookNav.addEventListener('click', (e) => {
        const tab = e.target.closest('.book-tab');
        if (!tab) return;

        DOM.bookNav.querySelectorAll('.book-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        State.activeBook = tab.dataset.book;
        renderBooks();

        // Si un livre spécifique est choisi, faire défiler doucement vers le haut de la section
        if (State.activeBook !== 'all') {
          const targetSection = document.getElementById(State.activeBook);
          if (targetSection) {
            targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    }

    // 3. Bascule Thème Jour / Nuit
    if (DOM.themeToggle) {
      DOM.themeToggle.addEventListener('click', () => {
        const nextTheme = State.theme === 'light' ? 'dark' : 'light';
        applyTheme(nextTheme);
      });
    }

    // 4. Tailles de Police (A- / A+)
    if (DOM.fontDecrease) {
      DOM.fontDecrease.addEventListener('click', () => {
        if (State.fontSize === 'large') applyFontSize('medium');
        else if (State.fontSize === 'medium') applyFontSize('small');
      });
    }

    if (DOM.fontIncrease) {
      DOM.fontIncrease.addEventListener('click', () => {
        if (State.fontSize === 'small') applyFontSize('medium');
        else if (State.fontSize === 'medium') applyFontSize('large');
      });
    }

    // 5. Tout Déplier / Tout Replier
    if (DOM.toggleAllBtn) {
      DOM.toggleAllBtn.addEventListener('click', () => {
        State.allExpanded = !State.allExpanded;
        const accordions = document.querySelectorAll('.text-accordion');

        accordions.forEach(acc => {
          const id = acc.dataset.writingId;
          toggleAccordion(id, State.allExpanded);
        });

        const tooltip = DOM.toggleAllBtn.querySelector('.btn-tooltip');
        if (tooltip) {
          tooltip.textContent = State.allExpanded ? 'Tout replier' : 'Tout déplier';
        }
      });
    }

    // 6. Recherche Rapide
    if (DOM.searchToggle && DOM.searchPopover) {
      DOM.searchToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        DOM.searchPopover.classList.toggle('hidden');
        if (!DOM.searchPopover.classList.contains('hidden') && DOM.searchInput) {
          DOM.searchInput.focus();
        }
      });

      document.addEventListener('click', (e) => {
        if (!DOM.searchPopover.contains(e.target) && e.target !== DOM.searchToggle) {
          DOM.searchPopover.classList.add('hidden');
        }
      });
    }

    if (DOM.searchInput) {
      let debounceTimer;
      DOM.searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          State.searchQuery = e.target.value;
          renderBooks();
        }, 180);
      });
    }
  }

  // ==========================================================================
  // Utilitaires de Thème et Typographie
  // ==========================================================================
  function applyTheme(theme) {
    State.theme = theme;
    DOM.html.setAttribute('data-theme', theme);
    localStorage.setItem('isaiah_theme', theme);
  }

  function applyFontSize(size) {
    State.fontSize = size;
    DOM.html.setAttribute('data-font-size', size);
    localStorage.setItem('isaiah_font_size', size);

    if (DOM.fontDecrease && DOM.fontIncrease) {
      DOM.fontDecrease.style.opacity = size === 'small' ? '0.4' : '1';
      DOM.fontIncrease.style.opacity = size === 'large' ? '0.4' : '1';
    }
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Démarrage
  document.addEventListener('DOMContentLoaded', init);
})();
