import { basename, extname } from "path";
import { createWriteStream } from "fs";
import { stat, rm } from "fs/promises";
import { Readable } from "stream";
import { finished } from "stream/promises";

/** Regex used to find favicons in HTML code */
const REGEX_GET_ICO = /<link(.|\n)*?href="(?<href>.*?(\.png|\.ico).*?)"(.|\n)*?>/gi;

// Providers
const EXTERNAL_PROVIDER_DUCKDUCKGO = "https://icons.duckduckgo.com/ip3/";
const EXTERNAL_PROVIDER_GOOGLE = "https://www.google.com/s2/favicons?domain="; 

/**
 * Parses a filepath into the outPathFormat
 * 
 * @param {string} outPathFormat see {@link downloadFavicon}
 * @param {string|URL} originalFilepath path to the file being adapted into outputFormat
 * @returns {string} outputPath
 */
export function _parseOutputFormat(outPathFormat, originalFilepath) {
    originalFilepath = originalFilepath.toString();
    return outPathFormat
        .replace(/%basename%/gi, basename(originalFilepath))
        .replace(/%filestem%/gi, basename(originalFilepath, extname(originalFilepath)))
        .replace(/%extname%/gi, extname(originalFilepath))
}

/**
 * Wrapper for fetch
 * 
 * @param {string|URL} url URL to fetch 
 * @returns {Promise<Response>} Fetch response
 */
export async function _request(url) {
    return new Promise(async (resolve, reject) => {
        fetch(url)
            .then((response) => {resolve(response)})
            .catch((e) => {
                console.log("Error whilst requesting data from " + url);
                reject(e);
            });
    });
}

/**
 * Downloads a file from the url.
 * The output destination is determined
 * using outPathFormat
 * 
 * @param {string|URL} url url to file to save
 * @param {string} outPathFormat see {@link downloadFavicon}
 * @returns {Promise<string>} final output path
 */
export async function _saveFile(url, outPathFormat="%basename%") {
    return new Promise(async (resolve, reject) => {
        try {
            const outputPath = _parseOutputFormat(outPathFormat, url);
            const data = await _request(url);
            const stream = createWriteStream(outputPath);
            await finished(Readable.fromWeb(data.body).pipe(stream));
            if ((await stat(outputPath)).size == 0) {
                await rm(outputPath)
                throw new Error(`Output file ${outputPath} size is 0. The file has been automatically cleaned up`);
            }
            resolve(outputPath);
        }
        catch (e) {
            console.error(`Error during _saveFile (url: ${url}, outPathFormat: ${outPathFormat})`)
            reject(e);
        }
    });
}

/**
 * Turns a HTML string into a list of favicon href's
 * 
 * @param {string} html string of HTML code
 * @param {string|URL|null} url
 * Add specified url to the start of favicon hrefs, if there isn't an url already there. Null/disabled by default
 * 
 * @returns {Array<string>} ["/favicon.ico", "/icon.png"] || ["https://example.com/favicon.ico", "https://example.com/logo.png"]
 */
export function getFaviconsFromHtmlString(html, url=null) {
    try {
        const icoPathsMatches = Array.from(
            html.matchAll(REGEX_GET_ICO))
            .map((match) => match.groups.href);
        if (url === null) {
            return icoPathsMatches;
        } else {
            const icoPaths = icoPathsMatches.map((icoPath) => {
                if (icoPath.includes("://")) {
                    return icoPath;
                }
                const addition = icoPath.startsWith("/") ?
                    "" : "/";
                return url + addition + icoPath;
            })
            return icoPaths;
        }
    } catch (e) {
        console.log("Error during parsing favicons from HTML");
        throw e;
    }
}

/**
 * This function:
 * - Requests the HTML page text from URL using {@link _request}
 * - Parses the HTML string to a list of favicons using {@link getFaviconsFromHtmlString}
 * - Downloads first found icon from to outPathFormat using {@link _saveFile}
 * 
 * @param {string|URL} websiteUrl Website to download favicon from 
 * @param {string} outPathFormat see {@link downloadFavicon}
 * @returns {string} Local path to downloaded favicon 
 */
