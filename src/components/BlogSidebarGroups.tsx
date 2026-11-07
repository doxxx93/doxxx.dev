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

// Book reviews are titled "<Book> subtitle"; they are reached through the topic, not the recent list.
const BOOK_TITLE = /^<(.+?)>/;
const RECENT_COUNT = 5;

// shortcut: topics are hand-listed tag pages because the blog sidebar data has no tags;
// list a topic here once it has 3+ posts.
const TOPICS = [
  {to: '/tags/kubernetes', label: () => 'Kubernetes'},
  {to: '/tags/book-review', label: () => translate({id: 'theme.blog.sidebar.bookReviews', message: '서평', description: 'Book review topic in the blog sidebar'})},
];

// Sidebar modeled on the OpenAI developer blog: recent posts, topics, then the full archive.
// Its length stays the same however many posts accumulate.
export default function BlogSidebarGroups({
  items,
  classNames: c,
}: {
  items: BlogSidebarItem[];
  classNames: ClassNames;
}): ReactNode {
  const recent = items.filter((i) => !BOOK_TITLE.test(i.title)).slice(0, RECENT_COUNT);
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
      <div className={c.group}>
        <div className={c.heading}>
          {translate({id: 'theme.blog.sidebar.topics', message: '주제', description: 'Heading of the topics group in the blog sidebar'})}
        </div>
        <ul className={c.list}>{TOPICS.map((t) => link(t.to, t.to, t.label()))}</ul>
      </div>
      <Link to="/archive" className={c.archive}>
        {translate({id: 'theme.blog.sidebar.allPosts', message: '전체 글 보기 →', description: 'Link from the blog sidebar to the full archive'})}
      </Link>
    </>
  );
}
