import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
class ErrorBoundary extends React.Component<{children:React.ReactNode},{error:boolean}>{
 state={error:false};
 static getDerivedStateFromError(){return {error:true};}
 render(){return this.state.error ? <main style={{padding:40,fontFamily:'system-ui'}}><h1>Something interrupted Daymark</h1><p>Your saved data is still in this browser. Reload to try again.</p><button onClick={()=>location.reload()}>Reload dashboard</button></main> : this.props.children;}
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>);
