# Contributing to Parsely

Thank you for your interest in contributing to Parsely!

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Clone the repository
git clone https://github.com/TeamOliveCode/parsely.git
cd parsely

# Install dependencies
npm install

# Start development server
npm run dev
```

### Loading the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `.output/chrome-mv3` folder

## Development

### Available Scripts

```bash
npm run dev          # Start dev server (Chrome)
npm run dev:firefox  # Start dev server (Firefox)
npm run build        # Production build
npm run test         # Run tests in watch mode
npm run test:run     # Run tests once
npm run lint         # Check for lint errors
npm run lint:fix     # Auto-fix lint errors
npm run format       # Format code with Prettier
```

### Project Structure

```
src/
├── components/      # UI components
│   └── reader/      # Reader overlay UI
├── core/            # Core logic
│   ├── extraction/  # Article parsing & serialization
│   ├── navigation/  # Keyboard & scroll handling
│   └── state/       # Reader state management
├── features/        # Feature modules
│   ├── analytics/   # Usage tracking (optional)
│   ├── storage/     # Progress persistence
│   └── subscription/# Email collection (optional)
├── entrypoints/     # Extension entry points
│   ├── background.ts
│   └── content.ts
└── types/           # TypeScript types
```

### Code Style

- We use ESLint and Prettier for code formatting
- Run `npm run lint` before committing
- Run `npm run format` to auto-format code

### Testing

- Tests are written with Vitest
- Run `npm run test:run` to execute all tests
- Run `npm run test:coverage` for coverage report

## Making Changes

### Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm run test:run`)
5. Run lint (`npm run lint`)
6. Commit your changes
7. Push to your fork
8. Open a Pull Request

### Commit Messages

Use clear, descriptive commit messages:

```
feat: add dark mode support
fix: resolve scroll position bug
docs: update README with new instructions
test: add tests for keyboard navigation
```

## Areas for Contribution

- Bug fixes
- Test coverage improvements
- Accessibility improvements (ARIA labels, keyboard navigation)
- Documentation
- Performance optimizations

## Questions?

Feel free to open an issue if you have questions or need help getting started.
