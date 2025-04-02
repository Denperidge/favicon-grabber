import { basename, extname } from "path";
import { createWriteStream } from "fs";
import { stat, rm, rename } from "fs/promises";
import { Readable } from "stream";
import { finished } from "stream/promises";
import { env } from "process";

/** Regex used to find favicons in HTML code */
const REGEX_GET_ICO =      /<link([^>]|\n)*?href="(?<href>[^"]*?(\.png|\.ico|\.jpg|\.jpeg).*?)"([^>]|\n)*?>/gi;
const REGEX_GET_ICO_META = /<meta([^>]|\n)*?content="(?<href>[^"]*?(\.png|\.ico|\.jpg|\.jpeg).*?)"([^>]|\n)*?>/gi;

export const ACCEPTED_MIME_TYPES_ICONS = ["image/vnd.microsoft.icon", "image/x-icon", "image/png", "image/jpeg"];
export const ACCEPTED_MIME_TYPES_HTML = [ "text/html" ]
export const MIME_TYPE_DICTIONARY = {
    "image/vnd.microsoft.icon": ".ico", 
    "image/x-icon": ".ico", 
    "image/png": ".png", 
    "image/jpeg": ".jpg",
    "text/html": ".html"
}


// Providers
const EXTERNAL_PROVIDER_DUCKDUCKGO = "https://icons.duckduckgo.com/ip3/";
const EXTERNAL_PROVIDER_GOOGLE = "https://www.google.com/s2/favicons?domain="; 


/**
 * @typedef Overrides Different overrides that are available 
 * @property {boolean} fileExtFromContentTypeHeader add an extension to output file, based on the content type header.
 * @property {boolean} ignoreContentTypeHeader whether to ignore the content type header for a request
 * @property {boolean} searchMetaTags whether to search the meta tags for icons
 */
const DEFAULT_OVERRIDES = {
    fileExtFromContentTypeHeader: false,
    ignoreContentTypeHeader: false, 
    searchMetaTags: false
};


/**
 * If the env variable `DEBUG_FAVICON_GRABBER
 * is set to something (that isn't 0 or false) -
 * log the specified message to console.
 * 
 * If the condition above is not met, it will be an empty function instead
 * 
 * This way, only a check on the begin of the run needs to be done for conditional logging
 * 
 */
const log = 
    env.DEBUG_FAVICON_GRABBER != undefined && env.DEBUG_FAVICON_GRABBER != "0" && env.DEBUG_FAVICON_GRABBER != "false" ?
    /**
     * 
     * @param {string} msg Message to log
     */
    function(msg) {
        console.log("[FG] " + msg.toString());
    } :
    function(msg) {};

/**
 * Parses a filepath into the outPathFormat
 * 
 * @param {string} outPathFormat see {@link downloadFavicon}
 * @param {string|URL} originalFilepath path to the file being adapted into outputFormat
 * @returns {string} outputPath
 * 
 */
export function _parseOutputFormat(outPathFormat, originalFilepath) {
    originalFilepath = originalFilepath.toString();
    return outPathFormat
        .replace(/%basename%/gi, basename(originalFilepath))
        .replace(/%filestem%/gi, basename(originalFilepath, extname(originalFilepath)))
        .replace(/%extname%/gi, extname(originalFilepath).split("?")[0])
}

/**
 * Wrapper for fetch that rejects based on response status codes
 * or mime type
 * 
 * @param {string|URL} url URL to fetch
 * @param {Array<string>} acceptedMimeTypes Array of accepted mime types
 * @param {Overrides} overrides Different possible overrides. See {@link Overrides} & {@link DEFAULT_OVERRIDES}
 * @returns {Promise<Response>} Fetch response
 */
