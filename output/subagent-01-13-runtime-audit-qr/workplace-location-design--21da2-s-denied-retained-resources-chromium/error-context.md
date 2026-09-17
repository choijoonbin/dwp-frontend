# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - alert [ref=e4]:
    - img [ref=e6]
    - 'heading "Failed to fetch dynamically imported module: http://localhost:4200/src/features/rooms/workplace-navigation-subviews.tsx" [level=6] [ref=e9]'
  - generic [ref=e12]:
    - generic [ref=e13]: "[plugin:vite:import-analysis] Failed to resolve import \"./api/agent-user-advancement-api\" from \"libs/shared-utils/src/index.ts\". Does the file exist?"
    - generic [ref=e14]: /Users/a10697/Work/DWP/dwp-frontend/libs/shared-utils/src/index.ts:22:14
    - generic [ref=e15]: 19 | export * from './api/agent-personal-ai-api'; 20 | export * from './api/agent-artifact-api'; 21 | export * from './api/agent-user-advancement-api'; | ^ 22 | export * from './api/identity-admin-api'; 23 | export * from './api/directory-admin-api';
    - generic [ref=e16]: at TransformPluginContext._formatLog (file:///Users/a10697/Work/DWP/dwp-frontend/node_modules/vite/dist/node/chunks/node.js:31066:39) at TransformPluginContext.error (file:///Users/a10697/Work/DWP/dwp-frontend/node_modules/vite/dist/node/chunks/node.js:31063:14) at normalizeUrl (file:///Users/a10697/Work/DWP/dwp-frontend/node_modules/vite/dist/node/chunks/node.js:28008:18) at async file:///Users/a10697/Work/DWP/dwp-frontend/node_modules/vite/dist/node/chunks/node.js:28076:30 at async Promise.all (index 20) at async TransformPluginContext.transform (file:///Users/a10697/Work/DWP/dwp-frontend/node_modules/vite/dist/node/chunks/node.js:28044:4) at async EnvironmentPluginContainer.transform (file:///Users/a10697/Work/DWP/dwp-frontend/node_modules/vite/dist/node/chunks/node.js:30851:14) at async loadAndTransform (file:///Users/a10697/Work/DWP/dwp-frontend/node_modules/vite/dist/node/chunks/node.js:20619:26)
    - generic [ref=e17]:
      - text: Click outside, press Esc key, or fix the code to dismiss.
      - text: You can also disable this overlay by setting
      - code [ref=e18]: server.hmr.overlay
      - text: to
      - code [ref=e19]: "false"
      - text: in
      - code [ref=e20]: vite.config.ts
      - text: .
```