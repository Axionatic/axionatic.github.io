(function () {
  const nav = document.querySelector('[data-portfolio-nav]');
  if (!nav) return;

  const toggle = nav.querySelector('.nav-btn__toggle');
  const phone = window.matchMedia('(max-width: 600px)');
  if (!toggle) return;
  nav.classList.add('is-ready');

  function setOpen(open, restoreFocus) {
    const nextOpen = phone.matches && open;
    nav.classList.toggle('is-open', nextOpen);
    toggle.setAttribute('aria-expanded', String(nextOpen));
    if (restoreFocus) toggle.focus();
  }

  toggle.addEventListener('click', function () {
    setOpen(!nav.classList.contains('is-open'), false);
  });

  document.addEventListener('pointerdown', function (event) {
    if (nav.classList.contains('is-open') && !nav.contains(event.target)) {
      setOpen(false, false);
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      setOpen(false, true);
    }
  });

  phone.addEventListener('change', function () {
    setOpen(false, false);
  });
}());
