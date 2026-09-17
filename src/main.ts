import './styles/main.css';
import './styles/panels.css';
import { App } from './App';

const app = new App('app');
app.init().catch(console.error);

(window as any).xauusdApp = app;