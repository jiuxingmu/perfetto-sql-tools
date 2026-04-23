import { Layout } from 'antd';
import type { ComponentProps, ReactNode } from 'react';
import { AppHeader } from './AppHeader';
import { PluginSidebar } from './PluginSidebar';

const { Content } = Layout;

type WorkbenchShellProps = {
  header: ComponentProps<typeof AppHeader>;
  sidebar: ComponentProps<typeof PluginSidebar>;
  children: ReactNode;
};

export function WorkbenchShell({ header, sidebar, children }: WorkbenchShellProps) {
  return (
    <>
      <AppHeader
        loading={header.loading}
        uploadProps={header.uploadProps}
        processOptions={header.processOptions}
        globalProcess={header.globalProcess}
        onChangeGlobalProcess={header.onChangeGlobalProcess}
      />
      <Layout>
        <PluginSidebar
          orderedPlugins={sidebar.orderedPlugins}
          activePluginId={sidebar.activePluginId}
          onSelectPlugin={sidebar.onSelectPlugin}
        />
        <Content style={{ padding: 16 }}>
          {children}
        </Content>
      </Layout>
    </>
  );
}
