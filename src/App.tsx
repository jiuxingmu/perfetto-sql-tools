import { Layout } from 'antd';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './App.css';
import { PluginWorkbench } from './components/workbench';
import { getRouterBasename } from './lib/api';
import { SchemaDocsPage } from './pages/SchemaDocsPage';

const { Content } = Layout;

const MIIT_BEIAN_URL = 'https://beian.miit.gov.cn/';
const SITE_FOOTER_TAGLINE = '- 把灵感写成代码，把代码变成作品 -';

function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="site-footer-tagline">{SITE_FOOTER_TAGLINE}</p>
      <div className="site-footer-meta">
        <a
          href={MIIT_BEIAN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="site-footer-icp"
        >
          沪ICP备2026019159号-1
        </a>
        <span className="site-footer-dot" aria-hidden>
          ·
        </span>
        <span>Design by rengao</span>
      </div>
    </footer>
  );
}

function App() {
  return (
    <BrowserRouter basename={getRouterBasename()}>
      <Routes>
        <Route
          path="/"
          element={(
            <Layout
              style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Content style={{ flex: 1, minHeight: 0 }}>
                <PluginWorkbench />
              </Content>
              <SiteFooter />
            </Layout>
          )}
        />
        <Route
          path="/schema"
          element={(
            <Layout
              style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Content style={{ flex: 1, minHeight: 0 }}>
                <SchemaDocsPage />
              </Content>
              <SiteFooter />
            </Layout>
          )}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