export async function _request(url, acceptedMimeTypes, overrides=DEFAULT_OVERRIDES) {
    log(`_request - acceptedMimeTypes: ${acceptedMimeTypes} url: ${url} overrides: ${JSON.stringify(overrides)}`);
    return new Promise(async (resolve, reject) => {
        fetch(url)
            .then((response) => {
                const contentType = response.headers.get("content-type");
                log(`Response: ${response.status} - ${response.statusText}
                     Content-Type: ${contentType}`)

                if (response.status >= 400) {
                    log("Rejecting request to " + url)
                    reject(response);
                    return;
                }
                let accepted = overrides.ignoreContentTypeHeader;

                if (!accepted) {
                    for (let i = 0; i < acceptedMimeTypes.length; i++) {
                        if (contentType.includes(acceptedMimeTypes[i])) {
                            accepted = true;
                            break
                        }
                    }
                }
                if (!accepted) {
                    const msg = `Request rejected: response content type (${contentType}) is not included in accepted types (${acceptedMimeTypes})\n\tFrom URL: ${url}`;
                    log(msg);
                    reject(msg)
                    return;
                } 
                resolve(response)
            })
            .catch((e) => {
                console.error("Error whilst requesting data from " + url);
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
 * @param {Array<string>} acceptedMimeTypes see {@link _request}
 * @param {Overrides} overrides Different possible overrides. See {@link Overrides} & {@link DEFAULT_OVERRIDES}
 * @param {string|null} originalUrl For use with external providers. Overrides the url used to determine outPathFormat. See {@link _parseOutputFormat}
 * @returns {Promise<string>} final output path
 */
export async function _saveFile(url, outPathFormat="%basename%", acceptedMimeTypes, overrides=DEFAULT_OVERRIDES, originalUrl=null) {
    log(`_saveFile:\n\turl: ${url}\n\toutPathFormat: ${outPathFormat}`);
    return new Promise(async (resolve, reject) => {
        try {
            const outputPath = _parseOutputFormat(outPathFormat, originalUrl || url);
            _request(url, acceptedMimeTypes, overrides).then(async data => {
                //data.headers.get()
                const stream = createWriteStream(outputPath);
                await finished(Readable.fromWeb(data.body).pipe(stream));
                if ((await stat(outputPath)).size == 0) {
                    await rm(outputPath)
                    reject(`Output file ${outputPath} size is 0. The file has been automatically cleaned up`);
                    return;
                }
                resolve(outputPath);
            }).catch(reject);
        }
        catch (e) {
            console.error(`Error during _saveFile (url: ${url}, outPathFormat: ${outPathFormat})`)
            reject(e);
        }
    });
}


/**
 * Runs the regex needle against the haystack.
 * Returns all results in the href group
 * 
 * @param {string} haystack 
 * @param {RegExp} needleRegex 
 * @returns {Array<string>}
 */
export function _regexReturnHrefs(haystack, needleRegex) {
    return Array.from(haystack.matchAll(needleRegex)).map(
        (match) => match.groups.href);
}

/**
 * Turns a HTML string into a list of favicon href's
 * 
 * @param {string} html string of HTML code
 * @param {string|URL|null} url
 * Add specified url to the start of favicon hrefs, if there isn't an url already there. Null/disabled by default
 * 
 * @returns {Array<string>|false} ["/favicon.ico", "/icon.png"] || ["https://example.com/favicon.ico", "https://example.com/logo.png"]
 * 
 * If an unpredicted error happens, this function will return false
 */
export function findFaviconsInHtmlString(html, url=null, overrides=DEFAULT_OVERRIDES) {
    try {
        const icoPathsMatches = !overrides.searchMetaTags ? 
            _regexReturnHrefs(html, REGEX_GET_ICO) :
            _regexReturnHrefs(html, REGEX_GET_ICO).concat(_regexReturnHrefs(html, REGEX_GET_ICO_META));
        if (url === null) {
            log(`findFaviconsInHtmlString url == null\nOutput: ${icoPathsMatches.toString()}`)
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
            log(`findFaviconsInHtmlString url == ${url}\nOutput: ${icoPaths.toString()}`)
            return icoPaths;
        }
    } catch (e) {
        console.log("Error during parsing favicons from HTML");
        return false;
    }
}

/**
 * This function:
 * - Requests the HTML page text from URL using {@link _request}
 * - Parses the HTML string to a list of favicons using {@link findFaviconsInHtmlString}
 * - Downloads first found icon from to outPathFormat using {@link _saveFile}
 * 
 * @param {string|URL} websiteUrl Website to download favicon from 
 * @param {string} outPathFormat see {@link downloadFavicon}
 * @param {Overrides} overrides Different possible overrides. See {@link Overrides} & {@link DEFAULT_OVERRIDES}
 * @returns {string} Local path to downloaded favicon 
 */
export async function downloadFaviconFromWebpage(websiteUrl, outPathFormat, overrides=DEFAULT_OVERRIDES) {
    log(`_downloadFaviconFromWebpage: websiteUrl: ${websiteUrl}, outPathFormat: ${outPathFormat}`)
    return new Promise(async (resolve, reject) => {
        _request(websiteUrl, ACCEPTED_MIME_TYPES_HTML, overrides).then(async (req) => {
            const favicons = findFaviconsInHtmlString(await req.text(), websiteUrl, overrides);
            if (favicons === false) {
                reject("Could not find favicons in HTML");
            }
            log(`favicons found: ${favicons}`)
            if (favicons.length < 1) {
                log("No favicons found from HTML");
                reject("No favicons found from HTML");
                return;
            }
            log(`Selected first favicon: ${favicons[0]}`)
            downloadFavicon(favicons[0], outPathFormat, overrides)
                .then(resolve).catch(reject)
        }).catch(reject);
    });
}

/**
 * Helper function for
 * {@link downloadFaviconFromDuckduckgo} &
 * {@link downloadFaviconFromGoogle}
 * 
 * @param {string|URL} websiteUrl Website to request the favicon from
 * @param {string} outPathFormat see {@link downloadFavicon}
 * @param {Overrides} overrides Different possible overrides. See {@link Overrides} & {@link DEFAULT_OVERRIDES}
 * @returns {Promise<string>} Local path to saved favicon
 */
export async function _downloadFaviconFromExternalProvider(websiteUrl, outPathFormat, providerPrefix, providerSuffix, overrides=DEFAULT_OVERRIDES) {   
    log(`_downloadFaviconFromExternalProvider:
        websiteUrl: ${websiteUrl}
        outPathFormat: ${outPathFormat}
        providerPrefix: ${providerPrefix}
        providerSuffix: ${providerSuffix}
        `)
    return _saveFile(
        providerPrefix + (new URL(websiteUrl)).hostname + providerSuffix, 
        outPathFormat, ACCEPTED_MIME_TYPES_ICONS, overrides, websiteUrl);
}

/**
 * Downloads a favicon for specified website using Duckduckgo
 * 
 * @param {string|URL} websiteUrl Website to request the favicon from
 * @param {string} outPathFormat see {@link downloadFavicon}
 * @param {Overrides} overrides Different possible overrides. See {@link Overrides} & {@link DEFAULT_OVERRIDES}
 * @returns {Promise<string>} Local path to saved favicon
 */
export async function downloadFaviconFromDuckduckgo(websiteUrl, outPathFormat, overrides=DEFAULT_OVERRIDES) {
    return _downloadFaviconFromExternalProvider(websiteUrl, outPathFormat, EXTERNAL_PROVIDER_DUCKDUCKGO, ".ico", overrides);
}

/**
 * Downloads a favicon for specified website using Google
 * 
 * @param {string|URL} websiteUrl Website to request the favicon from
 * @param {string} outPathFormat see {@link downloadFavicon}
 * @param {Overrides} overrides Different possible overrides. See {@link Overrides} & {@link DEFAULT_OVERRIDES}
 * @returns {Promise<string>} Local path to saved favicon
 */
export async function downloadFaviconFromGoogle(websiteUrl, outPathFormat, overrides=DEFAULT_OVERRIDES) {
    return _downloadFaviconFromExternalProvider(websiteUrl, outPathFormat, EXTERNAL_PROVIDER_GOOGLE, "", overrides);
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
 * @param {Overrides} overrides Different possible overrides. See {@link Overrides} & {@link DEFAULT_OVERRIDES}
 *  
 * @returns {Promise<string>} Local path to downloaded favicon 
 */
export default async function downloadFavicon(url, outPathFormat="%basename%", overrides=DEFAULT_OVERRIDES) {
    log(`downloadFavicon:
        ${url}
        ${outPathFormat}`)
    return new Promise(async (resolve, reject) => {
        try {
            url = new URL(url);
        } catch (e) {
            console.error("Error parsing url " + url);
            reject(e);
        }
        if (extname(url.pathname) != "") {
            log("Option 1: file in url, just do a normal request")
            _saveFile(url, outPathFormat, ACCEPTED_MIME_TYPES_ICONS, overrides)
                .then(resolve)
                .catch(e => reject(e));
        } else {
            const faviconFromOrigin = url.origin + "/favicon.ico";
            log(`Option 2: origin + /favicon.ico (${faviconFromOrigin})`)
            _saveFile(faviconFromOrigin, outPathFormat, ACCEPTED_MIME_TYPES_ICONS, overrides)
                .then(resolve)
                .catch(e => {
                    log("Option 3: determine from webpage's HTML")
                    downloadFaviconFromWebpage(url, outPathFormat, overrides)
                    .then(resolve)
                    .catch(e => {
                        log("Option 4: Duckduckgo external provider");
                        downloadFaviconFromDuckduckgo(url, outPathFormat, overrides)
                            .then(resolve)
                            .catch(e => {
                                log("Option 5: Google external provider");
                                downloadFaviconFromGoogle(url, outPathFormat, overrides)
                                    .then(resolve)
                                    .catch(e => {
                                        console.error("All options tried, but no favicon could be found for " + url)
                                        reject(e);
                                    });
                            });
                    })
                })
        }
    });
}
