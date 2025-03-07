// static/js/home.js
// document.addEventListener('DOMContentLoaded', () => {
//     const hamburger = document.querySelector('.hamburger');
//     const navLinks = document.querySelector('.nav-links');
//     const body = document.body;

//     hamburger.addEventListener('click', () => {
//         hamburger.classList.toggle('is-active');
//         navLinks.classList.toggle('is-active');
//         body.classList.toggle('menu-open');
        
//         // Update aria-expanded
//         const isExpanded = hamburger.classList.contains('is-active');
//         hamburger.setAttribute('aria-expanded', isExpanded);
//     });

//     // Close menu when clicking outside
//     document.addEventListener('click', (e) => {
//         if (!navLinks.contains(e.target) && !hamburger.contains(e.target)) {
//             hamburger.classList.remove('is-active');
//             navLinks.classList.remove('is-active');
//             body.classList.remove('menu-open');
//             hamburger.setAttribute('aria-expanded', 'false');
//         }
//     });

//     // Close menu when pressing Escape key
//     document.addEventListener('keydown', (e) => {
//         if (e.key === 'Escape' && navLinks.classList.contains('is-active')) {
//             hamburger.classList.remove('is-active');
//             navLinks.classList.remove('is-active');
//             body.classList.remove('menu-open');
//             hamburger.setAttribute('aria-expanded', 'false');
//         }
//     });
// });


document.addEventListener('DOMContentLoaded', () => {
            const hamburger = document.querySelector('.hamburger');
            const navLinks = document.querySelector('.nav-links');
            const backdrop = document.querySelector('.menu-backdrop');
            const body = document.body;

            function closeMenu() {
                hamburger.classList.remove('is-active');
                navLinks.classList.remove('is-active');
                backdrop.classList.remove('is-active');
                body.classList.remove('menu-open');
                hamburger.setAttribute('aria-expanded', 'false');
            }

            function openMenu() {
                hamburger.classList.add('is-active');
                navLinks.classList.add('is-active');
                backdrop.classList.add('is-active');
                body.classList.add('menu-open');
                hamburger.setAttribute('aria-expanded', 'true');
            }

            hamburger.addEventListener('click', () => {
                if (hamburger.classList.contains('is-active')) {
                    closeMenu();
                } else {
                    openMenu();
                }
            });

            // Close menu when clicking backdrop
            backdrop.addEventListener('click', closeMenu);

            // Close menu when pressing Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && navLinks.classList.contains('is-active')) {
                    closeMenu();
                }
            });

            // Close menu when resizing window beyond mobile breakpoint
            window.addEventListener('resize', () => {
                if (window.innerWidth > 768) {
                    closeMenu();
                }
            });

            // Handle navbar background on scroll
            function updateNavbar() {
                const navbar = document.querySelector('.navbar');
                if (window.scrollY > 50) {
                    navbar.style.background = 'rgba(5, 5, 5, 0.95)';
                } else {
                    navbar.style.background = 'var(--bg-primary)';
                }
            }

            window.addEventListener('scroll', updateNavbar);
            updateNavbar(); // Initial call
        });