import { useEffect } from 'react';

export default function HashOpenDetails(): null {
  useEffect(() => {
    function injectBackLinks() {
      document.querySelectorAll<HTMLDetailsElement>('.pr-card').forEach((card) => {
        if (card.querySelector('.pr-back-link')) return;

        const cardId = card.id;
        // Find the body anchor that links to this card
        const bodyAnchor = document.querySelector<HTMLAnchorElement>(
          `a[href="#${cardId}"]:not(.pr-back-link)`
        );
        if (!bodyAnchor) return;

        const link = document.createElement('a');
        link.className = 'pr-back-link';
        link.textContent = '↑ 본문으로';
        link.href = `#${cardId}`;
        link.onclick = (e) => {
          e.preventDefault();
          const navbarHeight =
            document.querySelector('.navbar')?.getBoundingClientRect().height ?? 60;
          const top =
            bodyAnchor.getBoundingClientRect().top + window.scrollY - navbarHeight - 24;
          window.scrollTo({ top, behavior: 'smooth' });
          history.replaceState(null, '', location.pathname);
        };

        const target =
          card.querySelector('[class*="collapsibleContent"]') || card;
        target.appendChild(link);
      });
    }

    function openAndScroll(id: string) {
      const el = document.getElementById(id);
      if (!(el instanceof HTMLDetailsElement)) return;

      if (!el.open) {
        el.querySelector('summary')?.click();
      }

      const navbarHeight =
        document.querySelector('.navbar')?.getBoundingClientRect().height ?? 60;
      setTimeout(() => {
        const viewportOffset = (window.innerHeight - el.offsetHeight) / 3;
        const top =
          el.getBoundingClientRect().top +
          window.scrollY -
          navbarHeight -
          Math.max(viewportOffset, 12);
        window.scrollTo({ top, behavior: 'smooth' });
      }, 450);
    }

    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href?.startsWith('#pr-')) return;
      if (anchor.classList.contains('pr-back-link')) return;

      e.preventDefault();
      history.pushState(null, '', href);
      openAndScroll(href.slice(1));
    }

    function handleInitialHash() {
      const id = location.hash?.slice(1);
      if (!id?.startsWith('pr-')) return;
      setTimeout(() => openAndScroll(id), 500);
    }

    // Inject after Docusaurus hydration settles
    setTimeout(injectBackLinks, 300);
    handleInitialHash();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return null;
}
