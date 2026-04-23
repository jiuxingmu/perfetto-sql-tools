import { Layout } from 'antd';
import './App.css';
import { PluginWorkbench } from './components/PluginWorkbench';

const { Footer } = Layout;

function App() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <PluginWorkbench />
      <Footer style={{ textAlign: 'center', color: '#64748b', fontSize: 12, padding: '10px 24px' }}>
        Copyright © {new Date().getFullYear()} rengao
      </Footer>
    </Layout>
  );
}

export default App;
