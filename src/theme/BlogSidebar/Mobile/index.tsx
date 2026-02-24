import React, {memo, type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import {
  useVisibleBlogSidebarItems,
  BlogSidebarItemList,
} from '@docusaurus/plugin-content-blog/client';
import {NavbarSecondaryMenuFiller} from '@docusaurus/theme-common';
import BlogSidebarContent from '@theme/BlogSidebar/Content';
import type {Props} from '@theme/BlogSidebar/Mobile';
import type {Props as BlogSidebarContentProps} from '@theme/BlogSidebar/Content';

import styles from './styles.module.css';

const ListComponent: BlogSidebarContentProps['ListComponent'] = ({items}) => {
  return (
    <BlogSidebarItemList
      items={items}
      ulClassName={styles.list}
      liClassName={styles.listItem}
      linkClassName={styles.link}
      linkActiveClassName={styles.linkActive}
    />
  );
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
      <BlogSidebarContent
        items={items}
        ListComponent={ListComponent}
        yearGroupHeadingClassName={styles.yearGroupHeading}
      />
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
