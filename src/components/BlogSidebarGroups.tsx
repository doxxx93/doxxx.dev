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

// Book reviews are titled "<Book> subtitle"; the sidebar shows only the book.
const BOOK_TITLE = /^<(.+?)>/;

// Posts grouped by year, then book reviews collapsed into one group, then a link to the full archive.
export default function BlogSidebarGroups({
  items,
  classNames: c,
}: {
  items: BlogSidebarItem[];
  classNames: ClassNames;
}): ReactNode {
  const posts = items.filter((i) => !BOOK_TITLE.test(i.title));
  const books = items.filter((i) => BOOK_TITLE.test(i.title));
  // sidebar dates arrive as ISO strings after serialization
  const year = (i: BlogSidebarItem) => String(i.date).slice(0, 4);
  const years = [...new Set(posts.map(year))];

  const list = (group: BlogSidebarItem[], label: (i: BlogSidebarItem) => string) => (
    <ul className={c.list}>
      {group.map((i) => (
        <li key={i.permalink} className={c.item}>
          <Link isNavLink to={i.permalink} className={c.link} activeClassName={c.linkActive}>
            {label(i)}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {years.map((y) => (
        <div key={y} className={c.group}>
          <div className={c.heading}>{y}</div>
          {list(posts.filter((i) => year(i) === y), (i) => i.title)}
        </div>
      ))}
      {books.length > 0 && (
        <div className={c.group}>
          <div className={c.heading}>
            {translate({id: 'theme.blog.sidebar.bookReviews', message: '서평', description: 'Heading of the book review group in the blog sidebar'})}
          </div>
          {list(books, (i) => i.title.match(BOOK_TITLE)![1])}
        </div>
      )}
      <Link to="/archive" className={c.archive}>
        {translate({id: 'theme.blog.sidebar.allPosts', message: '전체 글 보기 →', description: 'Link from the blog sidebar to the full archive'})}
      </Link>
    </>
  );
}
