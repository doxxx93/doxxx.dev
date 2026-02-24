import { useEffect, useRef } from 'react';

export default function HashOpenDetails(): null {
  const scrollOriginRef = useRef(0);

  useEffect(() => {
    function injectBackLink(card: HTMLDetailsElement) {
      card.querySelectorAll('.pr-back-link').forEach((el) => el.remove());

      const link = document.createElement('a');
      link.className = 'pr-back-link';
      link.textContent = '↑ 본문으로';
      link.href = '#';
      link.onclick = (e) => {
        e.preventDefault();
        link.remove();
        window.scrollTo({ top: scrollOriginRef.current, behavior: 'smooth' });
        history.replaceState(null, '', location.pathname);
      };

      const target =
        card.querySelector('[class*="collapsibleContent"]') || card;
      target.appendChild(link);
    }

    function openAndScroll(id: string) {
      const el = document.getElementById(id);
      if (!(el instanceof HTMLDetailsElement)) return;

      if (!el.open) {
        el.querySelector('summary')?.click();
      }

      injectBackLink(el);

      // Wait for Docusaurus open animation to fully settle, then scroll precisely
      // navbar height offset so the card isn't hidden behind it
      const navbarHeight =
        document.querySelector('.navbar')?.getBoundingClientRect().height ?? 60;
      setTimeout(() => {
        const viewportOffset = (window.innerHeight - el.offsetHeight) / 3;
      const top = el.getBoundingClientRect().top + window.scrollY - navbarHeight - Math.max(viewportOffset, 12);
        window.scrollTo({ top, behavior: 'smooth' });
      }, 450);
    }

    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href?.startsWith('#pr-')) return;

      e.preventDefault();
      scrollOriginRef.current = window.scrollY;
      history.pushState(null, '', href);
      openAndScroll(href.slice(1));
    }

    // Handle direct URL access with hash (page load / reload)
    function handleInitialHash() {
      const id = location.hash?.slice(1);
      if (!id?.startsWith('pr-')) return;
      setTimeout(() => openAndScroll(id), 500);
    }

    handleInitialHash();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return null;
}
