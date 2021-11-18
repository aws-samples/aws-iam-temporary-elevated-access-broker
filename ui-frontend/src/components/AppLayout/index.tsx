import React, {FunctionComponent, useMemo} from 'react';
import AppLayoutBase from 'aws-northstar/layouts/AppLayout';
import HeaderBase from 'aws-northstar/components/Header';
import SideNavigationBase, { SideNavigationItem, SideNavigationItemType } from 'aws-northstar/components/SideNavigation';
import BreadcrumbGroup from 'aws-northstar/components/BreadcrumbGroup';

import ApiHandler from "../../common/api";

const AppLayout: FunctionComponent = ( {children} ) => {

  const Header = useMemo(() => (
       <HeaderBase title="Temporary elevated access broker"  />
  ), []);
  const Breadcrumbs = useMemo(() => <BreadcrumbGroup rootPath=""/>, []);;
  const SideNavigation = useMemo(() => {

    return <SideNavigationBase
        header={{text: 'Demo', href: '/'}}
        expanded={false}
        items={
          getNavigation()
        }
        ></SideNavigationBase>
  }, []);

  function getNavigation() {
    let navs: Array<SideNavigationItem> = [];

    if (ApiHandler.requester) {
      let nav:SideNavigationItem = {text: 'Request dashboard', type: SideNavigationItemType.LINK, href: '/Request-dashboard'}
      navs.push(nav)
    }

    if (ApiHandler.reviewer) {
      let nav:SideNavigationItem = {text: 'Review dashboard', type: SideNavigationItemType.LINK, href: '/Review-dashboard'}
      navs.push(nav)
    }

    if (ApiHandler.auditor) {
      let nav:SideNavigationItem = {text: 'Audit dashboard', type: SideNavigationItemType.LINK, href: '/Audit-dashboard'}
      navs.push(nav)
    }

    if (ApiHandler.requester || ApiHandler.reviewer || ApiHandler.auditor) {
      let nav:SideNavigationItem = {text: 'Log off', type: SideNavigationItemType.LINK, href: '/Logoff'}
      navs.push(nav)
    }

    return navs;
  }

    return <AppLayoutBase
        header={Header}
        navigation={SideNavigation}
        breadcrumbs={Breadcrumbs}
    >
        {children}
    </AppLayoutBase>
}

export default AppLayout;