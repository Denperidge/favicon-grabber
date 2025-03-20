# favicon-grabber

A Node.js no-dependency favicon grabber. It doesn't rely on external endpoints unless nothing else works; instead opting to use the HTML, regex and fetch wherever possible.

The following logic is used:
1. If it's a direct URL to a favicon, download it **directly**
2. If it's a URL to a website, try the **website's origin + favicon.ico**
3. If that doesn't work, request a page's **HTML** and **determine favicon location** from that, downloading it after
4. If that doesn't work, use **Duckduckgo's favicon provider** as a fallback
5. If that doesn't work, use **Google's favicon provider** as a fallback

## Limitations
- The Fetch API is used instead of a full browser simulation. If the favicon is added with JavaScript on the client-side, this might give issues. However, there are fallbacks in case this happens.
- It is currently coded to detect/accept .ico & .png files

## How-to
### Basic usage
This project requires [Node.js](https://nodejs.org/) to be installed.
```bash
npm install favicon-grabber
yarn install favicon-grabber
```
```js
import downloadFavicon from "favicon-grabber";

// Download the favicon from blinkies.cafe to assets/favicon.ico
downloadFavicon("https://blinkies.cafe", "assets/%basename%").then(outputPath => {
    console.log("Favicon downloaded to " + outputPath);
}).catch(err => { throw err; });
```
That's it! Every step (described above or in the downloadFavicon comments) will be tried until a favicon can be found.

Alternatively, you can import specific parts of the module
```js
import downloadFavicon, { getFaviconsFromHtmlString, _parseOutputFormat, _request, _saveFile } from "favicon-grabber";
```

## Reference
For more information on the output path formatting, check the `downloadFavicon` documentation in [favicon-grabber.js](favicon-grabber.js).

JSDoc is used throughout the project for documentation & providing info to your IDE.

## License
This project is licensed under the [MIT License](LICENSE)

 
