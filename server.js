import express from "express";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import "dotenv/config";

const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.OPENAI_API_KEY;
const searxngUrl = process.env.SEARXNG_URL; 
const openaiModel = process.env.OPENAI_REALTIME_MODEL || "gpt-4o-realtime-preview-2024-12-17";

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
    const { voice = "verse", instructions } = req.body;
    console.log(`Generating token with voice: ${voice}${instructions ? " and custom instructions" : ""}`);
    
    // Build request body with optional instructions
    const requestBody = {
      model: openaiModel,
      voice: voice,
    };
    
    // Only add instructions if provided
    if (instructions) {
      requestBody.instructions = instructions;
    }
    
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
    );

    const data = await response.json();
    // Add the model to the response so client knows which model was used
    data.model = openaiModel;
    res.json(data);
  } catch (error) {
    console.error("Token generation error:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

// For backward compatibility, also support GET
app.get("/token", async (req, res) => {
  try {
    // Get instructions from query params if available
    const instructions = req.query.instructions;
    
    // Build request body with optional instructions
    const requestBody = {
      model: openaiModel,
      voice: "verse",
    };
    
    // Only add instructions if provided
    if (instructions) {
      requestBody.instructions = instructions;
    }
    
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
    );

    const data = await response.json();
    // Add the model to the response so client knows which model was used
    data.model = openaiModel;
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

// Add a route to expose which env vars are available (not their values)
app.get('/api/config', (req, res) => {
  // Add cache control headers
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  
  // Create a list of available environment variables (not including their values)
  const availableEnvVars = {
    SEARXNG_URL: !!process.env.SEARXNG_URL,
    // Add other env vars that tools might depend on
  };
  
  // console.log("Sending config to client:", { 
  //   searxng: !!process.env.SEARXNG_URL,
  //   env_vars_present: Object.keys(availableEnvVars).filter(key => availableEnvVars[key])
  // });
  
  res.json({ availableEnvVars });
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
