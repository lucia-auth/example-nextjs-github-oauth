# GitHub OAuth example in Next.js

Uses SQLite. Rate limiting is implemented using JavaScript `Map`.

## Initialize project

Create a GitHub OAuth app with the redirect URI pointed to `/login/github/callback`.

```
http://localhost:3000/login/github/callback
```

Paste the client ID and secret to a `.env` file.

```bash
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET="
```

Create `sqlite.db` and run `setup.sql`.

```
sqlite3 sqlite.db
```

Run the application:

```
pnpm dev
```

## Notes

- TODO: Update redirect URI
