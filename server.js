import express from "express";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import "dotenv/config";

const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.OPENAI_API_KEY;
const searxngUrl = process.env.SEARXNG_URL; 

// Configure Vite middleware for React client with reduced logging
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: "custom",
  // Add logging options here for the server process
  logLevel: 'error',
  customLogger: {
    info: (msg) => {
      // Filter out specific noisy logs if needed beyond logLevel
      if (!msg.includes('[vite:css]') && !msg.includes('hmr update')) {
        console.info(msg);
      }
    },
    warn: (msg) => {
      if (!msg.includes('[vite:css]')) {
        console.warn(msg);
      }
    },
    error: console.error,
    warnOnce: console.warn,
  },
  css: {
    devSourcemap: false, 
    postcss: { 
      verbose: false, 
    },
  },
});
app.use(vite.middlewares);
app.use(express.json()); 

// API route for token generation
app.post("/token", async (req, res) => {
  try {
    const { voice = "verse" } = req.body;
    console.log(`Generating token with voice: ${voice}`);
    
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview-2024-12-17",
          voice: voice,
        }),
      },
    );

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Token generation error:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

// For backward compatibility, also support GET
app.get("/token", async (req, res) => {
  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview-2024-12-17",
          voice: "verse",
        }),
      },
    );

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Token generation error:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

// API route for web search using SearXNG
app.post("/api/search", async (req, res) => {
  const { query } = req.body;
  console.log(`Received search request for: ${query}`);
  
  if (!searxngUrl) {
    console.error("SEARXNG_URL is not defined in environment variables.");
    return res.status(500).json({ error: "Search service is not configured." });
  }
  
  if (!query) {
    return res.status(400).json({ error: "Missing search query" });
  }
  
  try {
    // Now we can use JSON format directly!
    const searchParams = new URLSearchParams({ 
      q: query,
      format: 'json',
      category_general: '1'
    });
    
    const requestUrl = `${searxngUrl}/search?${searchParams.toString()}`;
    console.log(`Fetching from SearXNG: ${requestUrl}`);
    
    const searchResponse = await fetch(requestUrl, { 
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      }
    });
    
    if (!searchResponse.ok) {
      throw new Error(`SearXNG request failed with status ${searchResponse.status}: ${await searchResponse.text()}`);
    }
    
    // Parse the JSON response directly
    const searchData = await searchResponse.json();
    
    // Transform to our simplified format - using consistent field names
    const results = (searchData.results || []).slice(0, 3).map(item => ({
      title: item.title ? String(item.title).slice(0, 100) : "No title",
      url: item.url ? String(item.url).slice(0, 500) : "#", 
      content: item.content ? String(item.content).slice(0, 150) : "No content available."
    }));
    
    console.log(`Found ${results.length} results from SearXNG JSON response.`);
    res.json({ results });
  } catch (error) {
    console.error("SearXNG search endpoint error:", error);
    res.status(500).json({ error: `Failed to perform search: ${error.message}` });
  }
});

// API proxy for CoinGecko cryptocurrency data
app.get("/api/crypto/price", async (req, res) => {
  // Default to bitcoin/usd if not specified
  const ids = req.query.ids || 'bitcoin';
  const vs_currencies = req.query.vs_currencies || 'usd';
  
  try {
    console.log(`Fetching crypto price for ${ids} in ${vs_currencies}`);
    
    // Build the CoinGecko URL with query parameters
    const url = new URL('https://api.coingecko.com/api/v3/simple/price');
    url.searchParams.append('ids', ids);
    url.searchParams.append('vs_currencies', vs_currencies);
    
    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      }
    });
    
    if (!response.ok) {
      throw new Error(`CoinGecko API returned status ${response.status}`);
    }
    
    const data = await response.json();
    console.log('CoinGecko response:', data);
    res.json(data);
    
  } catch (error) {
    console.error("CoinGecko proxy error:", error);
    res.status(500).json({ error: `Failed to fetch crypto data: ${error.message}` });
  }
});

