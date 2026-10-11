import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './monarch.css';
import { CinemaProvider } from './ui/Cinema';
import { SoundProvider } from './ui/Sound';
class ErrorBoundary extends React.Component<{
    children: React.ReactNode;
}, {
    error: string;
}> {
    state = { error: '' };
    static getDerivedStateFromError(e: Error) { return { error: e.message }; }
    render() { return this.state.error ? <div className="fatal-state"><span className="eyebrow">Monarch</span><h1>Unable to open<br/>this page.</h1><p>{this.state.error}</p><button className="secondary" onClick={() => { location.hash = 'home'; location.reload(); }}>Return to study</button></div> : this.props.children; }
}
createRoot(document.getElementById('root')!).render(<ErrorBoundary><SoundProvider><CinemaProvider><App /></CinemaProvider></SoundProvider></ErrorBoundary>);
