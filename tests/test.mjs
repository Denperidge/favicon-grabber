import { readFileSync, rmSync, existsSync } from "fs";
import test from "ava";
import { parse as parseFiletype } from "file-type-mime";
import downloadFavicon, { ACCEPTED_MIME_TYPES_ICONS, ACCEPTED_MIME_TYPES_HTML, _parseOutputFormat, _request, _saveFile, findFaviconsInHtmlString, downloadFaviconFromDuckduckgo, downloadFaviconFromGoogle, downloadFaviconFromWebpage} from "../favicon-grabber.js";


const URLS = [
    "https://blinkies.cafe",
    "https://www.mobilephonemuseum.com/",
    "https://tweakers.net/nieuws/list/20250319",
    //
    "https://www.digitaltransgenderarchive.net/",
    "https://lesbianherstoryarchives.org/collections/"
 ];
/**
 * Good examples of urls that give issues
 * - dp.la: wget and fetch both return empty index.html and 202 code. This should use a fallback
 */
const URLS_THAT_DONT_QUITE_WORK = [ 
    "https://dp.la/", 
    "https://pdimagearchive.org/"
];

// 

const TEST_HTML_EXPECTED_RESULTS = [
    "/favicon.ico?v=4393bde228f3",
    "/favicon-16x16.png?v=50d5f3028f70",
    "/favicon-32x32.PnG?v=2b275943c6da",
    "https://cheatsheet.denperidge.com/favicon-48x48.png?v=92136164553a",
    "/apple-touch-icon-57x57.png?v=cf5cf9f99205",
    "/apple-touch-icon-60x60.png?v=8cc19ecc8591",
    "/apple-touch-icon-72x72.png?v=0d872586d7c6",
    "/apple-touch-icon-76x76.png?v=d31d34a3327b",
    "/apple-touch-icon-114x114.png?v=0b72bcfd067b",
    "/apple-touch-icon-120x120.png?v=3c1488f224dd",
    "/apple-touch-icon-144x144.png?v=cc44dbfadd0c",
    "/apple-touch-icon-152x152.png?v=ce488fb1fa45",
    "/apple-touch-icon-167x167.png?v=1c78dc86681b",
    "/apple-touch-icon-180x180.png?v=97bbefd73032",
    "/apple-touch-icon-1024x1024.png?v=ad489c21ab08",
    "/apple-touch-startup-image-640x1136.png?v=c140ba8280f8",
    "/apple-touch-startup-image-1136x640.png?v=a77b54a9a1f9",
    "/apple-touch-startup-image-750x1334.png?v=2d6660ef3953",
    "/apple-touch-startup-image-1334x750.png?v=084cfccd59dd",
    "/apple-touch-startup-image-1125x2436.png?v=e97ae1a355f5",
    "/apple-touch-startup-image-2436x1125.png?v=aa9dca8573d5",
    "/apple-touch-startup-image-1170x2532.png?v=a4e4d84e1c5b",
    "/apple-touch-startup-image-2532x1170.png?v=dccc14d55777",
    "/apple-touch-startup-image-1179x2556.png?v=c5b00dc3dd4f",
    "/apple-touch-startup-image-2556x1179.png?v=1a66f74181d2",
    "/apple-touch-startup-image-828x1792.png?v=7432608cc634",
    "/apple-touch-startup-image-1792x828.png?v=77e509be85e0",
    "/apple-touch-startup-image-1242x2688.png?v=d5ac3e8abe85",
    "/apple-touch-startup-image-2688x1242.png?v=265c30686c8b",
    "/apple-touch-startup-image-1242x2208.png?v=2e510268c3f7",
    "/apple-touch-startup-image-2208x1242.png?v=b108fad1d3b4",
    "/apple-touch-startup-image-1284x2778.png?v=e1d7e26bf571",
    "/apple-touch-startup-image-2778x1284.png?v=f1fed966d227",
    "/apple-touch-startup-image-1290x2796.png?v=ec305ed093ac",
    "/apple-touch-startup-image-2796x1290.png?v=755ff50d7a66",
    "/apple-touch-startup-image-1488x2266.png?v=30c72469c22c",
    "/apple-touch-startup-image-2266x1488.png?v=bbf08df31ecc",
    "/apple-touch-startup-image-1536x2048.png?v=d88d06cb8e0b",
    "/apple-touch-startup-image-2048x1536.png?v=1cba6ae898f3",
    "/apple-touch-startup-image-1620x2160.png?v=93083cfa109d",
    "apple-touch-startup-image-2160x1620.png?v=07cec1f0b282",
    "apple-touch-startup-image-1640x2160.png?v=b232037de2e3",
    "apple-touch-startup-image-2160x1640.png?v=d70c455aa012",
    "/apple-touch-startup-image-1668x2388.png?v=743ec6a73223",
    "/apple-touch-startup-image-2388x1668.PNG?v=764b5e666b7a",
    "/apple-touch-startup-image-1668x2224.jpeg?v=7d3bb7e60cdc",
    "/apple-touch-startup-image-2224x1668.JpG?v=7753e4c813eb",
    "/apple-touch-startup-image-2048x2732.png?v=d648d09ba5d9",
    "/apple-touch-startup-image-2732x2048.png?v=0eb53364f945",
];
const TEST_HTML_EXPECTED_META_TAG_RESULTS = [
    "https://cheatsheet.denperidge.com/mstile-310x310.png?v=7edde8e3827b",
    "/mstile-144x144.png?v=cda4f30ec4f6",
]

