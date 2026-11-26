# MeltValue MCP Server

Live precious metal prices and melt value math for AI assistants, from [MeltValue.com](https://meltvalue.com/).

Ask your assistant what gold is trading at, what a 14k chain weighing 12 grams is worth in metal, or what the silver in a roll of pre-1965 quarters comes to. The server answers with the same prices MeltValue.com shows on the site.

- **Endpoint:** `https://meltvalue.com/mcp`
- **Transport:** Streamable HTTP
- **Auth:** none
- **Cost:** free
- **Registry name:** `com.meltvalue/meltvalue`

## Tools

| Tool | What it does |
| --- | --- |
| `get_spot_prices` | Current spot price for gold, silver, platinum and palladium, with the day's change. |
| `get_metal_price` | Spot price for one metal, per troy ounce, gram and kilogram. |
| `calculate_melt_value` | Melt value of an item from its metal, weight and purity. Takes karat (10k, 14k, 18k and so on) or fineness (such as 0.925). Units: gram, troy ounce, ounce, pennyweight, kilogram. |
| `get_coin_melt_value` | Melt value of common US coins, such as Morgan and Peace dollars, 90% silver dimes, quarters and halves, war nickels, and American Gold and Silver Eagles. |

Every result names its source and links back to the matching page on [meltvalue.com](https://meltvalue.com/).

## Connect

### Claude

In Claude, open Settings, go to Connectors, choose "Add custom connector" and paste:

```
https://meltvalue.com/mcp
```

### Claude Code

```
claude mcp add --transport http meltvalue https://meltvalue.com/mcp
```

### Cursor, VS Code and other clients

Add this to your MCP config file:

```json
{
  "mcpServers": {
    "meltvalue": {
      "url": "https://meltvalue.com/mcp"
    }
  }
}
```

For a client that only speaks stdio, bridge with `mcp-remote`:

```json
{
  "mcpServers": {
    "meltvalue": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://meltvalue.com/mcp"]
    }
  }
}
```

## Example questions

- What is the spot price of silver right now?
- What is the melt value of 8.4 grams of 18k gold?
- How much silver is in 40 Washington quarters dated 1964 or earlier, and what is it worth?
- Which is worth more in metal today, a Morgan dollar or a Peace dollar?

## Worked example: a roll of silver quarters

A roll of 40 circulated Washington quarters dated 1932–1964 has $10 in face value. To estimate the silver in the roll, dealers commonly allow 0.715 troy ounces per $1 of face value for wear. That gives **7.15 troy ounces of silver** (40 × $0.25 × 0.715).

At an **example** silver price of $30 per troy ounce, the metal would be worth **$214.50** (7.15 × $30). For a current estimate, ask the assistant for the silver spot price and multiply by 7.15, or enter $10 face value in the [MeltValue junk silver calculator](https://meltvalue.com/junk-silver-calculator). This is a metal estimate, not a dealer offer or a collector appraisal.

## How melt value works

Melt value is the worth of the pure metal inside an item: weight, times purity, times the spot price. It ignores collector premiums and dealer fees, so a buyer will pay less than melt and a rare coin can sell for far more. The [MeltValue calculators](https://meltvalue.com/) walk through the math for jewelry, coins and scrap.

## Run your own copy

The server has no dependencies. Pick whichever way suits you.

**Local, over stdio** (Node 18 or newer):

```
git clone https://github.com/darthanalyst/meltvalue-mcp
node meltvalue-mcp/server.mjs
```

**Local, over HTTP** at `http://localhost:8787/mcp`:

```
node meltvalue-mcp/server.mjs --http
```

**Docker:**

```
docker build -t meltvalue-mcp .
docker run -i --rm meltvalue-mcp
```

**Cloudflare Workers:** edit the routes in `wrangler.toml` so they point at your own domain, then run `wrangler deploy`.

Prices come from the public MeltValue API at `https://meltvalue.com/api/v1/spot`.

## Protocol support

The server speaks MCP over Streamable HTTP. It supports the stateless 2026-07-28 revision and the earlier initialize-based revisions back to 2024-11-05.

## License

MIT. Prices are for information only and are not financial advice.
