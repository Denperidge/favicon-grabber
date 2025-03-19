import {join} from "path";

const REGEX_GET_ICO = /(?<=href=").*?\.ico/g;

/**
 * 
 * @param {string} oldUrl 
 * @returns {string}
 */
export function _getBaseUrl(oldUrl) {
    if (!oldUrl.includes("/")) {
        return oldUrl;
    }
    else if (oldUrl.includes("://")) {
        const urlWithoutProtocol = oldUrl.substring(oldUrl.indexOf("://") + 3);
        if (!urlWithoutProtocol.includes("/")) {
            return oldUrl;
        } else {
            let newUrl = oldUrl.substring(0, oldUrl.indexOf("://") + 3);
            newUrl += urlWithoutProtocol.substring(0, urlWithoutProtocol.indexOf("/"))
            return newUrl;
        }
    }
    else if (oldUrl.includes("/")) {
        return oldUrl.substring(0, oldUrl.indexOf("/"));
    }
}

/**
 * 
 * @param {string|null} url
 * @param {string} html  
 */
export function getFaviconsFromHtmlString(html, url=null) {
    try {
        const icoPathsMatches = html.match(REGEX_GET_ICO);
        if (url === null) {
            return icoPathsMatches;
        } else {
            const icoPaths = icoPathsMatches.map((icoPath) => {
                if (icoPath.startsWith("/")) {
                    return join(getBaseUrl(url), icoPath);
                } else {
                    return join(url, icoPath);
                }
            })
            return icoPaths;
        }
    } catch (e) {
        console.log("Error during parsing favicons from HTML");
        throw e;
    }
}

/**
 * 
 * @param {String} url 
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