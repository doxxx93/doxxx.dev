import React, {memo, type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import {useVisibleBlogSidebarItems} from '@docusaurus/plugin-content-blog/client';
import {NavbarSecondaryMenuFiller} from '@docusaurus/theme-common';
import type {Props} from '@theme/BlogSidebar/Mobile';
import BlogSidebarGroups from '@site/src/components/BlogSidebarGroups';

import styles from './styles.module.css';

const groupClassNames = {
  group: styles.group,
  heading: styles.groupHeading,
  list: styles.list,
  item: styles.listItem,
  link: styles.link,
  linkActive: styles.linkActive,
  archive: styles.archiveLink,
};

function BlogSidebarMobileSecondaryMenu({sidebar}: Props): ReactNode {
  const items = useVisibleBlogSidebarItems(sidebar.items);
  return (
    <>
      <div className={styles.title}>
        <Link to="/" className={styles.titleLink}>
          {sidebar.title}
        </Link>
      </div>
      <BlogSidebarGroups items={items} classNames={groupClassNames} />
    </>
  );
}

function BlogSidebarMobile(props: Props): ReactNode {
  return (
    <NavbarSecondaryMenuFiller
      component={BlogSidebarMobileSecondaryMenu}
      props={props}
    />
  );
}

export default memo(BlogSidebarMobile);