const generatedFiles = [];

test.after("Cleanup generated files", () => {
    generatedFiles.forEach(file => {
        if (existsSync(file)) {
            rmSync(file);
        }
    })
})

test("_parseOutputFormat works as expected", t => {
    const filename = "https://example.com/favicon.png";
    t.is(
        _parseOutputFormat("out/output.png", filename),
        "out/output.png", "Normal strings don't get edited")
    t.is(
        _parseOutputFormat("%basename%", filename),
        "favicon.png", "%basename% returns the regular filename")
    t.is(
        _parseOutputFormat("%filestem%%extname%",filename),
        "favicon.png", "Combining %filestem% and %extname% returns the original filename")
    t.is(
        _parseOutputFormat("out/output%extname%", filename),
        "out/output.png", "Subdirs can be added")
});

test("_request returns expected status codes & contents", async t => {
    for (let i = 0; i < URLS.length; i++) {
        const url = URLS[i];
        const data = await _request(url, ACCEPTED_MIME_TYPES_HTML);
        t.truthy(await data.text(), `Text is not empty (${url})`);
        t.true(data.status < 400, `The status code (${data.status}) is not in the 4** or 5** range`);
    };
})


test("_request rejects status codes >= 400", async t => {
    let rejected;
    await _request("https://denperidge.com/doesntexist.ico", ACCEPTED_MIME_TYPES_ICONS)
        .then((response) => { rejected = false; })
        .catch((response) => { rejected = false; })
    t.false(rejected)
});

test("_saveFile... saves a file", async t => {
    const outputFilepath = await _saveFile(
        "https://cheatsheet.denperidge.com/favicon.ico",
        "tests/test-%basename%",
        ACCEPTED_MIME_TYPES_ICONS
    );
    generatedFiles.push(outputFilepath)

    const output = readFileSync(outputFilepath);
    t.deepEqual(
        output,
        readFileSync("tests/cheatsheet-favicon.ico")
    );
    t.notDeepEqual(
        output,
        readFileSync("tests/other-favicon.ico")
    );
});

const testFindFaviconsInHtmlString = test.macro({
    exec(t, expectedResults, overrides={}) {
        const testUrl = "https://example.com"
    
        const expectedResultsWithUrl = expectedResults.map(result => {
            if (result.includes("://")) { 
                return result;
            } else if (!result.startsWith("/")) {
                return testUrl + "/" + result;
            } else {
                return testUrl + result;
            }
        });
    
        const html = readFileSync("tests/test.html", {encoding: "utf-8"})
        t.deepEqual(findFaviconsInHtmlString(html, null, overrides), expectedResults, `Returns favicon hrefs without url (${expectedResults[0]}) if none is specified`)
        t.deepEqual(findFaviconsInHtmlString(html, testUrl, overrides), expectedResultsWithUrl, `Returns favicon hrefs without url (${expectedResultsWithUrl[0]}) if one is specified`)
    }
});
test("findFaviconsInHtmlString returns the correct (amount of) results, with an url prepended if specified", testFindFaviconsInHtmlString, TEST_HTML_EXPECTED_RESULTS)

