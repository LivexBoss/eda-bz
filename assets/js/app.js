/* ==========================================================================
   Будь Здоров — режим «мини-приложения» на телефоне
   - нижняя панель вкладок
   - установка на главный экран (PWA)
   - интеграция с Telegram Mini App
   Модуль независим: если удалить app.js и app.css, сайт работает как обычно.
   ========================================================================== */
(function () {
    'use strict';

    const $ = (sel, root = document) => root.querySelector(sel);
    const root = document.documentElement;
    const PHONE = '+79612948885';

    const ICONS = {
        home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
        services: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
        gallery: '<rect width="18" height="18" x="3" y="3" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
        contacts: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
        phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>',
        download: '<path d="M12 15V3"/><path d="m7 10 5 5 5-5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
        share: '<path d="M12 2v13"/><path d="m16 6-4-4-4 4"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>'
    };
    const icon = (name) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

    /* ---------- Haptics ---------- */
    let tg = null;
    function haptic(kind = 'light') {
        if (tg && tg.HapticFeedback) {
            try {
                if (kind === 'select') tg.HapticFeedback.selectionChanged();
                else tg.HapticFeedback.impactOccurred(kind);
            } catch (e) {}
            return;
        }
        if (navigator.vibrate) navigator.vibrate(kind === 'medium' ? 12 : 6);
    }

    /* ---------- Bottom tab bar ---------- */
    const TABS = [
        { id: 'home', href: '#hero', label: 'Главная', icon: 'home' },
        { id: 'services', href: '#services', label: 'Услуги', icon: 'services' },
        { id: 'call', href: 'tel:' + PHONE, label: 'Позвонить', icon: 'phone', call: true },
        { id: 'gallery', href: '#gallery', label: 'Кухня', icon: 'gallery' },
        { id: 'contacts', href: '#contacts', label: 'Контакты', icon: 'contacts' }
    ];
    // какой вкладке соответствует каждый раздел страницы
    const SECTION_TO_TAB = {
        hero: 'home', about: 'home',
        services: 'services', delivery: 'services',
        gallery: 'gallery', kitchen: 'gallery',
        reviews: 'contacts', contacts: 'contacts'
    };

    const bar = document.createElement('nav');
    bar.className = 'tabbar';
    bar.setAttribute('aria-label', 'Быстрая навигация');
    bar.innerHTML = TABS.map((t) => t.call
        ? `<a class="tab tab-call" href="${t.href}" data-tab="${t.id}"><span class="tab-call-btn">${icon(t.icon)}</span><span class="tab-label">${t.label}</span></a>`
        : `<a class="tab" href="${t.href}" data-tab="${t.id}"><span class="tab-ic">${icon(t.icon)}</span><span class="tab-label">${t.label}</span></a>`
    ).join('');
    document.body.appendChild(bar);
    root.classList.add('has-tabbar');

    function setTab(id) {
        bar.querySelectorAll('.tab').forEach((a) => {
            const on = a.dataset.tab === id;
            a.classList.toggle('active', on);
            if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
    }
    setTab('home');
    const sectionIO = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) setTab(SECTION_TO_TAB[entry.target.id] || 'home');
        });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('#hero, main section[id]').forEach((s) => sectionIO.observe(s));

    bar.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab');
        if (!tab) return;
        haptic(tab.dataset.tab === 'call' ? 'medium' : 'select');
        if (tab.dataset.tab === 'home') {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    // Панель прячется, пока открыто меню или просмотр фото
    document.addEventListener('eda:lightbox', (e) => bar.classList.toggle('tabbar-hidden', e.detail.open));

    /* ---------- Установка на главный экран ---------- */
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) root.classList.add('is-standalone');

    const menuFoot = $('.mobile-menu-foot');
    let deferredPrompt = null;

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (!menuFoot || $('.install-btn', menuFoot)) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-yellow btn-block install-btn';
        btn.innerHTML = `${icon('download')} Установить приложение`;
        btn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            const choice = await deferredPrompt.userChoice.catch(() => null);
            deferredPrompt = null;
            btn.remove();
            if (choice && choice.outcome === 'accepted' && window.EDA) window.EDA.toast('Приложение установлено');
        });
        menuFoot.appendChild(btn);
    });

    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isTelegram = /tgWebApp/i.test(location.hash + location.search);
    if (isIOS && !isStandalone && !isTelegram && menuFoot) {
        const hint = document.createElement('p');
        hint.className = 'install-hint';
        hint.innerHTML = `${icon('share')}<span>Добавьте сайт на экран «Домой»: нажмите «Поделиться», затем «На экран “Домой”»</span>`;
        menuFoot.appendChild(hint);
    }

    /* ---------- Telegram Mini App ---------- */
    if (!isTelegram) return;
    root.classList.add('tg-app');

    const s = document.createElement('script');
    s.src = 'https://telegram.org/js/telegram-web-app.js';
    s.onload = initTelegram;
    document.head.appendChild(s);

    function initTelegram() {
        tg = window.Telegram && window.Telegram.WebApp;
        if (!tg) return;
        tg.ready();
        tg.expand();
        if (tg.isVersionAtLeast && tg.isVersionAtLeast('7.7') && tg.disableVerticalSwipes) tg.disableVerticalSwipes();

        // тема — как в Telegram (если пользователь не выбрал сам)
        const syncTheme = () => {
            let stored = null;
            try { stored = localStorage.getItem('theme'); } catch (e) {}
            if (!stored && (tg.colorScheme === 'dark' || tg.colorScheme === 'light')) {
                root.dataset.theme = tg.colorScheme;
            }
            paintChrome();
        };
        const paintChrome = () => {
            const bg = getComputedStyle(root).getPropertyValue('--bg').trim() || '#FFFDF9';
            try {
                if (tg.isVersionAtLeast('6.1')) {
                    tg.setHeaderColor(bg);
                    tg.setBackgroundColor(bg);
                }
                if (tg.isVersionAtLeast('7.10') && tg.setBottomBarColor) tg.setBottomBarColor(bg);
            } catch (e) {}
        };
        syncTheme();
        tg.onEvent('themeChanged', syncTheme);
        document.addEventListener('eda:theme', paintChrome);

        // Ссылки t.me открываем прямо в Telegram, остальные — во внешнем браузере
        document.addEventListener('click', (e) => {
            const a = e.target.closest('a[href^="http"]');
            if (!a) return;
            const url = a.href;
            e.preventDefault();
            if (/^https:\/\/t\.me\//.test(url) && tg.openTelegramLink) tg.openTelegramLink(url);
            else tg.openLink(url);
        });

        // Кнопка «Назад» закрывает меню и просмотр фото
        const back = tg.BackButton;
        let overlays = 0;
        const updateBack = () => { overlays > 0 ? back.show() : back.hide(); };
        back.onClick(() => {
            if (window.EDA && window.EDA.closeLightbox) window.EDA.closeLightbox();
            if (window.EDA && window.EDA.setMenu) window.EDA.setMenu(false);
        });
        document.addEventListener('eda:lightbox', (e) => { overlays = e.detail.open ? 1 : 0; updateBack(); });
        const menu = $('#mobileMenu');
        if (menu) {
            new MutationObserver(() => {
                overlays = menu.classList.contains('open') || ($('#lightbox') && $('#lightbox').open) ? 1 : 0;
                updateBack();
            }).observe(menu, { attributes: true, attributeFilter: ['class'] });
        }

        // Тактильный отклик на кнопки
        document.addEventListener('click', (e) => {
            if (e.target.closest('.btn, .g-item, .round-btn, .icon-btn, .service-link, .hero-logo')) haptic('light');
        }, true);
    }
})();