// API proxy for geocoding (converting place names to coordinates)
app.get("/api/geocode", async (req, res) => {
  const query = req.query.q;
  
  if (!query) {
    return res.status(400).json({ error: "Missing location query (q parameter)" });
  }
  
  try {
    console.log(`Geocoding location: ${query}`);
    
    // Build the Nominatim URL with query parameters
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: req.query.limit || '1'
    });
    
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        'User-Agent': 'YourApp/1.0 (your@email.com)', // OSM requires a User-Agent
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Geocoding API returned status ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Found ${data.length} locations for "${query}"`);
    res.json(data);
    
  } catch (error) {
    console.error("Geocoding proxy error:", error);
    res.status(500).json({ error: `Failed to geocode location: ${error.message}` });
  }
});

// API proxy for weather data
app.get("/api/weather", async (req, res) => {
  const { latitude, longitude } = req.query;
  
  if (!latitude || !longitude) {
    return res.status(400).json({ error: "Missing required parameters: latitude and longitude" });
  }
  
  try {
    console.log(`Fetching weather for coordinates: ${latitude},${longitude}`);
    
    // Build the OpenMeteo URL with parameters
    const params = new URLSearchParams({
      latitude,
      longitude,
      current_weather: 'true',
      ...req.query // Pass through any additional parameters
    });
    
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Weather API returned status ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Weather data retrieved successfully');
    res.json(data);
    
  } catch (error) {
    console.error("Weather API proxy error:", error);
    res.status(500).json({ error: `Failed to fetch weather data: ${error.message}` });
  }
});

// Universal webhook proxy - handles ANY external API
app.all("/api/proxy", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: "Missing target URL parameter" });
  }
  
  try {
    console.log(`Proxying ${req.method} request to: ${targetUrl}`);
    
    // Build request options
    const options = {
      method: req.method,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json, text/plain, */*',
      }
    };
    
    // Copy relevant headers from the original request
    // Don't copy host, origin, etc. which would cause issues
    const headersToForward = ['content-type', 'accept', 'x-api-key'];
    headersToForward.forEach(header => {
      if (req.headers[header]) {
        options.headers[header] = req.headers[header];
      }
    });
    
    // Handle request body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      if (req.headers['content-type']?.includes('application/json')) {
        options.body = JSON.stringify(req.body);
      } else if (req.body) {
        options.body = req.body;
      }
    }
    
    // Append query parameters if this is a GET request and there are params
    let fullUrl = targetUrl;
    if (req.method === 'GET' && Object.keys(req.query).length > 1) { // > 1 because 'url' is always there
      const params = new URLSearchParams();
      Object.entries(req.query).forEach(([key, value]) => {
        if (key !== 'url') { // Skip the 'url' parameter
          params.append(key, value);
        }
      });
      const queryString = params.toString();
      if (queryString) {
        fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
      }
    }
    
    // Make the request to the target URL
    const response = await fetch(fullUrl, options);
    
    // Copy status code
    res.status(response.status);
    
    // Copy relevant headers from the response
    const responseHeaders = response.headers;
    const headersToReturn = ['content-type', 'cache-control', 'etag'];
    headersToReturn.forEach(header => {
      const value = responseHeaders.get(header);
      if (value) {
        res.setHeader(header, value);
      }
    });
    
    // Handle response based on content type
    const contentType = responseHeaders.get('content-type');
    if (contentType) {
      if (contentType.includes('application/json')) {
        const data = await response.json();
        res.json(data);
      } else {
        const text = await response.text();
        res.send(text);
      }
    } else {
      const text = await response.text();
      res.send(text);
    }
    
  } catch (error) {
    console.error("Proxy request error:", error);
    res.status(500).json({ 
      error: `Proxy request failed: ${error.message}`,
      target_url: targetUrl
    });
  }
});

// Render the React client
app.use("*", async (req, res, next) => {
  const url = req.originalUrl;

  try {
    const template = await vite.transformIndexHtml(
      url,
      fs.readFileSync("./client/index.html", "utf-8"),
    );
    const { render } = await vite.ssrLoadModule("./client/entry-server.jsx");
    const appHtml = await render(url);
    const html = template.replace(`<!--ssr-outlet-->`, appHtml?.html);
    res.status(200).set({ "Content-Type": "text/html" }).end(html);
  } catch (e) {
    vite.ssrFixStacktrace(e);
    next(e);
  }
});

app.listen(port, () => {
  console.log(`Express server running on *:${port}`);
});
