# Screenshot capture guide

Add PNG screenshots here for README and portfolio use. Capture at **1920×1080** or similar after `docker compose up --build`.

## Checklist

1. **01-login.png** - Login page at http://localhost:5173/login
2. **02-assistant-citations.png** - AI Assistant after asking a safety question; show citation tags + source preview
3. **03-review-queue.png** - Human Review page with a pending item (login as `safety@meridiangrid.com`)
4. **04-executive-dashboard.png** - Executive Dashboard with KPI cards and Recharts
5. **05-iot-alerts.png** - IoT Monitor while `npm run iot:simulate` is running
6. **06-eval-scorecard.png** - Terminal output of `npm run eval`

## Tips

- Use dark mode (default theme)
- Blur or omit any real API keys in terminal captures
- GIF optional: record Assistant → Review approve flow (~30s)

## Embedding in README

Once captured, reference in README:

```markdown
![AI Assistant with citations](docs/screenshots/02-assistant-citations.png)
```
