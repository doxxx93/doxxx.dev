import React, {type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import {translate} from '@docusaurus/Translate';
import {useBlogPost} from '@docusaurus/plugin-content-blog/client';
import BlogPostItemHeaderInfo from '@theme/BlogPostItem/Header/Info';
import BlogPostItemHeaderAuthors from '@theme/BlogPostItem/Header/Authors';

import styles from './styles.module.css';

// Book reviews are titled "<Book> subtitle": the book becomes the title, the rest the subtitle.
const BOOK_TITLE = /^<(.+?)>\s*(.*)$/;

// Header laid out like the OpenAI developer blog: category · date above the
// title, a muted subtitle below. The page <title> and URL stay untouched.
export default function BlogPostItemHeader(): ReactNode {
  const {metadata, isBlogPostPage} = useBlogPost();
  const {permalink, title, description, tags} = metadata;
  const book = title.match(BOOK_TITLE);
  const isReview = tags.some((t) => t.permalink.endsWith('/book-review'));

  const label = isReview
    ? translate({id: 'theme.blog.post.category.bookReview', message: '서평', description: 'Category label above a book review title'})
    : tags[0]?.label;
  const heading = book ? book[1] : title;
  // review descriptions are boilerplate ("한빛미디어 나는리뷰어다 …"), so reviews only use the title's own subtitle
  const subtitle = book ? book[2] : isReview ? '' : description;

  const TitleHeading = isBlogPostPage ? 'h1' : 'h2';
  return (
    <header>
      <div className={styles.kicker}>
        {label && <span className={styles.label}>{label}</span>}
        <BlogPostItemHeaderInfo />
      </div>
      <TitleHeading className={styles.title}>
        {isBlogPostPage ? heading : <Link to={permalink}>{heading}</Link>}
      </TitleHeading>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      <BlogPostItemHeaderAuthors />
    </header>
  );
}
