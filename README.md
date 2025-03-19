# favicon-fetcher

A Node.js no-dependency favicon fetcher. It doesn't rely on external endpoints unless nothing else works, instead using the HTML, regex and the fetch API.

## Limitations
- The Fetch API is used instead of a full browser simulation. If the favicon is added with JavaScript on the client-side, this might give issues. 
