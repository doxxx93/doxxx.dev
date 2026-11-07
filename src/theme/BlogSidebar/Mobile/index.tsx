import type {ReactNode} from 'react';

// No blog sidebar in the mobile drawer: Docusaurus would open the drawer on the
// post list behind a "back to main menu" step. On a phone the hamburger opens the
// site menu directly; posts are reached through the newer/older links and Archive.
export default function BlogSidebarMobile(): ReactNode {
  return null;
}
