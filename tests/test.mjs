import { readFileSync } from "fs";
import test from "ava";
import { _getBaseUrl, _parseOutputFormat, _request, _saveFile, getFaviconsFromHtmlString} from "../favicon-fetcher.js";

const URLS = [ "https://blinkies.cafe" ];

/**
 * Good examples of urls that give issues
 * - dp.la: wget and fetch both return empty index.html and 202 code. This should use a fallback
 */
const URLS_THAT_DONT_QUITE_WORK = [ "https://dp.la/" ];

test("_getBaseUrl works as expected", t => {
    t.is(_getBaseUrl("https://example.com/"), "https://example.com");
    t.is(_getBaseUrl("https://example.com"), "https://example.com");
    
    t.is(_getBaseUrl("http://example.com/"), "http://example.com");
    t.is(_getBaseUrl("http://example.com"), "http://example.com");
    
    t.is(_getBaseUrl("example.com/"), "example.com");
    t.is(_getBaseUrl("example.com"), "example.com");

    t.is(_getBaseUrl("https://example.com/subpage/index.html"), "https://example.com");
    t.is(_getBaseUrl("http://example.com/subpage/index.html"), "http://example.com");
    t.is(_getBaseUrl("example.com/subpage/index.html"), "example.com");

    t.is(_getBaseUrl("https://example.com/subpage/"), "https://example.com");
    t.is(_getBaseUrl("http://example.com/subpage/"), "http://example.com");
    t.is(_getBaseUrl("example.com/subpage/"), "example.com");

    t.is(_getBaseUrl("https://example.com/subpage"), "https://example.com");
    t.is(_getBaseUrl("http://example.com/subpage"), "http://example.com");
    t.is(_getBaseUrl("example.com/subpage"), "example.com");

});

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
        const data = await _request(url);
        t.truthy(await data.text(), `Text is not empty (${url})`);
        t.true(data.status < 400, `The status code (${data.status}) is not in the 4** or 5** range`);
    };
})

/*
test("_saveFile... saves a file", t => {
    t.is()
});
*/

test("getFaviconsFromHtmlString returns the correct (amount of) results, with an url prepended if specified", t => {
    const TEST_URL = "https://example.com"
    
    const EXPECTED_RESULTS = [
        "/favicon.ico?v=4393bde228f3",
        "/favicon-16x16.png?v=50d5f3028f70",
        "/favicon-32x32.png?v=2b275943c6da",
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
        "/apple-touch-startup-image-1668x2224.png?v=7d3bb7e60cdc",
        "/apple-touch-startup-image-2224x1668.png?v=7753e4c813eb",
        "/apple-touch-startup-image-2048x2732.png?v=d648d09ba5d9",
        "/apple-touch-startup-image-2732x2048.png?v=0eb53364f945",
    ];
    const EXPECTED_RESULTS_WITH_URL = EXPECTED_RESULTS.map(result => {
        if (result.includes("://")) { 
            return result;
        } else if (!result.startsWith("/")) {
            return TEST_URL + "/" + result;
        } else {
            return TEST_URL + result;
        }
    });

    const html = readFileSync("tests/test.html", {encoding: "utf-8"})
    t.deepEqual(getFaviconsFromHtmlString(html), EXPECTED_RESULTS, `Returns favicon hrefs without url (${EXPECTED_RESULTS[0]}) if none is specified`)
    t.deepEqual(getFaviconsFromHtmlString(html, TEST_URL), EXPECTED_RESULTS_WITH_URL, `Returns favicon hrefs without url (${EXPECTED_RESULTS_WITH_URL[0]}) if one is specified`)
})




