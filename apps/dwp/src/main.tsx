import '@vitejs/plugin-react-swc/preamble';

import { bootstrapApplication } from './bootstrap-application';
import { routesSection } from './routes/sections';

bootstrapApplication(routesSection);
