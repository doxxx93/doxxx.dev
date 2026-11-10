import React, {type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import {translate} from '@docusaurus/Translate';
import {useBlogPost} from '@docusaurus/plugin-content-blog/client';
import BlogPostItemHeaderInfo from '@theme/BlogPostItem/Header/Info';
import BlogPostItemHeaderAuthors from '@theme/BlogPostItem/Header/Authors';

import styles from './styles.module.css';

// Header laid out like the OpenAI developer blog: category · date above the
// title, a muted subtitle below. Every post: `title` is the heading, `description` the
// subtitle (enforced in docusaurus.config.ts processBlogPosts).
export default function BlogPostItemHeader(): ReactNode {
  const {metadata, isBlogPostPage} = useBlogPost();
  const {permalink, title, description, tags} = metadata;
  const isReview = tags.some((t) => t.permalink.endsWith('/book-review'));

  const label = isReview
    ? translate({id: 'theme.blog.post.category.bookReview', message: '서평', description: 'Category label above a book review title'})
    : tags[0]?.label;

  const TitleHeading = isBlogPostPage ? 'h1' : 'h2';
  return (
    <header>
      <div className={styles.kicker}>
        {label && <span className={styles.label}>{label}</span>}
        <BlogPostItemHeaderInfo />
      </div>
      <TitleHeading className={styles.title}>
        {isBlogPostPage ? title : <Link to={permalink}>{title}</Link>}
      </TitleHeading>
      {description && <p className={styles.subtitle}>{description}</p>}
      <BlogPostItemHeaderAuthors />
    </header>
  );
}
