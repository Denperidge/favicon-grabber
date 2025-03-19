import { basename, extname } from "path";
import { createWriteStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { finished } from "stream/promises";

const REGEX_GET_ICO = /<link(.|\n)*?href="(?<href>.*?(\.png|\.ico).*?)"(.|\n)*?>/gi;

/**
 * Parses a filepath into the outputPathFormat
 * 
 * @param {string} outputPathFormat @see downloadFavicon for outputPathFormat
 * @param {string|URL} originalFilepath path to the file being adapted into outputFormat
 * @returns {string} outputPath
 */
export function _parseOutputFormat(outputPathFormat, originalFilepath) {
    originalFilepath = originalFilepath.toString();
    return outputPathFormat
        .replace(/%basename%/gi, basename(originalFilepath))
        .replace(/%filestem%/gi, basename(originalFilepath, extname(originalFilepath)))
        .replace(/%extname%/gi, extname(originalFilepath))
}

/**
 * 
 * @param {string|URL} url 
 * 
 * @returns {Promise<Response>}
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
 * 
 * @param {string|URL} url url to file to save
 * @param {string} outPathFormat @see downloadFavicon
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
                throw new Error(`Output file ${outputPath} size is 0`);
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
 * 
 * Turns a HTML string into favicon href's
 * 
 * @param {string} html string of HTML code
 * @param {string|URL|null} url Add specified url to the start of favicons, if not was already there. Null/disabled by default
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

export async function _downloadFaviconFromHtml(url, outputPathFormat) {
    return new Promise(async (resolve, reject) => {
        const req = await _request(url);
        const favicons = getFaviconsFromHtmlString(await req.text(), url);
        if (favicons.length < 1) {
            reject(new Error("No favicons found from HTML"));
            return;
        }
        downloadFavicon(favicons[0], outputPathFormat)
            .then(out => {
                resolve(out)}
            ).catch(reject)
    })
}

/**
 * 
 * @param {URL|string} url
 * @param {string} outputPathFormat output path format to use.
 * %basename% and %extname% can be used to return the source file's properties
 * @example: `outdir/favicon-fetcher-%basename%.%extname%`
 *  
 */
export async function downloadFavicon(url, outputPathFormat="%basename%") {
    return new Promise(async (resolve, reject) => {
        try {
            url = new URL(url);
        } catch (e) {
            console.error("Error parsing url " + url);
            throw e;
        }
        // If file in url
        if (extname(url.pathname) != "") {
            resolve(_saveFile(url, outputPathFormat));
        } else {
            _saveFile(url.origin + "/favicon.ico", outputPathFormat)
                .then(output => {resolve(output)})
                .catch(e => {
                    _downloadFaviconFromHtml(url, outputPathFormat)
                    .then(output => resolve(output))
                    .catch(e => {
                        console.log(e)
                    })
                })
        }
    });
}

/**
 * 
 * @param {Array<string>} urls list of URLS to get favicons from 
 * @param {string} outputPathFormat @see downloadFavicon for outputPathFormat
 */
export async function downloadFaviconFromUrls(urls, outputPathFormat) {
    //for (let i = 0; )
}


/*
async function downloadFavicon(url, outputFilename, tried={baseDomain:false, fromHtml:false}) {
    const fullOutputFilename = "src/assets/" + outputFilename + ".ico";
    return new Promise(async (resolve, reject) => {
        let error;
        try {
            const requestUrl = url.endsWith(".ico") ?
                url : join(url, "favicon.ico")
            console.log("Requesting favicon from " + requestUrl)
            const data = await fetch(requestUrl);
            // Thanks to antonok on https://stackoverflow.com/a/74722818
            const body = data.body;
            if (data.status < 400) {
                const stream = createWriteStream(fullOutputFilename);
                await finished(Readable.fromWeb(body).pipe(stream))
                resolve(fullOutputFilename);
            }
        } catch (e) {
            error = e;
        }
        if (!tried.fromHtml) {
            tried.fromHtml = true;
            const requestUrl = url.endsWith(".ico") ?
                url.substring(0, url.lastIndexOf("/") + 1) :
                url;
            console.log("Determining favicon from " + requestUrl)
            const data = await fetch(requestUrl);
            contents = await data.text();
            console.log(contents)
            console.log("***")
            try {
                const icoPath = contents.match(REGEX_GET_ICO)[0];
                let newUrl;
                if (icoPath.startsWith("/")) {
                    newUrl = join(getBaseUrl(url), icoPath);
                } else {
                    newUrl = join(url, icoPath);
                }
                downloadFavicon(newUrl, outputFilename, tried).then(resolve);
            } catch (e) {
                console.log("Error during determining faivcon from HTML")
                console.log(`status code: ${data.status}, url: ${url}, outputFilename: ${outputFilename}, tried: ${JSON.stringify(tried)}`);
                throw e;
            }
            
        } else if (!tried.baseDomain) {
            tried.baseDomain = true;
            downloadFavicon(getBaseUrl(url), outputFilename, tried).then(resolve);
        } else if (error) {
            console.log(`Error whilst downloading favicon. URL: ${url}, outputFilename: ${outputFilename}, tried: ${JSON.stringify(tried)}`)
            throw error;
        }
    });
}
*/