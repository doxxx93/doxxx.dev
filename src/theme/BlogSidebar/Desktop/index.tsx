import React, {memo} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import {translate} from '@docusaurus/Translate';
import {useVisibleBlogSidebarItems} from '@docusaurus/plugin-content-blog/client';
import type {Props} from '@theme/BlogSidebar/Desktop';
import BlogSidebarGroups from '@site/src/components/BlogSidebarGroups';

import styles from './styles.module.css';

const groupClassNames = {
  group: styles.group,
  heading: styles.groupHeading,
  list: clsx(styles.sidebarItemList, 'clean-list'),
  item: styles.sidebarItem,
  link: styles.sidebarItemLink,
  linkActive: styles.sidebarItemLinkActive,
  archive: styles.archiveLink,
};

function BlogSidebarDesktop({sidebar}: Props) {
  const items = useVisibleBlogSidebarItems(sidebar.items);
  return (
    <aside className="col col--3">
      <nav
        className={clsx(styles.sidebar, 'thin-scrollbar')}
        aria-label={translate({
          id: 'theme.blog.sidebar.navAriaLabel',
          message: 'Blog recent posts navigation',
          description: 'The ARIA label for recent posts in the blog sidebar',
        })}>
        <div className={clsx(styles.sidebarItemTitle, 'margin-bottom--md')}>
          <Link to="/" className={styles.sidebarTitleLink}>
            {sidebar.title}
          </Link>
        </div>
        <BlogSidebarGroups items={items} classNames={groupClassNames} />
      </nav>
    </aside>
  );
}

export default memo(BlogSidebarDesktop);
