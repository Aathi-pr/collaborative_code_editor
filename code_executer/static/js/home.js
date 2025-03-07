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
