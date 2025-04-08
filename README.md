# OpenAI Realtime UI

A feature-rich web application for interacting with OpenAI's Realtime API, featuring a flexible tools system and universal webhook integration.


## Features

- 💬 Real-time chat interface with OpenAI's latest models
- 🔧 Extensible tools system to augment AI capabilities
- 🔍 Integrated web search capability
- 🪝 Universal webhook system to connect any API
- 🎨 Color palette generation tool
- 🌐 Automatic proxy routing for external APIs (avoids CORS issues)
- 🎭 Dark/light mode themes

## Installation

### Prerequisites

- Node.js (v18+)
- An OpenAI API key with access to the Realtime API
- (Optional) A SearXNG instance for web search capability

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/bigsk1/openai-realtime-ui.git
   cd openai-realtime-ui
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the project root with your API keys:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_REALTIME_MODEL=your_openai_realtime_model_here
   SEARXNG_URL=your_searxng_url_here  # Optional
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:3000`

## Tools System

This application features an extensible tools system that allows the AI to perform various actions beyond just conversation.

### Built-in Tools

- **Web Search**: Search the web for current information
- **Color Palette**: Generate color schemes based on themes
- **Webhook Call**: Universal tool to connect with any external API

### Webhooks Manager

The Webhook Manager allows you to configure custom API endpoints that the AI can interact with, without any coding:

1. Open the application and scroll to the "Webhook Endpoints Manager" section
2. Add new webhooks with:
   - **Endpoint Key**: A unique identifier for the webhook (e.g., `btc-price`)
   - **URL**: The API endpoint URL (e.g., `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd`)
   - **Method**: The HTTP method to use (GET/POST/ANY)
   - **API Key**: Optional authentication key
   - **Description**: Detailed explanation of the webhook's purpose and required parameters



## Advanced Features

### Automatic Proxy Routing

All external API requests are automatically routed through the application's built-in proxy to prevent CORS issues, with no configuration needed.

### Chaining Tools

The AI can automatically chain multiple tools together. For example, when asking about weather in a city:
1. First uses the geocoding webhook to convert the city name to coordinates
2. Then uses the weather webhook with those coordinates to get the forecast

## Development

### Project Structure

```
├── client/           # Front-end React application
│   ├── components/   # React components
│   ├── lib/          # Client-side utilities and tools definitions
│   └── styles/       # CSS and styling
├── docs/             # Documentation
├── server.js         # Express server and API endpoints
└── .env              # Environment variables (create this)
```

### Adding New Tools

See [docs/tools-guide.md](docs/tools-guide.md) for detailed instructions on how to create new tools and extend the application's capabilities.