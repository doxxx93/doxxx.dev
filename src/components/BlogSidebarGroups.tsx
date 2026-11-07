import React, {type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import {translate} from '@docusaurus/Translate';
import type {BlogSidebarItem} from '@docusaurus/plugin-content-blog';

type ClassNames = {
  group: string;
  heading: string;
  list: string;
  item: string;
  link: string;
  linkActive: string;
  archive: string;
};

// Book reviews are titled "<Book> subtitle"; the sidebar shows only the book, in its own group.
const BOOK_TITLE = /^<(.+?)>/;
const RECENT_COUNT = 5;

// Sidebar modeled on the OpenAI developer blog: recent posts, book reviews, then the full archive.
// Topics (Kubernetes, Rust, …) join once several have enough posts; mixing one subject with
// one format ("Kubernetes" next to "book reviews") reads oddly.
export default function BlogSidebarGroups({
  items,
  classNames: c,
}: {
  items: BlogSidebarItem[];
  classNames: ClassNames;
}): ReactNode {
  const recent = items.filter((i) => !BOOK_TITLE.test(i.title)).slice(0, RECENT_COUNT);
  const books = items.filter((i) => BOOK_TITLE.test(i.title));
  const link = (key: string, to: string, label: string) => (
    <li key={key} className={c.item}>
      <Link isNavLink to={to} className={c.link} activeClassName={c.linkActive}>
        {label}
      </Link>
    </li>
  );

  return (
    <>
      <div className={c.group}>
        <div className={c.heading}>
          {translate({id: 'theme.blog.sidebar.recent', message: '최근 글', description: 'Heading of the recent posts group in the blog sidebar'})}
        </div>
        <ul className={c.list}>{recent.map((i) => link(i.permalink, i.permalink, i.title))}</ul>
      </div>
      {books.length > 0 && (
        <div className={c.group}>
          <div className={c.heading}>
            {translate({id: 'theme.blog.sidebar.bookReviews', message: '서평', description: 'Heading of the book review group in the blog sidebar'})}
          </div>
          <ul className={c.list}>
            {books.map((i) => link(i.permalink, i.permalink, i.title.match(BOOK_TITLE)![1]))}
          </ul>
        </div>
      )}
      <Link to="/archive" className={c.archive}>
        {translate({id: 'theme.blog.sidebar.archive', message: '아카이브 →', description: 'Link from the blog sidebar to the archive, named like the navbar item'})}
      </Link>
    </>
  );
}
