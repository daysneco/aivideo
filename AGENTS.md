# AI Agent Guidelines

## Project Overview

Remotion video project for creating "A Dog Named Money" video summary. Uses React 18 + TypeScript 5 + Remotion 4.

## Commands

### Development
```bash
# Start preview server (remotion studio)
npm start

# Render video
npm run render

# Generate topics using LLM (requires OPENAI_API_KEY or ANTHROPIC_API_KEY)
npm run generate-topics

# Generate full book video script (requires GEMINI_API_KEY)
# Generates ~30 scenes, 5-8 mins content
npm run create-book-video -- <BookName>
```

### Build/Test
- **No test runner configured** - Add Jest/Vitest if needed
- **No linting configured** - Add ESLint + Prettier if needed
- **TypeScript**: `npx tsc --noEmit` for type checking

## Code Style

### TypeScript
- **Target**: ESNext, strict mode enabled
- **JSX**: react-jsx transform (no need to import React)
- **Quotes**: Single quotes for strings, double for JSX attributes
- **Semicolons**: Required
- **Indent**: 2 spaces

### React Components
- Use functional components with explicit `React.FC` type
- Props: Destructure in parameters, use interfaces for typing
- Named exports only
- Example:
```typescript
interface Props {
  item: ScriptItem;
}

export const Scene: React.FC<Props> = ({ item }) => { ... };
```

### Imports
- React imports first (when needed for hooks/types)
- Third-party libraries second (remotion, lucide-react)
- Local imports last (use relative paths)
- Group by source, separate with blank line

### Naming
- Components: PascalCase
- Interfaces/Types: PascalCase
- Variables/functions: camelCase
- Constants: UPPER_SNAKE_CASE for true constants

### Types
- Define interfaces for data structures (see `src/data/script.ts` or `src/types/book.ts`)
- Export types that are shared across files
- Use explicit return types on exported functions

### Styling
- Inline styles preferred (Remotion convention)
- Use `AbsoluteFill` from remotion as layout base
- Color format: hex codes (e.g., `#fbbf24`)

### Error Handling
- Scripts should validate environment variables
- Use early returns and throw descriptive errors
- LLM scripts must validate JSON responses

### File Organization
```
src/
  components/     # React components
  data/          # Data structures and content
  types/         # TypeScript definitions
  index.ts       # Entry point (registers root)
  Root.tsx       # Root composition
  Composition.tsx # Main video composition
scripts/         # Node.js utility scripts (ES modules)
```

## Remotion Specifics

- Use `interpolate` for animations
- Use `spring` for bouncy animations
- Use `useCurrentFrame()` and `useVideoConfig()` hooks
- Define `durationInFrames` as multiples of fps (30fps)
- Font loading via `@remotion/fonts` + `staticFile()`

## Scripts (ES Modules)

- Use `.mjs` extension for Node scripts
- Import `fs`, `path` as ES modules
- Use `fileURLToPath` + `dirname` pattern for __dirname

## Environment Variables

- **GEMINI_API_KEY**: Required for `create-book-video` script (Google Gemini 3)
- OPENAI_API_KEY or ANTHROPIC_API_KEY: Required for legacy `generate-topics`
- Check for existence before use with descriptive error messages
