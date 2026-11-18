import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './refinement.css';
import './liquid-glass.css';
class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() { return this.state.error ? <div className="fatal-error"><h2>遇到一个界面错误</h2><p>{this.state.error.message}</p><p>本机恢复记录仍然保留，请重新启动应用。</p><button onClick={() => location.reload()}>重新加载</button></div> : this.props.children; }
}
createRoot(document.getElementById('root')).render(<ErrorBoundary><App/></ErrorBoundary>);
