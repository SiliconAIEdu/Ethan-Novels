(() => {
  'use strict';
  const chapters = JSON.parse(document.getElementById('novel-data').textContent);
  const $ = id => document.getElementById(id);
  const smallScreen = matchMedia('(max-width:760px)');
  const storage = {get(key) {try {return localStorage.getItem(key);} catch {return null;}}, set(key,value) {try {localStorage.setItem(key,value);} catch {}}};
  let current = 0, frame = 0, restorePending = false;
  let fontSize = Number(storage.get('ethan-font-size')) || (smallScreen.matches ? 18 : 19);
  let saved = null;
  try {saved = JSON.parse(storage.get('ethan-reading'));} catch {}
  if (!saved || !chapters.some(ch => ch.slug === saved.slug)) saved = null;
  const initialSaved = saved;
  function titleParts(ch) {
    const [label,...rest] = ch.title.split('：');
    const [title,...subtitle] = rest.join('：').split('——');
    return {label,title:title || label,subtitle:subtitle.join('——')};
  }
  function escapeHTML(value) {return String(value).replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function href(ch) {return '#chapter/' + encodeURIComponent(ch.slug);}
  $('chapter-count').textContent = `序章 + ${chapters.length - 1} 章`;
  $('chapter-list').innerHTML = chapters.map(ch => {
    const t = titleParts(ch);
    return `<a class="chapter-link" href="${href(ch)}" data-slug="${ch.slug}" data-search="${escapeHTML(ch.title + ' ' + ch.chapter)}"><span class="chapter-number">${ch.chapter ? String(ch.chapter).padStart(2,'0') : '序'}</span><span class="chapter-link-title">${escapeHTML(t.title)}${t.subtitle ? `<small>${escapeHTML(t.subtitle)}</small>` : ''}</span></a>`;
  }).join('');
  const links = [...document.querySelectorAll('.chapter-link')];
  function closeMenu(focus = false) {
    $('contents').classList.remove('open'); $('backdrop').hidden = true;
    document.body.classList.remove('menu-open'); $('menu-toggle').setAttribute('aria-expanded','false');
    if (focus && smallScreen.matches) $('menu-toggle').focus();
  }
  function openMenu() {
    $('chapter-search').value = ''; filterChapters();
    if (smallScreen.matches) {
      $('contents').classList.add('open'); $('backdrop').hidden = false;
      document.body.classList.add('menu-open'); $('menu-toggle').setAttribute('aria-expanded','true');
    }
    $('chapter-search').focus();
    links[current].scrollIntoView({block:'nearest'});
  }
  $('menu-toggle').onclick = () => $('contents').classList.contains('open') ? closeMenu(true) : openMenu();
  $('close-menu').onclick = () => closeMenu(true);
  $('backdrop').onclick = () => closeMenu(true);
  $('show-contents').onclick = openMenu;
  smallScreen.addEventListener('change',() => closeMenu());
  document.addEventListener('keydown',event => {
    if (!$('contents').classList.contains('open')) return;
    if (event.key === 'Escape') closeMenu(true);
    if (event.key === 'Tab') {
      const focusable = [...$('contents').querySelectorAll('button,input,a')].filter(el => !el.hidden);
      const first=focusable[0], last=focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {event.preventDefault();last.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first.focus();}
    }
  });
  function filterChapters() {
    const query = $('chapter-search').value.trim().toLowerCase();
    links.forEach(link => link.hidden = !link.dataset.search.toLowerCase().includes(query));
    $('no-results').hidden = links.some(link => !link.hidden);
  }
  $('chapter-search').addEventListener('input',filterChapters);
  function updateFont() {
    fontSize = Math.min(26,Math.max(16,fontSize));
    document.documentElement.style.setProperty('--font-size',fontSize + 'px');
    $('font-value').textContent = fontSize;
    $('font-smaller').disabled = fontSize <= 16; $('font-larger').disabled = fontSize >= 26;
    storage.set('ethan-font-size',String(fontSize));
  }
  $('font-smaller').onclick = () => {fontSize--;updateFont();updateProgress();};
  $('font-larger').onclick = () => {fontSize++;updateFont();updateProgress();};
  updateFont();
  document.querySelector('.skip').onclick = event => {event.preventDefault();$('reader').scrollIntoView();$('reader').focus({preventScroll:true});};
  function setNavigation(id,index) {
    const link=$(id), ch=chapters[index];
    if (ch) {link.href=href(ch);link.removeAttribute('aria-disabled');link.removeAttribute('tabindex');link.title=ch.title;}
    else {link.removeAttribute('href');link.setAttribute('aria-disabled','true');link.tabIndex=-1;link.title='';}
  }
  function render(scroll = true) {
    let slug;
    try {slug=decodeURIComponent(location.hash.replace(/^#chapter\//,''));} catch {slug='';}
    const index=chapters.findIndex(ch => ch.slug === slug);
    current = index >= 0 ? index : 0;
    const ch=chapters[current], t=titleParts(ch);
    $('chapter-content').innerHTML = `<p class="chapter-kicker">${escapeHTML(t.label)}</p><h2 id="chapter-title">${escapeHTML(t.title)}</h2>${t.subtitle ? `<p class="chapter-subtitle">${escapeHTML(t.subtitle)}</p>` : ''}<div class="chapter-divider" aria-hidden="true"></div><div class="prose">${ch.paragraphs.map(p => `<p${/^[（(]|^——.*（/.test(p) ? ' class="note"' : ''}>${escapeHTML(p).replace(/\n/g,'<br>')}</p>`).join('')}</div>`;
    document.title = ch.title + ' · 潮涌双城记';
    $('reading-position').textContent = `${String(current+1).padStart(2,'0')} / ${chapters.length} 篇 · 约 ${Math.max(1,Math.ceil(ch.characters / 450))} 分钟`;
    links.forEach((link,i) => i === current ? link.setAttribute('aria-current','page') : link.removeAttribute('aria-current'));
    setNavigation('previous',current-1);setNavigation('next',current+1);
    $('reading-end').textContent = current === chapters.length-1 ? '已读至最新章节 · 未完待续' : '不必赶路，故事会等你。';
    $('resume-banner').hidden = Boolean(location.hash) || !initialSaved;
    closeMenu();
    if (scroll) {$('reader').scrollIntoView({block:'start'});$('reader').focus({preventScroll:true});}
    updateProgress();
  }
  function position() {
    const article=$('chapter-content');
    return Math.max(0,Math.min(1,-article.getBoundingClientRect().top / Math.max(1,article.offsetHeight - innerHeight * .5)));
  }
  function updateProgress() {
    frame=0;
    const fraction=position();$('progress-bar').style.width = (fraction*100)+'%';
    if (!restorePending && $('resume-banner').hidden) storage.set('ethan-reading',JSON.stringify({slug:chapters[current].slug,fraction}));
  }
  function scheduleProgress() {if (!frame) frame=requestAnimationFrame(updateProgress);}
  addEventListener('scroll',scheduleProgress,{passive:true});
  addEventListener('resize',scheduleProgress);
  addEventListener('hashchange',() => render());
  // A second tap on the current chapter still dismisses the mobile drawer.
  $('chapter-list').addEventListener('click',event => {
    const link=event.target.closest('a');
    if (link && link.hash === location.hash) {closeMenu();$('reader').scrollIntoView();$('reader').focus({preventScroll:true});}
  });
  $('resume-button').onclick = () => {
    if (!initialSaved) return;
    restorePending=true;
    history.replaceState(null,'',href(initialSaved));render(false);
    requestAnimationFrame(() => {
      const article=$('chapter-content');
      const fraction=Number.isFinite(initialSaved.fraction) ? Math.max(0,Math.min(1,initialSaved.fraction)) : 0;
      scrollTo(0,scrollY+article.getBoundingClientRect().top+fraction*Math.max(1,article.offsetHeight-innerHeight*.5));
      restorePending=false;updateProgress();
    });
  };
  render(Boolean(location.hash));
})();
