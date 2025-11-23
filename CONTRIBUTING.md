# Contributing to Pedigree MCP

## Development Setup

```bash
# Clone the repository
git clone https://github.com/zzgael/pedigree-mcp.git
cd pedigree-mcp

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run in development mode (watch)
npm run dev
```

## Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Watch mode
npm run test:watch
```

## Code Style

We use Prettier for code formatting:

```bash
# Check formatting
npm run lint

# Fix formatting
npm run lint:fix
```

## Publishing (Maintainers)

### Setup npm Token (One-time)

1. Go to [npmjs.com → Access Tokens](https://www.npmjs.com/settings/~/tokens)
2. Generate a new **"Automation"** token (never expires, perfect for CI/CD)
3. Go to the GitHub repo → **Settings → Secrets and variables → Actions**
4. Add a new secret named `NPM_TOKEN` with the token value

### Publishing a New Version

```bash
# 1. Make sure you're on main and up to date
git checkout main
git pull

# 2. Bump version (creates a git tag automatically)
npm version patch  # for bug fixes (1.0.0 → 1.0.1)
npm version minor  # for new features (1.0.0 → 1.1.0)
npm version major  # for breaking changes (1.0.0 → 2.0.0)

# 3. Push with tags (triggers auto-publish)
git push --follow-tags
```

The GitHub Action will automatically:
1. Run tests
2. Build the package
3. Publish to npm with provenance

### Manual Release (Alternative)

You can also create a GitHub Release which triggers publishing:
1. Go to Releases → Create new release
2. Create a new tag (e.g., `v1.0.1`)
3. Publish the release

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Run lint (`npm run lint`)
6. Commit your changes (`git commit -m 'feat: add amazing feature'`)
7. Push to your branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks
