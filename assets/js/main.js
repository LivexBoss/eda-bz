/* ==========================================================================
   Будь Здоров — интерактив сайта
   ========================================================================== */
(function () {
    'use strict';

    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const root = document.documentElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    /* ---------- Сайт всегда открывается с первого экрана ---------- */
    // Иначе браузер восстанавливает прежнюю прокрутку или переходит к #разделу из адреса,
    // и заставку не видно. Ярлыки приложения (?source=app#services…) по-прежнему ведут в раздел.
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const fromAppShortcut = /[?&]source=app\b/.test(location.search);
    const hashSection = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
    if (!(hashSection && fromAppShortcut)) {
        if (hashSection) history.replaceState(null, '', location.pathname + location.search);
        const toTop = () => window.scrollTo({ top: 0, behavior: 'instant' });
        let userScrolled = false;
        ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((type) =>
            window.addEventListener(type, () => { userScrolled = true; }, { once: true, passive: true }));
        toTop();
        window.addEventListener('load', () => { if (!userScrolled) toTop(); }, { once: true });
    }

    /* ---------- Toast ---------- */
    const toastEl = $('#toast');
    let toastTimer;
    function toast(text) {
        if (!toastEl) return;
        toastEl.textContent = text;
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
    }
    window.EDA = { toast };

    /* ---------- Theme ---------- */
    const THEME_COLORS = { light: '#FFFDF9', dark: '#13100E' };
    const metaTheme = $('#metaThemeColor');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

    function applyTheme(theme) {
        root.dataset.theme = theme;
        if (metaTheme) metaTheme.content = THEME_COLORS[theme];
        document.dispatchEvent(new CustomEvent('eda:theme', { detail: { theme } }));
    }
    function storedTheme() {
        try { return localStorage.getItem('theme'); } catch (e) { return null; }
    }
    applyTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');

    systemDark.addEventListener('change', (e) => {
        if (!storedTheme()) applyTheme(e.matches ? 'dark' : 'light');
    });

    const themeBtn = $('#themeToggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
            try { localStorage.setItem('theme', next); } catch (e) {}

            // Круговое «перетекание» темы от кнопки (View Transitions API)
            if (!document.startViewTransition || reduceMotion) { applyTheme(next); return; }
            const r = themeBtn.getBoundingClientRect();
            const x = r.left + r.width / 2;
            const y = r.top + r.height / 2;
            const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
            const vt = document.startViewTransition(() => applyTheme(next));
            vt.ready.then(() => {
                root.animate(
                    { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
                    { duration: 650, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' }
                );
            }).catch(() => {});
        });
    }

    /* ---------- Years since 5 May 1998 ---------- */
    const now = new Date();
    const years = now.getFullYear() - 1998 - ((now.getMonth() < 4 || (now.getMonth() === 4 && now.getDate() < 5)) ? 1 : 0);
    $$('[data-years]').forEach((el) => {
        el.textContent = years;
        if (el.hasAttribute('data-count')) el.dataset.count = years;
    });
    $$('[data-year]').forEach((el) => { el.textContent = now.getFullYear(); });

    /* ---------- Open / closed status (время московское) ---------- */
    const OPEN_MIN = 10 * 60;
    const CLOSE_MIN = 22 * 60;
    const statusEls = $$('[data-open-status]');
    function updateOpenStatus() {
        let h, m;
        try {
            const parts = new Intl.DateTimeFormat('ru-RU', {
                timeZone: 'Europe/Moscow', hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
            }).formatToParts(new Date());
            h = +parts.find((p) => p.type === 'hour').value;
            m = +parts.find((p) => p.type === 'minute').value;
        } catch (e) { return; }
        const mins = h * 60 + m;
        const open = mins >= OPEN_MIN && mins < CLOSE_MIN;
        let text;
        if (open) text = CLOSE_MIN - mins <= 60 ? 'Открыто · закроемся в 22:00' : 'Открыто сейчас · до 22:00';
        else text = mins < OPEN_MIN ? 'Закрыто · откроемся в 10:00' : 'Закрыто · откроемся завтра в 10:00';
        statusEls.forEach((el) => {
            el.classList.toggle('is-open', open);
            el.classList.toggle('is-closed', !open);
            const b = $('b', el);
            if (b) b.textContent = text;
        });
    }
    updateOpenStatus();
    setInterval(updateOpenStatus, 60 * 1000);

    /* ---------- Scroll-driven bits (один rAF на кадр) ---------- */
    const header = $('#header');
    const progressBar = $('#scrollProgress');
    const toTop = $('#toTop');
    const hero = $('#hero');
    const heroMedia = $('.hero-media');
    const heroContent = $('.hero-content');
    const kSub = $('.k-sub');
    const gTiles = $$('.g-item');
    let lastY = window.scrollY;
    let ticking = false;

    function onScroll() {
        const y = window.scrollY;
        const vh = window.innerHeight;
        const max = document.documentElement.scrollHeight - vh;
        const p = max > 0 ? Math.min(1, y / max) : 0;

        header.classList.toggle('scrolled', y > 40);
        // Шапка прячется при прокрутке вниз и возвращается при прокрутке вверх
        if (!document.body.classList.contains('menu-open')) {
            if (y > vh * 0.6 && y - lastY > 6) header.classList.add('hide');
            else if (lastY - y > 6 || y < vh * 0.6) header.classList.remove('hide');
        }
        lastY = y;

        if (progressBar) progressBar.style.transform = `scaleX(${p})`;
        if (toTop) {
            toTop.style.setProperty('--p', p.toFixed(4));
            toTop.classList.toggle('show', y > vh * 1.2);
        }

        if (!reduceMotion) {
            if (y < vh * 1.1 && heroMedia) {
                heroMedia.style.transform = `translate3d(0, ${y * 0.35}px, 0)`;
                if (heroContent) {
                    heroContent.style.transform = `translate3d(0, ${y * 0.18}px, 0)`;
                    heroContent.style.opacity = String(Math.max(0, 1 - y / (vh * 0.75)));
                }
            }
            if (kSub) {
                const r = kSub.getBoundingClientRect();
                if (r.bottom > 0 && r.top < vh) {
                    const offset = (r.top + r.height / 2 - vh / 2) * -0.08;
                    kSub.style.setProperty('--par', `${offset.toFixed(1)}px`);
                }
            }
            // фото в плитках галереи едут чуть медленнее рамки (сначала все замеры, потом запись)
            const rects = gTiles.map((tile) => tile.getBoundingClientRect());
            rects.forEach((r, i) => {
                if (r.bottom < 0 || r.top > vh) return;
                const k = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);
                gTiles[i].style.setProperty('--py', `${(k * r.height * -0.05).toFixed(1)}px`);
            });
        }
        ticking = false;
    }
    window.addEventListener('scroll', () => {
        if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    onScroll();

    /* ---------- Hero: логотип собирается из двух деталей — по законам физики ----------
       Салфетка с приборами вылетает из-под нижнего края (на 2/3 ширины экрана) и летит
       по параболе вверх-влево; надпись въезжает справа и, притормаживая, догоняет её.
       Удар неупругий: при касании тяжёлая надпись замедляется, лёгкая салфетка разгоняется,
       импульс сохраняется, и дальше обе детали скользят вместе по инерции, пока трение
       их не остановит. Скорости — в ширинах логотипа за секунду, время — в секундах. */
    const heroLogo = $('#heroLogo');
    const logo = heroLogo && {
        body: $('.logo-body', heroLogo),
        icon: $('.logo-icon', heroLogo),
        word: $('.logo-word', heroLogo),
        full: $('.logo-full', heroLogo),
        flash: $('.logo-flash', heroLogo),
        snaps: $$('.logo-snap i', heroLogo),
    };
    const canAssemble = !!(logo && logo.body && typeof heroLogo.animate === 'function' && !reduceMotion);
    const SNAP_ANGLES = [-62, -22, 18, 58, 122, 162, 202, 242];

    function assembleLogo() {
        const { body, icon, word, full, flash, snaps } = logo;
        const parts = [body, icon, word, full, flash, ...snaps];
        parts.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));

        const W = heroLogo.offsetWidth;
        const H = heroLogo.offsetHeight;
        const box = heroLogo.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];

        const T0 = 0.8;                    // касание обводок
        const SLIDE = 0.55;                // совместное скольжение до остановки
        const mWord = 0.77, mIcon = 0.23;  // «массы» — по площади деталей
        // на узком экране скорости меньше, чтобы в момент удара логотип не уезжал за край
        const room = (vw - 6 - box.right) / (0.44 * W * SLIDE);
        const fit = Math.min(1, Math.max(0.45, room));
        const vWord = [-1.07 * W * fit, -0.27 * W * fit];
        const vIcon = [-0.25 * W * fit, -0.05 * W * fit];
        const v = add([mWord * vWord[0], mWord * vWord[1]], vIcon, mIcon); // общая скорость после удара
        // при касании детали разнесены на ширину своих обводок; за время удара TM
        // надпись «вщёлкивается» в салфетку (постоянная сила контакта)
        const GAP = 0.042 * W;
        const TM = 2 * GAP / Math.abs(vWord[0] - vIcon[0]);
        const T1 = T0 + TM;
        const END = T1 + SLIDE;
        const D = [-v[0] * SLIDE / 2, -v[1] * SLIDE / 2];   // где логотип в конце удара: дальше равнозамедленно до нуля
        const iconT0 = add(D, add(vIcon, v), -TM / 2);      // где салфетка в момент касания
        const wordT0 = add(D, add(vWord, v), -TM / 2);      // …и надпись

        // Полёт салфетки: равноускоренно по каждой оси, к T0 — в точке касания со скоростью vIcon
        const iconFrom = [0.67 * vw - (box.left + 0.115 * W), vh + 0.55 * H - (box.top + 0.5 * H)];
        const aIcon = [0, 1].map((k) => 2 * (iconFrom[k] - iconT0[k] + vIcon[k] * T0) / (T0 * T0));
        const v0Icon = [0, 1].map((k) => vIcon[k] - aIcon[k] * T0);
        // Надпись: из-за правого края вдоль своего наклона, тормозит до скорости vWord
        const TW = 0.6;
        const speedW = Math.hypot(vWord[0], vWord[1]);
        const dirW = [-vWord[0] / speedW, -vWord[1] / speedW];
        const L = Math.max(speedW * TW, (vw + 12 - box.left - 0.146 * W - wordT0[0]) / dirW[0]);
        const v0W = 2 * L / TW - speedW;
        const decW = (v0W - speedW) / TW;
        const ROT0 = 70, ROT1 = -4;        // салфетка вращается в полёте, удар её выпрямляет

        // во время удара — постоянная сила контакта: надпись тормозит, салфетка разгоняется до общей скорости v
        const merge = (p0, v0, t) => {
            const s = t - T0;
            return add(add(p0, v0, s), add(v, v0, -1), s * s / (2 * TM));
        };
        // Корпус (цельный логотип, вспышка, искры) держится за надписью, после удара скользит
        // из D в 0 равнозамедленно и пружинит от сжатия
        const bodyAt = (t) => {
            const dt = t - T0;
            const k = dt > 0 ? 0.075 * Math.exp(-dt / 0.09) * Math.sin(dt * Math.PI * 10) : 0;
            let p;
            if (t <= T0) p = wordT0;
            else if (t <= T1) p = merge(wordT0, vWord, t);
            else {
                const u = Math.min(1, (t - T1) / SLIDE);
                const q = 1 - (1 - u) * (1 - u);
                p = [D[0] * (1 - q), D[1] * (1 - q)];
            }
            return [p[0], p[1], 1 - k, 1 + 0.7 * k];
        };
        const iconAt = (t) => {
            if (t <= T0) return [...[0, 1].map((k) => iconFrom[k] + v0Icon[k] * t + aIcon[k] * t * t / 2), ROT0 + (ROT1 - ROT0) * t / T0];
            if (t <= T1) return [...merge(iconT0, vIcon, t), ROT1 * (1 - (t - T0) / TM)];
            return [...bodyAt(t).slice(0, 2), 0];
        };
        const wordAt = (t) => {
            if (t <= T0) {
                const tau = Math.max(0, t - (T0 - TW));
                return add(wordT0, dirW, L - (v0W * tau - decW * tau * tau / 2));
            }
            return bodyAt(t).slice(0, 2);
        };

        // Кадры: равномерная сетка + все переломные моменты
        const times = new Set([0, T0 - TW, T0, T0 + TM / 2, T1, END]);
        for (let i = 1; i < 90; i++) times.add(END * i / 90);
        const ts = Array.from(times).filter((t) => t >= 0 && t <= END).sort((a, b) => a - b);
        const f = (n) => n.toFixed(2);
        const rel = (p, b) => [p[0] - b[0], p[1] - b[1]];
        const bodyFrames = [], iconFrames = [], wordFrames = [];
        ts.forEach((t) => {
            const offset = t / END;
            const b = bodyAt(t);
            const ic = iconAt(t);
            const ir = rel(ic, b);
            const wr = rel(wordAt(t), b);
            bodyFrames.push({ offset, transform: `translate(${f(b[0])}px, ${f(b[1])}px) scale(${b[2].toFixed(4)}, ${b[3].toFixed(4)})` });
            iconFrames.push({ offset, transform: `translate(${f(ir[0])}px, ${f(ir[1])}px) rotate(${f(ic[2])}deg)` });
            wordFrames.push({ offset, transform: `translate(${f(wr[0])}px, ${f(wr[1])}px)` });
        });
        const ms = (s) => Math.round(s * 1000);
        const run = (el, frames, opts) => el.animate(frames, Object.assign({ fill: 'both' }, opts));
        const anims = [
            run(body, bodyFrames, { duration: ms(END) }),
            run(icon, iconFrames, { duration: ms(END) }),
            run(word, wordFrames, { duration: ms(END) }),
            // детали видны до стыковки, затем их сменяет цельный логотип
            run(icon, [{ opacity: 1 }, { opacity: 0 }], { duration: 40, delay: ms(T1 + 0.04) }),
            run(word, [{ opacity: 1 }, { opacity: 0 }], { duration: 40, delay: ms(T1 + 0.04) }),
            run(full, [{ opacity: 0 }, { opacity: 1 }], { duration: ms(TM * 0.4 + 0.04), delay: ms(T0 + TM * 0.6) }),
            run(flash, [
                { opacity: 0, transform: 'scale(0.4)' },
                { opacity: 0.65, transform: 'scale(0.9)', offset: 0.18 },
                { opacity: 0, transform: 'scale(1.3)' },
            ], { duration: 300, delay: ms(T0), easing: 'ease-out' }),
            ...snaps.map((el, i) => {
                const a = SNAP_ANGLES[i] || 0;
                return run(el, [
                    { opacity: 0, transform: `rotate(${a}deg) translateY(-6px) scaleY(0.2)` },
                    { opacity: 1, transform: `rotate(${a}deg) translateY(-20px) scaleY(1)`, offset: 0.18 },
                    { opacity: 0, transform: `rotate(${a}deg) translateY(-36px) scaleY(0.2)` },
                ], { duration: 560, delay: ms(T0), easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
            }),
        ];
        // по окончании возвращаемся к обычному состоянию (цельный логотип на месте)
        Promise.all(anims.map((a) => a.finished)).then(() => anims.forEach((a) => a.cancel())).catch(() => {});
    }

    if (canAssemble) {
        heroLogo.addEventListener('click', () => {
            if (root.classList.contains('intro-go')) assembleLogo();
        });
    }

    /* ---------- Hero: заставка стартует, когда фото готово (но не позже чем через 1 с) ---------- */
    const heroImg = $('.hero-media img');
    let introStarted = false;
    const startIntro = () => {
        if (introStarted) return;
        introStarted = true;
        root.classList.add('intro-go');
        if (canAssemble) assembleLogo();
    };
    if (reduceMotion || !heroImg) {
        startIntro();
    } else {
        const loaded = heroImg.complete ? Promise.resolve() : new Promise((resolve) => {
            heroImg.addEventListener('load', resolve, { once: true });
            heroImg.addEventListener('error', resolve, { once: true });
        });
        loaded.then(() => (heroImg.decode ? heroImg.decode() : null)).catch(() => {}).then(startIntro);
        setTimeout(startIntro, 1000);
    }

    /* ---------- Hero: плавающие иконки следуют за курсором ---------- */
    const floaters = $('.hero-floaters');
    if (hero && floaters && finePointer && !reduceMotion) {
        hero.addEventListener('pointermove', (e) => {
            const r = hero.getBoundingClientRect();
            floaters.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
            floaters.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
        });
        hero.addEventListener('pointerleave', () => {
            floaters.style.setProperty('--mx', 0);
            floaters.style.setProperty('--my', 0);
        });
    }

    /* ---------- Mobile menu ---------- */
    const menu = $('#mobileMenu');
    const burger = $('#burger');
    function setMenu(open) {
        if (!menu) return;
        menu.classList.toggle('open', open);
        menu.setAttribute('aria-hidden', String(!open));
        burger && burger.setAttribute('aria-expanded', String(open));
        document.body.classList.toggle('menu-open', open);
        document.body.style.overflow = open ? 'hidden' : '';
        if (open) {
            header.classList.remove('hide');
            const first = $('.mobile-menu-links a', menu);
            first && setTimeout(() => first.focus({ preventScroll: true }), 300);
        } else if (burger && menu.contains(document.activeElement)) {
            burger.focus({ preventScroll: true });
        }
    }
    burger && burger.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
    $$('[data-close-menu]').forEach((el) => el.addEventListener('click', () => setMenu(false)));
    window.EDA.setMenu = setMenu;
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && menu && menu.classList.contains('open')) setMenu(false);
    });

    /* ---------- Якорные ссылки: плавная прокрутка без #раздела в адресе ---------- */
    // Иначе адрес превращается в eda.bz/#delivery, и после обновления страница открывается не с начала
    document.addEventListener('click', (e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const link = e.target.closest('a[href^="#"]');
        if (!link || link.classList.contains('skip-link')) return;
        const id = link.getAttribute('href').slice(1);
        const target = id && document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        const behavior = reduceMotion ? 'auto' : 'smooth';
        if (id === 'hero') window.scrollTo({ top: 0, behavior });
        else target.scrollIntoView({ behavior, block: 'start' });
        if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    });

    /* ---------- Scroll-spy: активный пункт меню ---------- */
    const nav = $('#nav');
    const indicator = $('.nav-indicator');
    const navLinks = nav ? $$('a', nav) : [];
    const SECTION_ALIAS = { kitchen: 'gallery' };
    let activeId = null;

    function moveIndicator() {
        if (!indicator) return;
        const link = navLinks.find((a) => a.getAttribute('href') === '#' + activeId);
        if (!link) { indicator.classList.remove('on'); return; }
        indicator.style.width = link.offsetWidth + 'px';
        indicator.style.setProperty('--x', link.offsetLeft + 'px');
        indicator.classList.add('on');
    }
    function setActive(id) {
        const mapped = SECTION_ALIAS[id] || id;
        if (mapped === activeId) return;
        activeId = mapped;
        navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + mapped));
        moveIndicator();
        document.dispatchEvent(new CustomEvent('eda:section', { detail: { id: mapped } }));
    }
    const spy = new IntersectionObserver((entries) => {
        entries.forEach((entry) => { if (entry.isIntersecting) setActive(entry.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('#hero, main section[id]').forEach((s) => spy.observe(s));
    window.addEventListener('resize', moveIndicator);
    document.fonts && document.fonts.ready.then(moveIndicator);

    /* ---------- Заголовки разделов: слова поднимаются по одному ---------- */
    if (!reduceMotion) {
        $$('.sec-title').forEach((title) => {
            let i = 0;
            const split = (node) => {
                Array.from(node.childNodes).forEach((child) => {
                    if (child.nodeType === Node.TEXT_NODE) {
                        if (!child.textContent.trim()) return;
                        const frag = document.createDocumentFragment();
                        child.textContent.split(/(\s+)/).forEach((part) => {
                            if (!part) return;
                            if (!part.trim()) { frag.appendChild(document.createTextNode(part)); return; }
                            const w = document.createElement('span');
                            w.className = 'w';
                            w.style.setProperty('--i', i++);
                            w.textContent = part;
                            frag.appendChild(w);
                        });
                        child.replaceWith(frag);
                    } else if (child.nodeType === Node.ELEMENT_NODE) {
                        split(child);
                    }
                });
            };
            split(title);
            title.classList.add('split');
        });
    }

    /* ---------- Reveal on scroll ---------- */
    const revealIO = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            el.classList.add('visible');
            revealIO.unobserve(el);
            // после появления убираем задержку, чтобы hover-эффекты срабатывали сразу
            const done = (ev) => {
                if (ev.target !== el || ev.propertyName !== 'opacity') return;
                el.style.setProperty('--d', '0');
                el.removeEventListener('transitionend', done);
            };
            el.addEventListener('transitionend', done);
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    $$('[data-reveal], [data-draw]').forEach((el) => revealIO.observe(el));

    /* ---------- Трекер доставки: анимация идёт, только пока карточка на экране ---------- */
    const tracker = $('.tracker');
    if (tracker) {
        new IntersectionObserver(([e]) => tracker.classList.toggle('playing', e.isIntersecting), { threshold: 0.3 }).observe(tracker);
    }

    /* ---------- Count-up numbers ---------- */
    const fmt = new Intl.NumberFormat('ru-RU');
    function countUp(el) {
        const target = parseInt(el.dataset.count, 10);
        if (!target) return;
        const plain = el.hasAttribute('data-plain');
        const from = plain ? target - 40 : 0;
        const render = (v) => { el.textContent = plain ? String(v) : fmt.format(v); };
        if (reduceMotion) { render(target); return; }
        const dur = 1600;
        const t0 = performance.now();
        const step = (t) => {
            const k = Math.min(1, (t - t0) / dur);
            const eased = k === 1 ? 1 : 1 - Math.pow(2, -10 * k);
            render(Math.round(from + (target - from) * eased));
            if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }
    const countIO = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            countUp(entry.target);
            countIO.unobserve(entry.target);
        });
    }, { threshold: 0.6 });
    $$('[data-count]').forEach((el) => countIO.observe(el));

    /* ---------- 3D-наклон карточек услуг ---------- */
    if (finePointer && !reduceMotion) {
        $$('[data-tilt]').forEach((card) => {
            card.addEventListener('pointermove', (e) => {
                const r = card.getBoundingClientRect();
                const x = (e.clientX - r.left) / r.width;
                const y = (e.clientY - r.top) / r.height;
                card.style.transition = 'transform 0.15s ease-out, box-shadow 0.4s';
                card.style.transform = `perspective(900px) rotateX(${((0.5 - y) * 7).toFixed(2)}deg) rotateY(${((x - 0.5) * 9).toFixed(2)}deg) translateY(-6px)`;
                card.style.setProperty('--px', (x * 100).toFixed(1) + '%');
                card.style.setProperty('--py', (y * 100).toFixed(1) + '%');
            });
            card.addEventListener('pointerleave', () => {
                card.style.transition = 'transform 0.7s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.4s';
                card.style.transform = '';
            });
        });
    }

    /* ---------- Carousels: точки-индикаторы по позиции прокрутки ---------- */
    function carouselState(track) {
        const items = Array.from(track.children);
        if (!items.length) return { pages: 0, index: 0, step: 0 };
        const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
        const step = items[0].getBoundingClientRect().width + gap;
        const perView = Math.max(1, Math.round((track.clientWidth + gap) / step));
        const pages = Math.max(1, items.length - perView + 1);
        const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
        const index = atEnd ? pages - 1 : Math.min(pages - 1, Math.round(track.scrollLeft / step));
        return { pages, index, step };
    }
    function bindDots(track) {
        const dots = $(`[data-dots-for="${track.dataset.carousel}"]`);
        if (!dots) return () => {};
        let lastPages = -1;
        const update = () => {
            const { pages, index } = carouselState(track);
            if (pages !== lastPages) {
                dots.innerHTML = '<span></span>'.repeat(pages > 1 ? pages : 0);
                lastPages = pages;
            }
            Array.from(dots.children).forEach((d, i) => d.classList.toggle('active', i === index));
            track.dispatchEvent(new CustomEvent('carousel:update', { detail: { pages, index } }));
        };
        let raf = 0;
        track.addEventListener('scroll', () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(update);
        }, { passive: true });
        window.addEventListener('resize', update);
        update();
        return update;
    }
    $$('[data-carousel]').forEach(bindDots);

    /* ---------- Reviews: стрелки и автопрокрутка ---------- */
    const reviewsTrack = $('#reviewsTrack');
    if (reviewsTrack) {
        const go = (dir) => {
            const { pages, index, step } = carouselState(reviewsTrack);
            let next = index + dir;
            if (next >= pages) next = 0;
            if (next < 0) next = pages - 1;
            reviewsTrack.scrollTo({ left: next * step, behavior: reduceMotion ? 'auto' : 'smooth' });
        };
        $$('[data-scroll]').forEach((btn) => btn.addEventListener('click', () => {
            go(parseInt(btn.dataset.scroll, 10));
            restart();
        }));
        reviewsTrack.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
        });

        let timer = null;
        let inView = false;
        let hovered = false;
        const stop = () => { clearInterval(timer); timer = null; };
        function restart() {
            stop();
            if (reduceMotion || !inView || hovered || document.hidden) return;
            timer = setInterval(() => go(1), 6000);
        }
        new IntersectionObserver(([e]) => { inView = e.isIntersecting; restart(); }, { threshold: 0.4 }).observe(reviewsTrack);
        reviewsTrack.addEventListener('pointerenter', () => { hovered = true; stop(); });
        reviewsTrack.addEventListener('pointerleave', () => { hovered = false; restart(); });
        reviewsTrack.addEventListener('touchstart', () => { hovered = true; stop(); }, { passive: true });
        reviewsTrack.addEventListener('touchend', () => { hovered = false; setTimeout(restart, 4000); }, { passive: true });
        document.addEventListener('visibilitychange', restart);
    }

    /* ---------- Lightbox ---------- */
    const lb = $('#lightbox');
    const lbImg = $('#lightboxImg');
    const lbCap = $('#lightboxCaption');
    const lbCount = $('#lightboxCount');
    const lbStage = $('.lightbox-stage');
    const gItems = $$('.g-item');
    let lbIndex = 0;

    function showImage(i, dir) {
        lbIndex = (i + gItems.length) % gItems.length;
        const img = $('img', gItems[lbIndex]);
        lbImg.classList.remove('enter-next', 'enter-prev');
        lbImg.style.transform = '';
        lbImg.style.opacity = '';
        lbImg.src = img.currentSrc || img.src;
        lbImg.alt = img.alt;
        lbCap.textContent = img.alt;
        lbCount.textContent = `${lbIndex + 1} / ${gItems.length}`;
        if (dir) {
            void lbImg.offsetWidth; // перезапуск анимации
            lbImg.classList.add(dir > 0 ? 'enter-next' : 'enter-prev');
        }
    }
    function openLightbox(i) {
        if (!lb || typeof lb.showModal !== 'function') return;
        showImage(i);
        lb.showModal();
        document.body.style.overflow = 'hidden';
        document.dispatchEvent(new CustomEvent('eda:lightbox', { detail: { open: true } }));
    }
    function closeLightbox() {
        if (!lb.open || lb.classList.contains('closing')) return;
        const finish = () => {
            lb.classList.remove('closing');
            lb.close();
            document.body.style.overflow = '';
            document.dispatchEvent(new CustomEvent('eda:lightbox', { detail: { open: false } }));
        };
        if (reduceMotion) { finish(); return; }
        lb.classList.add('closing');
        lb.addEventListener('animationend', finish, { once: true });
    }
    window.EDA.closeLightbox = closeLightbox;

    if (lb) {
        gItems.forEach((item, i) => item.addEventListener('click', () => openLightbox(i)));
        lb.addEventListener('cancel', (e) => { e.preventDefault(); closeLightbox(); });
        lb.addEventListener('click', (e) => {
            const action = e.target.closest('[data-lb]');
            if (action) {
                const a = action.dataset.lb;
                if (a === 'close') closeLightbox();
                if (a === 'next') showImage(lbIndex + 1, 1);
                if (a === 'prev') showImage(lbIndex - 1, -1);
                return;
            }
            if (e.target === lbStage || e.target === lb) closeLightbox();
        });
        lb.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') showImage(lbIndex + 1, 1);
            if (e.key === 'ArrowLeft') showImage(lbIndex - 1, -1);
        });

        // Свайп: влево/вправо — листать, вниз — закрыть
        let sx = 0, sy = 0, dragging = false;
        lbStage.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse') return;
            dragging = true; sx = e.clientX; sy = e.clientY;
            lbImg.style.transition = 'none';
        });
        lbStage.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const dx = e.clientX - sx;
            const dy = Math.max(0, e.clientY - sy);
            if (dy > Math.abs(dx)) {
                lbImg.style.transform = `translateY(${dy}px) scale(${1 - Math.min(dy, 300) / 1200})`;
                lb.style.backgroundColor = `rgba(10, 6, 4, ${0.96 - Math.min(dy, 300) / 600})`;
            } else {
                lbImg.style.transform = `translateX(${dx}px)`;
            }
        });
        const endDrag = (e) => {
            if (!dragging) return;
            dragging = false;
            const dx = e.clientX - sx;
            const dy = e.clientY - sy;
            lbImg.style.transition = '';
            lb.style.backgroundColor = '';
            if (dy > 110 && dy > Math.abs(dx)) { closeLightbox(); return; }
            if (Math.abs(dx) > 50) showImage(lbIndex + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
            else lbImg.style.transform = '';
        };
        lbStage.addEventListener('pointerup', endDrag);
        lbStage.addEventListener('pointercancel', endDrag);
    }

    /* ---------- Бегущая строка ускоряется и меняет направление вслед за прокруткой ---------- */
    const marquee = $('.marquee');
    const marqueeTrack = marquee && $('.marquee-track', marquee);
    const marqueeAnim = marqueeTrack && !reduceMotion && marqueeTrack.getAnimations ? marqueeTrack.getAnimations()[0] : null;
    if (marqueeAnim) {
        // отматываем далеко вперёд: при обратном ходе анимация не упрётся в начало
        marqueeAnim.currentTime = (marqueeAnim.currentTime || 0) + 38000 * 500;
        const setRate = (r) => (marqueeAnim.updatePlaybackRate ? marqueeAnim.updatePlaybackRate(r) : (marqueeAnim.playbackRate = r));
        let prevY = window.scrollY, speed = 1, dir = 1, lastRate = 1, raf = 0, visible = false;
        const loop = () => {
            const y = window.scrollY;
            const dy = y - prevY;
            prevY = y;
            if (Math.abs(dy) > 1) dir = dy > 0 ? 1 : -1;
            speed += (1 + Math.min(Math.abs(dy) / 6, 6) - speed) * 0.1;
            const rate = Math.round(dir * speed * 100) / 100;
            if (rate !== lastRate) {
                setRate(rate);
                lastRate = rate;
                marquee.style.setProperty('--skew', `${(dir * (speed - 1) * 1.6).toFixed(2)}deg`);
            }
            raf = visible ? requestAnimationFrame(loop) : 0;
        };
        new IntersectionObserver(([e]) => {
            visible = e.isIntersecting;
            if (visible && !raf) { prevY = window.scrollY; raf = requestAnimationFrame(loop); }
        }).observe(marquee);
    }

    /* ---------- «Магнитные» кнопки: слегка тянутся за курсором ---------- */
    if (finePointer && !reduceMotion) {
        $$('.hero-actions .btn, .delivery-text .btn, .contact-actions .btn, .reviews-yandex .btn, .header-phone').forEach((btn) => {
            btn.addEventListener('pointermove', (e) => {
                const r = btn.getBoundingClientRect();
                const x = (e.clientX - r.left) / r.width - 0.5;
                const y = (e.clientY - r.top) / r.height - 0.5;
                btn.style.translate = `${(x * 12).toFixed(1)}px ${(y * 8).toFixed(1)}px`;
            });
            btn.addEventListener('pointerleave', () => { btn.style.translate = ''; });
        });
    }

    /* ---------- Волна от точки нажатия на кнопках ---------- */
    if (!reduceMotion) {
        document.addEventListener('pointerdown', (e) => {
            const btn = e.target.closest('.btn, .service-link');
            if (!btn) return;
            const r = btn.getBoundingClientRect();
            const ink = document.createElement('span');
            ink.className = 'ripple';
            ink.style.left = `${e.clientX - r.left}px`;
            ink.style.top = `${e.clientY - r.top}px`;
            ink.style.setProperty('--s', Math.ceil(Math.hypot(r.width, r.height) / 5));
            btn.appendChild(ink);
            ink.addEventListener('animationend', () => ink.remove());
        });
    }

    /* ---------- Copy to clipboard ---------- */
    $$('[data-copy]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const text = btn.dataset.copy;
            try {
                await navigator.clipboard.writeText(text);
            } catch (e) {
                const ta = document.createElement('textarea');
                ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta); ta.select();
                try { document.execCommand('copy'); } catch (err) {}
                ta.remove();
            }
            toast('Адрес скопирован');
        });
    });
})();