test("Override: findFaviconsInHtmlString searchMetaTags", testFindFaviconsInHtmlString, TEST_HTML_EXPECTED_RESULTS.concat(TEST_HTML_EXPECTED_META_TAG_RESULTS), {searchMetaTags: true})


test("Override: test specific urls", async t => {

    /**
     * - queerjs.com: no favicon, only a meta og:image. DDG external provider returns a random icon
     *   but also, that og:image's link to a png has a content-type header is "; charset=utf-8". What
     */


    const output = await downloadFavicon(
        "https://queerjs.com/organizers/",
            "yhfjvbngf.png", {
            searchMetaTags: true,
            ignoreContentTypeHeader: true
    });
    generatedFiles.push(output);
    t.true(existsSync(output));
})

test("Override: ignoreContentTypeHeader", async t=> {
    const tests = {
        _requestRequestingHtmlWithIcoTypesRejects: false,
        _requestOverrideContentTypeHeader: false,
        _saveFileRequestingHtmlWithIcoTypesRejects: false,
        _saveFileOverrideContentTypeHeader: false,
        downloadFaviconRequestingHtmlWithIcoTypesRejects: false,
        downloadFaviconOverrideContentTypeHeader: false,
        downloadFaviconFromDuckduckgoRequestingHtmlWithIcoTypesRejects: false,
        downloadFaviconFromDuckduckgoOverrideContentTypeHeader: false,
        downloadFaviconFromGoogleRequestingHtmlWithIcoTypesRejects:false,
        downloadFaviconFromGoogleOverrideContentTypeHeader: false, 
        downloadFaviconFromWebpageRequestingHtmlWithIcoTypesRejects: false,
        downloadFaviconFromWebpageOverrideContentTypeHeader: false,
    };

    
    const args = ["https://denperidge.com", ACCEPTED_MIME_TYPES_ICONS]
    const funcs = [ _request, _saveFile, downloadFavicon, downloadFaviconFromDuckduckgo, downloadFaviconFromGoogle, downloadFaviconFromWebpage ];
    for (let i = 0; i < funcs.length; i++) {
        const func = funcs[i];
        await func(...args)
            .then((response) => {throw new Error("This should reject")})
            .catch((err) => {tests[func.name + "RequestingHtmlWithIcoTypesRejects"] = true});
        await func(...args, {ignoreContentTypeHeader: true})
            .then((response) => {
                if (func.name != "_request") {
                    generatedFiles.push(response);
                    t.true(existsSync(response))
                }
                tests[func.name + "OverrideContentTypeHeader"] = true
            })
            .catch((err) => {throw err})
        // _request uses less args
        if (i == 0) {
            args.splice(1, 0, `tests/${i}-overrides-%filestem%%extname%`)
        }
    }


        /*
    const ignoreIco = await _request("https://denperidge.com", ACCEPTED_MIME_TYPES_ICONS, {ignoreContentTypeHeader: true})
    
    await _request("https://denperidge.com", ACCEPTED_MIME_TYPES_ICONS, {ignoreContentTypeHeader: true})
    */
    Object.entries(tests).forEach(([key, succeeded]) => {
        t.true(succeeded, `${key} didn't succeed`)
    });

})

test("downloadFavicon works as expected", async t => {
    const urls = URLS.concat(URLS_THAT_DONT_QUITE_WORK)//.concat(KEYS_URLS_THAT_NEED_OVERRIDES);
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        t.log(url)

        const output = await downloadFavicon(url, `tests/${i}-%filestem%%extname%`);
        generatedFiles.push(output);

        t.true(
            ACCEPTED_MIME_TYPES_ICONS.includes(
                parseFiletype(readFileSync(output)).mime)
            )
    };


});

