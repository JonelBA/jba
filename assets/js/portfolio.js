/*
 * Portfolio scripts: theme, accessible navigation, header behavior,
 * project carousel, image preview, contact form (EmailJS), copyright year.
 */
(() => {
    'use strict';

    const root = document.documentElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- Storage (can be blocked by the browser) ---------- */
    const store = {
        get(key) { try { return window.localStorage.getItem(key); } catch (error) { return null; } },
        set(key, value) { try { window.localStorage.setItem(key, value); } catch (error) { /* ignore */ } }
    };

    /* ---------- Theme ---------- */
    // The inline script in <head> applies the saved theme before first paint; this keeps the button in sync.
    const themeToggle = document.querySelector('.theme-toggle');

    function updateThemeToggle(theme) {
        if (!themeToggle) return;
        const lightMode = theme === 'light';
        const nextModeLabel = lightMode ? 'dark mode' : 'light mode';
        themeToggle.setAttribute('aria-pressed', String(lightMode));
        themeToggle.setAttribute('aria-label', 'Switch to ' + nextModeLabel);
        themeToggle.setAttribute('title', 'Switch to ' + nextModeLabel);
        const label = themeToggle.querySelector('.theme-label');
        if (label) label.textContent = lightMode ? 'Dark mode' : 'Light mode';
    }

    root.dataset.theme = store.get('portfolio-theme') === 'light' ? 'light' : 'dark';
    updateThemeToggle(root.dataset.theme);

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const nextTheme = root.dataset.theme === 'light' ? 'dark' : 'light';
            root.dataset.theme = nextTheme;
            store.set('portfolio-theme', nextTheme);
            updateThemeToggle(nextTheme);
        });
    }

    /* ---------- Scroll reveal (AOS) with a safe fallback ---------- */
    if (typeof AOS !== 'undefined' && !reduceMotion) {
        AOS.init({ duration: 650, easing: 'ease-out-cubic', once: true, offset: 80, mirror: false });
    } else {
        // AOS missing or motion reduced: never leave content hidden.
        document.querySelectorAll('[data-aos]').forEach(element => {
            element.removeAttribute('data-aos');
            element.removeAttribute('data-aos-delay');
        });
    }

    /* ---------- Mobile navigation ---------- */
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');
    const mobileQuery = window.matchMedia('(max-width: 768px)');

    const menuIsOpen = () => Boolean(hamburger && hamburger.getAttribute('aria-expanded') === 'true');

    function setMenu(open) {
        if (!hamburger || !navLinks) return;
        hamburger.setAttribute('aria-expanded', String(open));
        hamburger.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
        hamburger.classList.toggle('active', open);
        navLinks.classList.toggle('active', open);
    }

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => setMenu(!menuIsOpen()));
        navLinks.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && menuIsOpen()) { setMenu(false); hamburger.focus(); }
        });
        if (mobileQuery.addEventListener) {
            mobileQuery.addEventListener('change', () => { if (!mobileQuery.matches) setMenu(false); });
        }
    }

    /* ---------- Header: shadow and hide on scroll down ---------- */
    const header = document.querySelector('header');
    let lastScrollTop = window.scrollY || 0;
    let ticking = false;

    function onScroll() {
        const current = window.scrollY || document.documentElement.scrollTop || 0;
        if (header) {
            header.style.boxShadow = current > 50 ? '0 5px 20px rgba(0,0,0,0.2)' : 'none';
            if (current > lastScrollTop + 4 && current > 80 && !menuIsOpen()) {
                header.classList.add('hide-nav');
            } else if (current < lastScrollTop - 4 || current <= 20) {
                header.classList.remove('hide-nav');
            }
        }
        lastScrollTop = Math.max(0, current);
        ticking = false;
    }

    window.addEventListener('scroll', () => {
        if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
    }, { passive: true });

    if (header) header.addEventListener('focusin', () => header.classList.remove('hide-nav'));

    /* ---------- Project carousel ---------- */
    document.querySelectorAll('[data-carousel]').forEach(carousel => {
        const track = carousel.querySelector('.works-carousel-track');
        const cards = Array.from(carousel.querySelectorAll('.project-card-carousel'));
        if (!track || cards.length < 2) return;

        const controls = document.querySelector('[data-carousel-controls]');
        let active = 0;
        let timer = null;
        let userInteracted = false;

        const goTo = index => {
            active = (index + cards.length) % cards.length;
            track.scrollTo({ left: cards[active].offsetLeft - track.offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' });
        };

        let syncTimer = null;
        track.addEventListener('scroll', () => {
            window.clearTimeout(syncTimer);
            syncTimer = window.setTimeout(() => {
                let best = 0, bestDistance = Infinity;
                cards.forEach((card, index) => {
                    const distance = Math.abs(card.offsetLeft - track.offsetLeft - track.scrollLeft);
                    if (distance < bestDistance) { best = index; bestDistance = distance; }
                });
                active = best;
            }, 120);
        }, { passive: true });

        const stop = () => { if (timer) { window.clearInterval(timer); timer = null; } };
        const start = () => {
            if (reduceMotion || userInteracted || timer || document.hidden) return;
            timer = window.setInterval(() => goTo(active + 1), 5000);
        };
        const interact = () => { userInteracted = true; stop(); };

        if (controls) {
            const prev = controls.querySelector('[data-carousel-prev]');
            const next = controls.querySelector('[data-carousel-next]');
            if (prev) prev.addEventListener('click', () => { interact(); goTo(active - 1); });
            if (next) next.addEventListener('click', () => { interact(); goTo(active + 1); });
        }

        ['mouseenter', 'focusin', 'touchstart'].forEach(name => carousel.addEventListener(name, stop, { passive: true }));
        carousel.addEventListener('mouseleave', start);
        carousel.addEventListener('focusout', start);
        document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
        start();
    });

    /* ---------- Image preview (work page) ---------- */
    const imageModal = document.getElementById('imageModal');
    const imageModalClose = document.getElementById('imageModalClose');
    const imageModalImg = document.getElementById('imageModalImg');
    let lastTrigger = null;

    const setBackgroundInert = value => {
        document.querySelectorAll('header, main, footer').forEach(element => { element.inert = value; });
    };

    function openImageModal(trigger) {
        const source = trigger && trigger.getAttribute('data-img');
        if (!source || !imageModal || !imageModalImg) return;
        lastTrigger = trigger;
        imageModalImg.src = source;
        imageModalImg.alt = trigger.getAttribute('data-img-alt') || 'Project full-size preview';
        imageModal.classList.add('open');
        imageModal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
        setBackgroundInert(true);
        if (imageModalClose) imageModalClose.focus();
    }

    function closeImageModal() {
        if (!imageModal || !imageModal.classList.contains('open')) return;
        imageModal.classList.remove('open');
        imageModal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        setBackgroundInert(false);
        if (imageModalImg) imageModalImg.removeAttribute('src');
        if (lastTrigger) lastTrigger.focus();
    }

    document.querySelectorAll('.project-image-clickable').forEach(trigger => {
        trigger.addEventListener('click', () => openImageModal(trigger));
    });
    if (imageModalClose) imageModalClose.addEventListener('click', closeImageModal);
    if (imageModal) imageModal.addEventListener('click', event => { if (event.target === imageModal) closeImageModal(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeImageModal(); });

    /* ---------- Contact form (EmailJS) ---------- */
    // In the EmailJS dashboard, restrict the allowed domains to your portfolio and enable
    // reCAPTCHA so these public IDs cannot be misused.
    const emailJsConfig = {
        publicKey: 'yipLmWU_DtuGyaVDa',
        serviceId: 'service_6b0t2o8',
        templateId: 'template_pctgzjb'
    };
    const FALLBACK_EMAIL = 'andamonjonel06@gmail.com';
    const COOLDOWN_MS = 30000;

    const contactForm = document.getElementById('contactForm');
    const formStatus = document.getElementById('formStatus');
    let lastSent = 0;

    function showStatus(message, kind) {
        if (!formStatus) return;
        formStatus.textContent = message;
        formStatus.className = kind ? 'form-status ' + kind : 'form-status';
    }

    if (contactForm && formStatus) {
        contactForm.addEventListener('submit', async event => {
            event.preventDefault();

            // Honeypot: real visitors never fill this hidden field.
            const trap = contactForm.querySelector('[name="website"]');
            if (trap && trap.value) { showStatus('Your message was sent successfully.', 'is-success'); return; }

            if (!window.emailjs) {
                showStatus('The message service could not load. Please email me directly at ' + FALLBACK_EMAIL + '.', 'is-error');
                return;
            }
            if (Date.now() - lastSent < COOLDOWN_MS) {
                showStatus('Please wait a few seconds before sending another message.', 'is-error');
                return;
            }

            const submitButton = contactForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Sending...';
            showStatus('', '');

            const field = name => (contactForm.elements[name] ? contactForm.elements[name].value.trim() : '');
            const params = {
                name: field('name'), email: field('email'), title: field('subject'), subject: field('subject'),
                message: field('message'), user_name: field('name'), user_email: field('email'),
                from_name: field('name'), reply_to: field('email')
            };

            try {
                window.emailjs.init({ publicKey: emailJsConfig.publicKey });
                await window.emailjs.send(emailJsConfig.serviceId, emailJsConfig.templateId, params);
                lastSent = Date.now();
                contactForm.reset();
                showStatus('Your message was sent successfully.', 'is-success');
            } catch (error) {
                showStatus('Something went wrong. Please try again, or email me directly at ' + FALLBACK_EMAIL + '.', 'is-error');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Send Message';
            }
        });
    }

    /* ---------- Footer year ---------- */
    const copyright = document.querySelector('.copyright');
    if (copyright) copyright.textContent = '\u00A9 ' + new Date().getFullYear() + ' Jonel Andamon. ALL RIGHTS RESERVED.';

    window.addEventListener('load', () => document.body.classList.add('loaded'));
})();
