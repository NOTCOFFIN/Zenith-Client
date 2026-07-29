const reveals = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
reveals.forEach(el => observer.observe(el));

const menuBtn = document.getElementById('menuBtn');
const navLinks = document.getElementById('navLinks');
menuBtn.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', String(open));
});
navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navLinks.classList.remove('open')));

const glow = document.getElementById('cursorGlow');
window.addEventListener('pointermove', e => {
  glow.style.left = `${e.clientX}px`;
  glow.style.top = `${e.clientY}px`;
});

const tilt = document.getElementById('tiltCard');
if (window.matchMedia('(pointer:fine)').matches) {
  tilt.addEventListener('pointermove', e => {
    const r = tilt.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - .5;
    const y = (e.clientY - r.top) / r.height - .5;
    tilt.style.transform = `rotateY(${x * 5}deg) rotateX(${-y * 4}deg)`;
  });
  tilt.addEventListener('pointerleave', () => tilt.style.transform = 'rotateY(0) rotateX(0)');
}

const nav = document.querySelector('.nav-wrap');
window.addEventListener('scroll', () => {
  nav.style.borderBottom = window.scrollY > 30 ? '1px solid rgba(255,255,255,.06)' : '1px solid transparent';
});

document.querySelectorAll('.disabled-download').forEach(btn => btn.addEventListener('click', () => {
  const old = btn.querySelector('span').textContent;
  btn.querySelector('span').textContent = 'Launcher coming next';
  setTimeout(() => btn.querySelector('span').textContent = old, 1600);
}));
