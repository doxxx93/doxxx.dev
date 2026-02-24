import React, {useEffect, useRef, useCallback} from 'react';
import TOCItems from '@theme-original/TOCItems';
import type TOCItemsType from '@theme/TOCItems';
import type {WrapperProps} from '@docusaurus/types';

type Props = WrapperProps<typeof TOCItemsType>;

export default function TOCItemsWrapper(props: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);

  const updateIndicator = useCallback(() => {
    const container = containerRef.current;
    const indicator = indicatorRef.current;
    if (!container || !indicator || !props.linkActiveClassName) return;

    const activeLink = container.querySelector<HTMLElement>(
      `.${props.linkActiveClassName.split(' ').join('.')}`,
    );

    if (activeLink) {
      const containerRect = container.getBoundingClientRect();
      const linkRect = activeLink.getBoundingClientRect();
      const top = linkRect.top - containerRect.top + container.scrollTop;

      indicator.style.opacity = '1';
      indicator.style.transform = `translateY(${top}px)`;
      indicator.style.height = `${linkRect.height}px`;
    } else {
      indicator.style.opacity = '0';
    }
  }, [props.linkActiveClassName]);

  useEffect(() => {
    if (!props.linkActiveClassName) return;

    const container = containerRef.current;
    if (!container) return;

    const scrollParent = container.closest<HTMLElement>(
      '[class*="tableOfContents"]',
    );

    const observer = new MutationObserver(() => {
      updateIndicator();

      // Auto-scroll TOC to keep active item visible
      if (!scrollParent) return;
      const activeLink = container.querySelector<HTMLElement>(
        `.${props.linkActiveClassName!.split(' ').join('.')}`,
      );
      if (activeLink) {
        const parentRect = scrollParent.getBoundingClientRect();
        const linkRect = activeLink.getBoundingClientRect();
        if (linkRect.top < parentRect.top || linkRect.bottom > parentRect.bottom) {
          activeLink.scrollIntoView({block: 'nearest', behavior: 'smooth'});
        }
      }
    });

    observer.observe(container, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    // Initial position
    updateIndicator();

    return () => observer.disconnect();
  }, [props.linkActiveClassName, updateIndicator]);

  return (
    <div ref={containerRef} style={{position: 'relative'}}>
      <div
        ref={indicatorRef}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 2,
          background: 'var(--ifm-font-color-base)',
          transition: 'transform 0.2s ease, height 0.2s ease, opacity 0.2s ease',
          opacity: 0,
          zIndex: 1,
        }}
      />
      <TOCItems {...props} />
    </div>
  );
}
