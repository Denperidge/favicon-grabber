import { readFileSync } from "fs";
import test from "ava";
import { _getBaseUrl, _request, getFaviconsFromHtmlString} from "../favicon-fetcher.js";

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

test("_request returns expected status codes & contents", async t => {
    for (let i = 0; i < URLS.length; i++) {
        const url = URLS[i];
        const data = await _request(url);
        t.truthy(await data.text(), `Text is not empty (${url})`);
        t.true(data.status < 400, `The status code (${data.status}) is not in the 4** or 5** range`);
    };
})

/*
test("getFaviconsFromHtmlString returns the correct amount of results in the correct format", t => {
    const html = readFileSync("tests/test.html", {encoding: "utf-8"})
    t.deepEqual(getFaviconsFromHtmlString(html), ["/favicon.ico"]);
    t.deepEqual(getFaviconsFromHtmlString(html, "https://example.com"), ["https://example.com/favicon.ico"])
})
    */




