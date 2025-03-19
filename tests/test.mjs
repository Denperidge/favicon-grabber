import { } from "fs";
import test from "ava";
import {_request, getFaviconsFromHtmlString} from "../favicon-fetcher.js";

const URLS = [ "https://blinkies.cafe" ];

/**
 * Good examples of urls that give issues
 * - dp.la: wget and fetch both return empty index.html and 202 code. This should use a fallback
 */
const URLS_THAT_DONT_QUITE_WORK = [ "https://dp.la/" ];

test("_request returns expected status codes & contents", async t => {
    for (let i = 0; i < URLS.length; i++) {
        const url = URLS[i];
        const data = await _request(url);
        t.truthy(await data.text(), `Text is not empty (${url})`);
        t.true(data.status < 400);
    };
})




