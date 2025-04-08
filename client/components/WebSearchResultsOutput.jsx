import React from 'react';

export function WebSearchResultsOutput({ toolCall, toolResult }) {
  // If no result yet, show loading state
  if (!toolResult) {
    return (
      <div className="py-2 px-3 text-sm text-secondary-500 dark:text-dark-text-secondary animate-pulse">
        Loading search results...
      </div>
    );
  }

  // Handle error responses
  if (toolResult.error) {
    return (
      <div className="py-2 px-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded text-sm text-red-600 dark:text-red-400">
        <div className="font-medium">Error: {toolResult.error}</div>
        {toolResult.message && <div className="mt-1 whitespace-pre-wrap">{toolResult.message}</div>}
      </div>
    );
  }

  try {
    // Get the actual result data from the response
    const { result, ok } = toolResult;
    
    if (!ok) {
      return (
        <div className="py-2 px-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded text-sm text-red-600 dark:text-red-400">
          <div className="font-medium">Search request failed</div>
          <div className="mt-1">{toolResult.status} {toolResult.statusText}</div>
        </div>
      );
    }

    // Extract search results from various possible structures
    let searchResults = [];
    
    // Log the result structure for debugging
    console.log('Search result structure:', typeof result, result);
    
    if (!result) {
      return <div className="py-2 px-3 text-sm">No results returned</div>;
    }

    // Handle various result formats
    if (typeof result === 'string') {
      try {
        // Attempt to parse if it's a JSON string
        const parsed = JSON.parse(result);
        if (Array.isArray(parsed)) {
          searchResults = parsed;
        } else if (parsed.results || parsed.items || parsed.data || parsed.content) {
          searchResults = parsed.results || parsed.items || parsed.data || parsed.content;
        } else {
          // Use the parsed object as a single result
          searchResults = [parsed];
        }
      } catch (e) {
        // Not valid JSON, treat as plain text result
        return (
          <div className="py-2 px-3 text-sm">
            <div className="font-medium mb-2">Search Result:</div>
            <div className="whitespace-pre-wrap">{result}</div>
          </div>
        );
      }
    } else if (Array.isArray(result)) {
      // Result is directly an array of results
      searchResults = result;
    } else if (typeof result === 'object') {
      // Check for common result container properties
      if (result.results) {
        searchResults = result.results;
      } else if (result.items) {
        searchResults = result.items;
      } else if (result.data) {
        searchResults = result.data;
      } else if (result.content) {
        searchResults = result.content;
      } else if (result.organic_results) {
        searchResults = result.organic_results;
      } else if (result.web_pages) {
        searchResults = result.web_pages;
      } else if (result.webPages?.value) {
        searchResults = result.webPages.value;
      } else {
        // If no recognized array property, use the object as a single result
        searchResults = [result];
      }
    }

    // Ensure searchResults is an array
    if (!Array.isArray(searchResults)) {
      if (searchResults && typeof searchResults === 'object') {
        searchResults = [searchResults];
      } else {
        searchResults = [];
      }
    }

    // If no results found after all attempts
    if (searchResults.length === 0) {
      return <div className="py-2 px-3 text-sm">No search results found</div>;
    }

    return (
      <div className="py-2 px-3 space-y-4">
        <div className="text-sm font-medium">Search Results ({searchResults.length})</div>
        {searchResults.map((item, index) => {
          // Extract fields using common field names across different APIs
          const title = item.title || item.name || item.headline || '';
          const url = item.url || item.link || item.href || '';
          const snippet = item.snippet || item.description || item.summary || item.content || item.text || '';
          
          return (
            <div key={index} className="text-sm border-b border-secondary-100 dark:border-dark-border pb-3 last:border-0 last:pb-0">
              <div className="font-medium">{title || `Result ${index + 1}`}</div>
              {url && (
                <div className="text-xs text-blue-600 dark:text-blue-400 truncate mb-1">
                  <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {url}
                  </a>
                </div>
              )}
              {snippet && <div className="text-secondary-700 dark:text-dark-text-secondary whitespace-pre-wrap">{snippet}</div>}
            </div>
          );
        })}
      </div>
    );
  } catch (error) {
    console.error('Error processing search results:', error);
    return (
      <div className="py-2 px-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded text-sm text-red-600 dark:text-red-400">
        <div className="font-medium">Error processing search results</div>
        <div className="mt-1">{error.message}</div>
      </div>
    );
  }
} 