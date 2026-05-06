import { Layout } from 'antd';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './App.css';
import { PluginWorkbench } from './components/workbench';
import { SchemaDocsPage } from './pages/SchemaDocsPage';

const { Footer } = Layout;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={(
            <Layout style={{ minHeight: '100vh' }}>
              <PluginWorkbench />
              <Footer style={{ textAlign: 'center', color: '#64748b', fontSize: 12, padding: '10px 24px' }}>
                Copyright © {new Date().getFullYear()} rengao
              </Footer>
            </Layout>
          )}
        />
        <Route
          path="/schema"
          element={(
            <Layout style={{ minHeight: '100vh' }}>
              <SchemaDocsPage />
              <Footer style={{ textAlign: 'center', color: '#64748b', fontSize: 12, padding: '10px 24px' }}>
                Copyright © {new Date().getFullYear()} rengao
              </Footer>
            </Layout>
          )}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