export async function _downloadFaviconFromWebpage(websiteUrl, outPathFormat) {
    return new Promise(async (resolve, reject) => {
        const req = await _request(websiteUrl);
        const favicons = getFaviconsFromHtmlString(await req.text(), websiteUrl);
        if (favicons.length < 1) {
            reject(new Error("No favicons found from HTML"));
            return;
        }
        downloadFavicon(favicons[0], outPathFormat)
            .then(resolve).catch(reject)
    });
}

/**
 * Helper function for
 * {@link downloadFaviconFromDuckduckgo} &
 * {@link downloadFaviconFromGoogle}
 * 
 * @param {string|URL} websiteUrl Website to request the favicon from
 * @param {string} outPathFormat see {@link downloadFavicon}
 * @returns {Promise<string>} Local path to saved favicon
 */
export async function _downloadFaviconFromExternalProvider(websiteUrl, outPathFormat, providerPrefix, providerSuffix) {   
    return _saveFile(
        providerPrefix + (new URL(websiteUrl)).hostname + providerSuffix, 
        outPathFormat);
}

/**
 * Downloads a favicon for specified website using Duckduckgo
 * 
 * @param {string|URL} websiteUrl Website to request the favicon from
 * @param {string} outPathFormat see {@link downloadFavicon}
 * @returns {Promise<string>} Local path to saved favicon
 */
export async function downloadFaviconFromDuckduckgo(websiteUrl, outPathFormat) {
    return _downloadFaviconFromExternalProvider(websiteUrl, outPathFormat, EXTERNAL_PROVIDER_DUCKDUCKGO, ".ico");
}

/**
 * Downloads a favicon for specified website using Google
 * 
 * @param {string|URL} websiteUrl Website to request the favicon from
 * @param {string} outPathFormat see {@link downloadFavicon}
 * @returns {Promise<string>} Local path to saved favicon
 */
export async function downloadFaviconFromGoogle(websiteUrl, outPathFormat) {
    return _downloadFaviconFromExternalProvider(websiteUrl, outPathFormat, EXTERNAL_PROVIDER_GOOGLE, "");
}

/**
 * Downloads an icon for specified website,
 * using fallbacks where needed.
 * 1. If it's a direct URL to a favicon, download it directly
 * 2. If it's a URL to a website, try the website's origin + favicon.ico
 * 3. If that doesn't work, request a page's HTML and determine favicon location from that, downloading it after
 * 4. If that doesn't work, use Duckduckgo's favicon provider as a fallback
 * 5. If that doesn't work, use Google's favicon provider as a fallback
 * 
 * @param {URL|string} url website you want the favicon from. Alternatively, a direct link to a favicon can also be used.
 * @param {string} outPathFormat
 * output path format to use. %basename% and %extname% can be used to return the source file's properties
 * @example 
 * outPathFormat="outdir/favicon-fetcher-%basename%.%extname%"
 *  
 * @returns {Promise<string>} Local path to downloaded favicon 
 */
export default async function downloadFavicon(url, outPathFormat="%basename%") {
    return new Promise(async (resolve, reject) => {
        try {
            url = new URL(url);
        } catch (e) {
            console.error("Error parsing url " + url);
            throw e;
        }
        // If file in url, just do a normal request
        if (extname(url.pathname) != "") {
            resolve(_saveFile(url, outPathFormat));
        } else {
            // Try 1: origin + /favicon.ico
            _saveFile(url.origin + "/favicon.ico", outPathFormat)
                .then(resolve)
                .catch(e => {
                    // Try 2: use webpage HTML
                    _downloadFaviconFromWebpage(url, outPathFormat)
                    .then(resolve)
                    .catch(e => {
                        // Try 3: Duckduckgo provider
                        downloadFaviconFromDuckduckgo(url, outPathFormat)
                            .then(resolve)
                            .catch(e => {
                                // Try 4: Google provider
                                downloadFaviconFromGoogle(url, outPathFormat)
                                    .then(resolve)
                                    .catch(e => {throw e});
                            });
                    })
                })
        }
    });
}
